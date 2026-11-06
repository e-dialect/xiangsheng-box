import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';

const TARGET = '/pages/users/me';
const VIEWPORTS = [
  {
    name: 'portrait-light', width: 390, height: 844, theme: 'light',
  },
  {
    name: 'portrait-dark', width: 390, height: 844, theme: 'dark',
  },
  {
    name: 'landscape-light', width: 844, height: 390, theme: 'light',
  },
  {
    name: 'tablet-light', width: 768, height: 1024, theme: 'light',
  },
  {
    name: 'desktop-dark', width: 1440, height: 900, theme: 'dark',
  },
];

async function openMemberAccount(page, theme = 'light') {
  await installVisualFixture(page, { persona: 'member', theme });
  await openVisualRoute(page, TARGET, { persona: 'member' });
  await expect(page.getByText('视觉巡检员')).toBeVisible();
}

VIEWPORTS.forEach((viewport) => {
  test(`account archive hierarchy stays compact in ${viewport.name}`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openMemberAccount(page, viewport.theme);

    await expect(page.locator('.social-stat')).toHaveCount(3);
    await expect(page.locator('.social-stat.pressable')).toHaveCount(0);
    await expect(page.locator('.tool-grid')).toHaveCount(0);
    await expect(page.getByText('既有录音', { exact: true })).toHaveCount(0);
    await expect(page.getByText('查看完整贡献履历', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '查看贡献履历' })).toHaveCount(1);

    const archive = page.locator('.archive-menu');
    await expect(archive.locator('.t-cell')).toHaveCount(4);
    await expect(page.getByRole('button', { name: '查看词条收藏' })).toBeVisible();
    await expect(page.getByRole('button', { name: '查看关注方言，当前 1 个' })).toBeVisible();
    await archive.evaluate((element) => element.scrollIntoView({
      behavior: 'instant',
      block: 'center',
      inline: 'nearest',
    }));

    const cells = await archive.locator('.t-cell').evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    }));
    cells.forEach(({ height, width }) => {
      expect(height).toBeGreaterThanOrEqual(44);
      expect(width).toBeGreaterThan(240);
    });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);

    await stableScreenshot(page, {
      path: `test-results/account-archive-${viewport.name}.png`,
    });
    expect(runtimeIssues, `${viewport.name} browser console`).toEqual([]);
  });
});

test('account archive keeps keyboard tabs and both surviving destinations', async ({ page }) => {
  const runtimeIssues = observeRuntime(page);
  await openMemberAccount(page);

  await expect(page.getByRole('tablist', { name: '贡献类型' })).toHaveCount(0);
  await expect(page.locator('.contribution-stat')).toHaveCount(3);

  const bookmarks = page.getByRole('button', { name: '查看词条收藏' });
  await bookmarks.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pages\/users\/bookmarks$/);

  await page.goBack();
  await expect(page.getByText('档案导航')).toBeVisible();
  const circles = page.getByRole('button', { name: '查看关注方言，当前 1 个' });
  await circles.focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/\/pages\/circles\/index$/);
  expect(runtimeIssues, 'account archive interactions browser console').toEqual([]);
});

for (const destination of [
  { label: '查看我的集盒', key: 'Enter', url: /\/pages\/collections\/index\?mine=true$/, heading: '把散落的乡音，收在一起' },
  { label: '查看录音草稿', key: 'Space', url: /\/pages\/recordings\/drafts$/, heading: '留住未完成的乡音' },
]) {
  test(`account archive keyboard opens ${destination.label}`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await openMemberAccount(page);
    await page.getByRole('button', { name: destination.label }).focus();
    await page.keyboard.press(destination.key);
    await expect(page).toHaveURL(destination.url);
    await expect(page.getByText(destination.heading, { exact: true })).toBeVisible();
    expect(runtimeIssues).toEqual([]);
  });
}
