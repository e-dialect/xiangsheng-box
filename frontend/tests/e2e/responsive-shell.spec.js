import { expect, test } from '@playwright/test';

const enabledCapabilities = {
  listen_feed: true,
  entry_search: true,
  recording: true,
  usage_attestation: true,
  curation_workbench: true,
  wechat_auth: true,
};

const strictConsole = process.env.RESPONSIVE_CONSOLE_STRICT === '1';

const viewports = [
  { name: 'mobile portrait', width: 390, height: 844 },
  { name: 'mobile landscape', width: 844, height: 390 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
  {
    name: 'desktop dark', width: 1440, height: 900, theme: 'dark',
  },
];

async function routeStableShellData(page) {
  await page.route('**/site-settings/capabilities', (route) => route.fulfill({
    json: { capabilities: enabledCapabilities },
  }));
  await page.route('**/recordings/**', (route) => route.fulfill({
    json: {
      count: 0, next: null, previous: null, results: [],
    },
  }));
  await page.route(/\/entries\/(?:\?.*)?$/, (route) => route.fulfill({
    json: {
      count: 0, next: null, previous: null, results: [],
    },
  }));
  await page.route('**/dialects/**', (route) => route.fulfill({
    json: { count: 0, results: [] },
  }));
  await page.route('**/product-events/', (route) => route.fulfill({
    status: 202,
    json: { accepted: 1 },
  }));
  await page.route('**/users/theme/events/', (route) => route.fulfill({
    status: 202,
    json: { accepted: 1 },
  }));
}

async function shellGeometry(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      width: box.width,
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    };
  });
}

function expectResponsiveWidth(geometry, viewport) {
  expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 2);
  if (viewport.width >= 960) {
    expect(geometry.width).toBeLessThanOrEqual(962);
    expect(Math.abs(geometry.left - (viewport.width - geometry.width) / 2)).toBeLessThan(2);
    return;
  }
  expect(geometry.width).toBeGreaterThanOrEqual(viewport.width - 2);
}

viewports.forEach((viewport) => {
  test(`${viewport.name} keeps the three page shells usable`, async ({ page }, testInfo) => {
    const consoleNoise = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) {
        consoleNoise.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setViewportSize(viewport);
    if (viewport.theme) {
      await page.addInitScript((theme) => {
        localStorage.setItem('ui_theme', theme);
      }, viewport.theme);
    }
    await routeStableShellData(page);

    await page.goto('/');
    await expect(page.locator('[data-feed-state="empty"]')).toBeVisible();
    const homeGeometry = await shellGeometry(page, '.home-page');
    expectResponsiveWidth(homeGeometry, viewport);
    if (viewport.width >= 600) {
      expect(homeGeometry.rootFontSize).toBeLessThanOrEqual(viewport.height <= 500 ? 20.1 : 24.1);
    }

    if (viewport.height <= 500) {
      const landscape = await page.evaluate(() => {
        const feed = document.querySelector('.recording-feed').getBoundingClientRect();
        const state = document.querySelector('[data-feed-state="empty"]').getBoundingClientRect();
        const tabBar = document.querySelector('.home-tab-bar').getBoundingClientRect();
        return {
          feedHeight: feed.height,
          stateHeight: state.height,
          visibleStateHeight: Math.min(state.bottom, tabBar.top) - Math.max(state.top, feed.top),
          stateBottom: state.bottom,
          tabBarTop: tabBar.top,
        };
      });
      expect(landscape.feedHeight).toBeGreaterThanOrEqual(250);
      expect(landscape.stateHeight).toBeGreaterThanOrEqual(138);
      expect(landscape.visibleStateHeight).toBeGreaterThanOrEqual(landscape.stateHeight - 2);
      expect(landscape.stateBottom).toBeLessThanOrEqual(landscape.tabBarTop + 2);
    }

    await testInfo.attach(`listen-${viewport.width}x${viewport.height}-${viewport.theme || 'light'}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.goto('/pages/search');
    await expect(page.locator('.app-shell')).toBeVisible();
    if (viewport.theme) await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
    expectResponsiveWidth(await shellGeometry(page, '.app-shell'), viewport);
    if (viewport.height <= 500) {
      const searchBarBottom = await page.locator('.entry-search__bar').evaluate(
        (element) => element.getBoundingClientRect().bottom,
      );
      const tabBarTop = await page.locator('.home-tab-bar').evaluate(
        (element) => element.getBoundingClientRect().top,
      );
      expect(searchBarBottom).toBeLessThanOrEqual(tabBarTop + 2);
    }

    await page.goto('/pages/login/login');
    await expect(page.locator('.page-shell')).toBeVisible();
    if (viewport.theme) await expect(page.locator('.page-shell')).toHaveClass(/theme-dark/);
    expectResponsiveWidth(await shellGeometry(page, '.page-shell'), viewport);

    if (strictConsole) {
      expect({ consoleNoise, pageErrors }).toEqual({ consoleNoise: [], pageErrors: [] });
    }
  });
});

test('landscape keeps home sections reachable above a stable feed and tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await routeStableShellData(page);
  let sections = ['tools', 'entries'];
  await page.route('**/site-settings/product-profile', (route) => route.fulfill({
    json: {
      profile: {
        key: 'pxm',
        name: '兴化语记 2.0 内测版',
        credit: 'powered by 乡声集盒',
        home_sections: sections,
        enabled_tools: ['pinyin'],
        featured: [],
      },
      switch_targets: [{
        key: 'box', name: '乡声集盒内测版', origin: 'https://box.test.edialect.top',
      }],
    },
  }));

  await page.goto('/');
  await expect(page.getByRole('button', { name: '切换到乡声集盒内测版' })).toBeVisible();
  const toggle = page.getByRole('button', { name: '首页栏目' });
  const tool = page.getByRole('button', { name: '拼音方案' });
  const tabBar = page.locator('.home-tab-bar');
  const feed = page.locator('.recording-feed');
  await expect(feed).toBeVisible();
  const before = await feed.boundingBox();
  expect(before.height).toBeGreaterThanOrEqual(250);
  await expect(tool).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(tool).toBeVisible();
  await expect(tabBar).toBeInViewport({ ratio: 1 });
  expect((await feed.boundingBox()).height).toBe(before.height);
  await tool.click();
  await expect(page).toHaveURL(/\/pages\/tools\/local\?tool=pinyin$/);

  sections = ['entries', 'recordings', 'collections'];
  await page.goto('/');
  await expect(page.getByRole('button', { name: '切换到乡声集盒内测版' })).toBeVisible();
  await expect(toggle).toBeHidden();
  await expect(tabBar).toBeInViewport({ ratio: 1 });
  await expect(feed).toBeVisible();
  expect((await feed.boundingBox()).height).toBeGreaterThanOrEqual(250);
});
