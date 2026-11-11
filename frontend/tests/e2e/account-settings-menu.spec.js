import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';

const VIEWPORTS = [
  { width: 320, height: 800, theme: 'light' },
  { width: 390, height: 844, theme: 'light' },
  { width: 390, height: 844, theme: 'dark' },
  { width: 768, height: 1024, theme: 'light' },
  { width: 844, height: 390, theme: 'light' },
  { width: 1440, height: 900, theme: 'dark' },
];
const LONG_EMAIL = `${'account'.repeat(8)}@example.com`;

async function openAccountSettings(page, theme = 'light') {
  await installVisualFixture(page, { persona: 'member', theme });
  await page.route('http://localhost:8000/users/7', async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: 7,
          username: 'collector',
          nickname: '采集者',
          email: LONG_EMAIL,
          wechat: false,
          primary_dialect: { id: 3, name: '莆仙方言', qualified_code: '闽.莆仙' },
        },
        contribution: {},
      },
    });
  });
  await openVisualRoute(page, '/pages/users/me', { persona: 'member' });
  const settings = page.locator('.account-settings');
  await expect(settings.getByRole('heading', { name: '账户设置' })).toBeVisible();
  return settings;
}

VIEWPORTS.forEach(({ width, height, theme }) => {
  test(`settings fit ${width}x${height} ${theme}`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await page.setViewportSize({ width, height });
    const settings = await openAccountSettings(page, theme);
    const groups = settings.locator('.account-settings__group');

    await expect(groups.getByRole('heading')).toHaveText([
      '个性化', '公开身份', '账户与安全', '当前会话',
    ]);
    const firstGroup = await groups.nth(0).boundingBox();
    const secondGroup = await groups.nth(1).boundingBox();
    if (width < 640) {
      expect(firstGroup.x).toBeCloseTo(secondGroup.x);
      expect(secondGroup.y).toBeGreaterThan(firstGroup.y);
    } else {
      expect(secondGroup.x).toBeGreaterThan(firstGroup.x);
      expect(firstGroup.y).toBeCloseTo(secondGroup.y);
    }

    const email = settings.getByRole('button', { name: `邮箱，已绑定 ${LONG_EMAIL}` });
    await expect(email).toBeVisible();
    const emailOverflow = await email.evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(emailOverflow).toBeLessThanOrEqual(1);
    const buttons = await settings.getByRole('button').all();
    expect(buttons).toHaveLength(5);
    const buttonBoxes = await Promise.all(buttons.map((button) => button.boundingBox()));
    buttonBoxes.forEach((box) => expect(box.height).toBeGreaterThanOrEqual(44));
    await expect(horizontalOverflow(page)).resolves.toBeLessThanOrEqual(1);
    await settings.evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await stableScreenshot(page, {
      path: `test-results/account-settings-${width}x${height}-${theme}.png`,
    });
    expect(runtimeIssues).toEqual([]);
  });
});

test('settings support keyboard navigation and a cancellable logout', async ({ page }) => {
  const runtimeIssues = observeRuntime(page);
  const settings = await openAccountSettings(page);
  const email = settings.getByRole('button', { name: `邮箱，已绑定 ${LONG_EMAIL}` });
  await email.focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/\/pages\/users\/settings\/email$/);

  await page.getByRole('button', { name: '返回' }).click();
  await expect(page).toHaveURL(/\/pages\/users\/me$/);
  const logout = settings.getByRole('button', { name: '退出登录' });
  const cancelLogout = page.locator('.t-dialog__button--cancel');
  await logout.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('退出登录？', { exact: true })).toBeVisible();
  await expect(page.getByText('退出后将回到游客模式，本地草稿仍会保留。')).toBeVisible();
  await cancelLogout.click();
  await expect(page.getByText('退出登录？', { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/pages\/users\/me$/);

  await logout.click();
  await expect(page.getByText('退出登录？', { exact: true })).toHaveCount(1);
  await cancelLogout.click();
  expect(runtimeIssues).toEqual([]);
});
