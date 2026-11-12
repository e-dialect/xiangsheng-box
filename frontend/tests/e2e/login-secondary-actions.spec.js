import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';
import {
  horizontalOverflow,
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';

const viewports = [
  { width: 390, height: 844, theme: 'light' },
  { width: 390, height: 844, theme: 'dark' },
  { width: 844, height: 390, theme: 'light' },
  { width: 768, height: 1024, theme: 'light' },
  { width: 1440, height: 900, theme: 'dark' },
];

viewports.forEach(({ width, height, theme }) => {
  test(`login secondary actions stay legible at ${width}x${height} ${theme}`, async ({ page }) => {
    const runtimeIssues = observeRuntime(page);
    await page.setViewportSize({ width, height });
    await installVisualFixture(page, { persona: 'guest', theme });
    await openVisualRoute(page, '/pages/login/login');
    await expect(page.getByRole('button', { name: '微信一键登录' })).toHaveCount(0);

    const actions = [
      page.getByRole('button', { name: '暂不登录，先去查词' }),
      page.getByRole('button', { name: '忘记密码' }),
      page.getByRole('button', { name: '用户注册' }),
    ];
    const boxes = await Promise.all(actions.map(async (action) => {
      await expect(action).toBeVisible();
      await expect(action).toBeEnabled();
      return action.boundingBox();
    }));
    boxes.forEach((box) => {
      expect(box?.height || 0).toBeGreaterThanOrEqual(39);
      expect(box?.width || 0).toBeGreaterThanOrEqual(66);
    });

    await expect(horizontalOverflow(page)).resolves.toBeLessThanOrEqual(2);
    await actions.at(-1).scrollIntoViewIfNeeded();
    await stableScreenshot(page, {
      path: `test-results/login-secondary-actions-${width}x${height}-${theme}.png`,
    });
    expect(runtimeIssues).toEqual([]);
  });
});

test('login secondary actions preserve service routing and keyboard activation', async ({ page }) => {
  const runtimeIssues = observeRuntime(page);
  await installVisualFixture(page, { persona: 'guest', theme: 'light' });
  await openVisualRoute(page, '/pages/login/login');

  const browseFirst = page.getByRole('button', { name: '暂不登录，先去查词' });
  await browseFirst.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pages\/search$/);

  await openVisualRoute(page, '/pages/login/login');
  const forgetPassword = page.getByRole('button', { name: '忘记密码' });
  await forgetPassword.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pages\/login\/forget$/);

  await openVisualRoute(page, '/pages/login/login');
  const register = page.getByRole('button', { name: '用户注册' });
  await register.focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/\/pages\/login\/register$/);
  expect(runtimeIssues).toEqual([]);
});
