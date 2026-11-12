import { expect, test } from '@playwright/test';

test('guest signs in with the visible demo phone code', async ({ page }) => {
  test.skip(
    process.env.VITE_PHONE_CODE_LOGIN_ENABLED !== 'true',
    'phone-code login is disabled for this build',
  );
  const phoneNumber = `139${String(Date.now()).slice(-8)}`;
  await page.goto('/');
  /* 新首页：「我的」入口在底部 HomeTabBar（role=button + aria-label） */
  await page.getByRole('button', { name: '我的' }).click();
  await expect(page.getByText('还没有登录')).toBeVisible();
  await page.locator('.login-button').click();

  const phone = page.locator('.phone-input input.uni-input-input');
  const code = page.locator('.code-input input.uni-input-input');
  await expect(phone).toBeVisible();
  await phone.fill(phoneNumber);
  await page.locator('.code-button').click();

  const codeHint = page.locator('.demo-code');
  await expect(codeHint).toContainText('Demo 验证码：');
  const codeValue = (await codeHint.textContent()).match(/\d{6}/)[0];
  await code.fill(codeValue);
  await page.locator('.phone-login-button').click();

  await expect(page).toHaveURL(/\/pages\/users\/onboarding\?reason=new_user/);
  await expect(page.getByText('欢迎加入乡声集盒')).toBeVisible();
  const session = await page.evaluate(() => ({
    token: localStorage.getItem('token'),
    id: localStorage.getItem('id'),
  }));
  expect(session.token).toBeTruthy();
  expect(session.id).toBeTruthy();
});
