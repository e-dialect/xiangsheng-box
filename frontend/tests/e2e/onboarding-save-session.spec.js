import { expect, test } from '@playwright/test';
import { installVisualFixture, openVisualRoute } from './helpers/visualReviewFixture';

const profile = {
  id: 7,
  nickname: '采集者',
  primary_dialect: { id: 3, name: '莆仙方言', qualified_code: '闽.莆仙' },
};

async function openOnboarding(page, theme) {
  await page.setViewportSize({ width: 390, height: 844 });
  await installVisualFixture(page, { persona: 'member', theme });
  await openVisualRoute(page, '/pages/users/onboarding', { persona: 'member' });
  await page.evaluate(() => {
    window.onboardingToasts = [];
    window.onboardingSettled = 0;
    const showToast = uni.showToast.bind(uni);
    uni.showToast = (options) => {
      window.onboardingToasts.push(options.title);
      return showToast(options);
    };
    const request = uni.request.bind(uni);
    uni.request = (options) => {
      const pending = request(options);
      if (options.method !== 'PUT' || !options.url.endsWith('/users/7')) return pending;
      return pending.finally(() => {
        // Observe after the service and page continuations have settled.
        setTimeout(() => { window.onboardingSettled += 1; }, 0);
      });
    };
  });
  await page.getByRole('button', { name: '继续选择主方言', exact: true }).click();
  await expect(page.getByRole('button', { name: '完成设置', exact: true })).toBeVisible();
}

['light', 'dark'].forEach((theme) => {
  ['success', 'failure'].forEach((outcome) => {
    test(`onboarding logout survives a delayed ${outcome} in ${theme}`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await openOnboarding(page, theme);
      let releaseSave;
      const gate = new Promise((resolve) => { releaseSave = resolve; });
      let started = false;
      await page.route('**/users/7', async (route) => {
        if (route.request().method() !== 'PUT') { await route.fallback(); return; }
        started = true;
        await gate;
        await route.fulfill(outcome === 'success'
          ? { json: { token: 'late-profile-token', user: profile } }
          : { status: 401, json: { message: '旧请求已失效' } });
      });
      await page.getByRole('button', { name: '完成设置', exact: true }).click();
      await expect.poll(() => started).toBe(true);
      await page.getByText('退出账号，返回游客模式', { exact: true }).click();
      await expect(page).toHaveURL(/\/pages\/search$/);
      releaseSave();
      await page.waitForFunction(() => window.onboardingSettled === 1);
      expect(await page.evaluate(() => ({
        token: uni.getStorageSync('token'),
        id: uni.getStorageSync('id'),
        user: getApp().globalData.userInfo,
        toasts: window.onboardingToasts,
      }))).toEqual({
        token: '', id: '', user: undefined, toasts: [],
      });
      await expect(page).toHaveURL(/\/pages\/search$/);
      // A late 401 must not schedule the transport's delayed login redirect.
      if (outcome === 'failure') await page.waitForTimeout(1100);
      await expect(page).toHaveURL(/\/pages\/search$/);
      expect(pageErrors).toEqual([]);
    });
  });

  test(`onboarding save failure stays editable and retries in ${theme}`, async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await openOnboarding(page, theme);
    let attempts = 0;
    await page.route('**/users/7', async (route) => {
      if (route.request().method() !== 'PUT') { await route.fallback(); return; }
      attempts += 1;
      await route.fulfill(attempts === 1
        ? { status: 503, json: { message: '网络暂时中断，请重试' } }
        : { json: { token: 'saved-profile-token', user: profile } });
    });
    await page.getByRole('button', { name: '完成设置', exact: true }).click();
    await expect(page.locator('.error')).toHaveText('网络暂时中断，请重试');
    await expect(page.getByRole('button', { name: '完成设置', exact: true })).toBeEnabled();
    await page.screenshot({ path: `/tmp/xsb-onboarding-save-retry-${theme}.png`, fullPage: true });
    await page.getByRole('button', { name: '完成设置', exact: true }).click();
    await expect(page).toHaveURL(/\/pages\/users\/recommend-follow$/);
    expect(attempts).toBe(2);
    expect(await page.evaluate(() => uni.getStorageSync('token'))).toBe('saved-profile-token');
    expect(pageErrors).toEqual([]);
  });
});
