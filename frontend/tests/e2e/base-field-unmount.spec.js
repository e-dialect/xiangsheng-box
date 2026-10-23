import { expect, test } from '@playwright/test';
import {
  installVisualFixture,
  observeRuntime,
  openVisualRoute,
} from './helpers/visualReviewFixture';

const phoneCodeLoginEnabled = process.env.VITE_PHONE_CODE_LOGIN_ENABLED === 'true';

async function leavePage(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    uni.navigateBack({
      success: resolve,
      fail: (error) => reject(new Error(error?.errMsg || 'navigateBack failed')),
    });
  }));
  await expect(page.locator('.home-page')).toBeVisible();
}

test('standalone auth fields switch and unmount without runtime noise', async ({ page }) => {
  const runtimeIssues = observeRuntime(page);
  await installVisualFixture(page, { persona: 'guest', theme: 'light' });

  await openVisualRoute(page, '/pages/login/login');
  if (phoneCodeLoginEnabled) {
    await expect(page.locator('.phone-form .base-field')).toHaveCount(2);
    await page.getByText('账号密码', { exact: true }).click();
    await expect(page.locator('.password-form .base-field')).toHaveCount(2);
    await page.getByText('手机验证码', { exact: true }).click();
    await expect(page.locator('.phone-form .base-field')).toHaveCount(2);
  } else {
    await expect(page.locator('.password-form .base-field')).toHaveCount(2);
    await expect(page.locator('.phone-form')).toHaveCount(0);
  }
  await leavePage(page);

  await openVisualRoute(page, '/pages/login/register');
  await expect(page.locator('.base-field')).not.toHaveCount(0);
  await leavePage(page);

  await openVisualRoute(page, '/pages/login/forget');
  await expect(page.locator('.base-field')).not.toHaveCount(0);
  await leavePage(page);

  expect(runtimeIssues).toEqual([]);
});

test('fields inside BaseForm keep validation and unmount without runtime noise', async ({ page }) => {
  const runtimeIssues = observeRuntime(page);
  await installVisualFixture(page, { persona: 'member', theme: 'light' });
  await openVisualRoute(page, '/pages/users/settings/username', { persona: 'member' });

  const username = page.locator('input').first();
  await username.fill('   ');
  await page.getByRole('button', { name: '保存用户名' }).click();
  await expect(page.locator('.t-form__item-extra')).toContainText('请输入正确的用户名');
  await leavePage(page);

  expect(runtimeIssues).toEqual([]);
});
