import { expect, test } from '@playwright/test';
import {
  CORE_VISUAL_MATRIX,
  issueLabel,
  ROUTE_VISUAL_MATRIX,
  STATE_VISUAL_MATRIX,
  THEME_JOURNEY_VISUAL_MATRIX,
} from './fixtures/visualReviewMatrix';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';
import {
  prepareVisualReviewOutput,
  visualReviewOutput,
  visualScreenshotPath,
  writeVisualReviewReport,
} from './helpers/visualReviewReport';
import { stableScreenshot } from './helpers/stableScreenshot';

test.describe.configure({ mode: 'serial' });

const artifacts = [];

function pathname(target) {
  return new URL(target, 'http://visual-review.invalid').pathname;
}

function relativeScreenshot(group, filename) {
  return `${group}/${filename}.png`;
}

function contrastRatio(foreground, background) {
  const channels = (value) => {
    const values = (String(value).match(/[\d.]+/g) || []).map(Number);
    if (values.length < 3) throw new Error(`Unsupported color value: ${value}`);
    if (values.length > 3 && values[3] < 1) {
      throw new Error(`Contrast check requires an opaque rendered color: ${value}`);
    }
    return values.slice(0, 3).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
  };
  const luminance = (value) => {
    const [red, green, blue] = channels(value);
    return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
  };
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

async function capture(page, {
  actualPathExpected = '',
  avatarState = 'image',
  filename,
  focus = '',
  group,
  issues,
  name,
  persona = 'guest',
  state = 'success',
  strictConsole = true,
  target,
  theme = 'light',
  waitMs = 350,
}) {
  const runtimeIssues = observeRuntime(page);
  await installVisualFixture(page, {
    avatarState, focus, persona, state, theme,
  });
  await openVisualRoute(page, target, { persona });
  await page.waitForTimeout(waitMs);

  const actualPath = new URL(page.url()).pathname;
  if (actualPathExpected) expect(actualPath).toBe(actualPathExpected);
  await expect(page.locator('body')).not.toHaveText('');
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);

  const screenshot = visualScreenshotPath(group, filename);
  await stableScreenshot(page, { path: screenshot });
  artifacts.push({
    actualPath,
    avatarState,
    group,
    name,
    persona,
    responsibility: issueLabel(issues),
    screenshot: relativeScreenshot(group, filename),
    state,
    target,
    theme,
  });

  if (strictConsole) {
    expect(runtimeIssues, `${name} ${theme}/${persona} 浏览器控制台`).toEqual([]);
  }
}

test.beforeAll(async () => {
  await prepareVisualReviewOutput();
});

test.afterAll(async () => {
  await writeVisualReviewReport(artifacts, {
    registeredPageCount: ROUTE_VISUAL_MATRIX.length,
    coreVariantCount: CORE_VISUAL_MATRIX.length * 4,
    stateSampleCount: STATE_VISUAL_MATRIX.length,
    themeJourneyVariantCount: THEME_JOURNEY_VISUAL_MATRIX.length,
    outputDirectory: visualReviewOutput,
  });
});

const BUTTON_ACCENTS = ['pine', 'tea', 'ink', 'clay', 'mist', 'osmanthus'];
const BUTTON_THEMES = ['light', 'dark'];
const BUTTON_CONTRAST_CASES = [
  ...BUTTON_THEMES.flatMap((theme) => BUTTON_ACCENTS.flatMap((accent) => [
    {
      accent, look: 'soft', route: '/pages/search', screenshot: `button-soft-search-${theme}-${accent}`, theme,
    },
    {
      accent, look: 'fog', route: '/pages/search', screenshot: `button-fog-search-${theme}-${accent}`, theme,
    },
  ])),
  {
    accent: 'pine', look: 'fog', route: '/pages/circles/index', screenshot: 'button-fog-circles-light-pine', theme: 'light',
  },
  {
    accent: 'pine', look: 'fog', route: '/pages/collections/index', screenshot: 'button-fog-collections-light-pine', theme: 'light',
  },
];

BUTTON_CONTRAST_CASES.forEach(({
  accent, look, route, screenshot, theme,
}) => {
  test(`button contrast ${look} ${theme}/${accent} ${route} · #410`, async ({ page }) => {
    await installVisualFixture(page, { accent, persona: 'member', theme });
    await page.addInitScript((selectedLook) => {
      localStorage.setItem('ui_button_style', selectedLook);
      localStorage.setItem('ui_button_ghost', selectedLook);
      localStorage.setItem('ui_button_effect', 'none');
    }, look);
    await openVisualRoute(page, route, { persona: 'member' });
    await page.evaluate((selectedLook) => {
      window.uni?.setStorageSync('ui_button_style', selectedLook);
      window.uni?.setStorageSync('ui_button_ghost', selectedLook);
      window.uni?.$emit('theme-change', {
        effect: 'none',
        ghostLook: selectedLook,
        primaryLook: selectedLook,
      });
    }, look);
    const buttons = page.locator(`.base-button--look-${look}:visible`);
    await expect(buttons.first()).toBeVisible();
    const colors = await buttons.evaluateAll((nodes) => nodes.map((node) => {
      const styles = getComputedStyle(node);
      return { background: styles.backgroundColor, foreground: styles.color };
    }));
    colors.forEach(({ background, foreground }) => {
      expect(foreground).not.toBe(background);
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    });
    await stableScreenshot(page, {
      path: visualScreenshotPath('themes', screenshot),
    });
  });
});

ROUTE_VISUAL_MATRIX.forEach((entry, index) => {
  test(`route ${String(index + 1).padStart(2, '0')} ${entry.route} · ${issueLabel(entry.issues)}`, async ({ page }) => {
    await capture(page, {
      actualPathExpected: entry.expectedPath || entry.route,
      avatarState: entry.avatarState,
      filename: `${String(index + 1).padStart(2, '0')}-${entry.slug}-light-${entry.persona}`,
      group: 'routes',
      issues: entry.issues,
      name: entry.route,
      persona: entry.persona,
      target: entry.target,
    });

    if (entry.avatarState === 'missing') {
      await expect(page.locator('.avatar--fallback')).toHaveText('视');
      await expect(page.locator('.avatar--image')).toHaveCount(0);
    }
  });
});

CORE_VISUAL_MATRIX.forEach((entry) => {
  ['light', 'dark'].forEach((theme) => {
    ['guest', 'member'].forEach((persona) => {
      test(`core ${entry.surface} · ${theme} · ${persona} · ${issueLabel(entry.issues)}`, async ({ page }) => {
        const authRedirect = entry.surface === 'record' && persona === 'guest';
        await capture(page, {
          actualPathExpected: authRedirect ? '/pages/login/login' : pathname(entry.target),
          filename: `${entry.surface}-${theme}-${persona}`,
          group: 'core',
          issues: entry.issues,
          name: `${entry.surface} ${theme} ${persona}`,
          persona,
          target: entry.target,
          theme,
        });

        if (entry.surface === 'mine' && persona === 'member') {
          const avatar = page.locator('.avatar--image');
          await expect(avatar).toBeVisible();
          const image = avatar.locator('img');
          await expect(image).toHaveAttribute('src', /width=%2296%22/);
          await expect.poll(() => image.evaluate((element) => ({
            height: element.naturalHeight,
            width: element.naturalWidth,
          }))).toEqual({ height: 96, width: 96 });
        }
      });
    });
  });
});

STATE_VISUAL_MATRIX.forEach((entry) => {
  test(`state ${entry.surface} · ${entry.state} · ${issueLabel(entry.issues)}`, async ({ page }) => {
    await capture(page, {
      actualPathExpected: pathname(entry.target),
      filename: `${entry.surface}-${entry.state}-light-guest`,
      focus: entry.focus,
      group: 'states',
      issues: entry.issues,
      name: `${entry.surface} ${entry.state}`,
      state: entry.state,
      strictConsole: entry.state !== 'error',
      target: entry.target,
      waitMs: entry.state === 'loading' ? 100 : 350,
    });
  });
});

THEME_JOURNEY_VISUAL_MATRIX.forEach((entry) => {
  test(`theme journey ${entry.name} · ${issueLabel(entry.issues)}`, async ({ page }) => {
    await capture(page, {
      actualPathExpected: pathname(entry.target),
      filename: entry.slug,
      group: 'themes',
      issues: entry.issues,
      name: entry.name,
      persona: entry.persona,
      target: entry.target,
      theme: entry.theme,
    });

    if (entry.checkSoonLabel) {
      const soonLabel = page.locator('.soon-overlay').first();
      await expect(soonLabel).toBeVisible();
      expect(await soonLabel.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('nowrap');
      expect((await soonLabel.boundingBox())?.height || 0).toBeLessThan(30);
    }
  });
});
