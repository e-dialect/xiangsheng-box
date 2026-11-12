import { expect, test } from '@playwright/test';

test('cancelling direct login returns to its public collection without submitting', async ({ page }) => {
  await installVisualFixture(page);
  await page.route('**/collections/1/', (route) => route.fulfill({
    json: {
      id: 1,
      title: '合成公开集盒',
      description: '',
      is_public: true,
      editable: false,
      entry_count: 1,
      recording_count: 0,
      pending: [],
      sections: [{
        id: 1,
        entry: {
          id: 21, display_writing: '拜年', summary: '问候', recording_count: 0,
        },
        recording_count: 0,
        recordings: [],
      }],
    },
  }));
  let submissions = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/recordings/') {
      submissions += 1;
    }
  });
  await openVisualRoute(page, '/pages/collections/details?id=1');
  await page.evaluate(() => new Promise((resolve, reject) => {
    uni.setStorageSync('auth_intercept_intent', JSON.stringify({
      version: 1,
      action: 'record_recording',
      context: { entryId: 21 },
      createdAt: Date.now(),
      voluntary: false,
    }));
    uni.navigateTo({ url: '/pages/login/login', success: resolve, fail: reject });
  }));
  await expect(page).toHaveURL(/\/pages\/login\/login$/);
  await page.getByRole('button', { name: '暂不登录，返回浏览', exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/collections\/details\?id=1$/);
  expect(await page.evaluate(() => localStorage.getItem('auth_intercept_intent'))).toBeNull();
  expect(submissions).toBe(0);
});

test('guest can cancel an intercepted action and return to search', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_intercept_intent', JSON.stringify({
      version: 1,
      action: 'record_recording',
      context: { entryId: 9, page: 'entry_detail' },
      createdAt: Date.now(),
      voluntary: false,
    }));
  });

  await page.goto('/pages/login/login');
  await expect(page.getByText('你刚才想录制乡音，验证身份后会回到原来的位置。')).toBeVisible();
  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.E2E_SCREENSHOT_DIR}/auth-intent.png`,
      fullPage: true,
    });
  }

  await page.getByText('暂不登录，先去查词').click();

  await expect(page).toHaveURL(/\/pages\/search$/);
  await expect(page.locator('.entry-search__bar input')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('auth_intercept_intent'))).toBeNull();
});
