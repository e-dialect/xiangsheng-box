import { expect, test } from '@playwright/test';
import { stableScreenshot } from './helpers/stableScreenshot';
import { installVisualFixture, observeRuntime, openVisualRoute } from './helpers/visualReviewFixture';

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

async function openColdRecordingLogin(page, context) {
  await installVisualFixture(page, { preserveStorage: true });
  await page.goto('/');
  await page.evaluate((savedContext) => {
    localStorage.setItem('auth_intercept_intent', JSON.stringify({
      version: 1,
      action: 'record_recording',
      context: savedContext,
      createdAt: Date.now(),
      voluntary: false,
    }));
  }, context);
  await page.goto('/pages/login/login');
  await expect(page.getByText('你刚才想录制乡音，验证身份后会回到原来的位置。')).toBeVisible();
}

test('cold cancellation restores the entry saved in a legacy recording intent', async ({ page }) => {
  await openColdRecordingLogin(page, { entryId: 21, page: 'entry_detail' });
  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.E2E_SCREENSHOT_DIR}/auth-intent.png`,
      fullPage: true,
    });
  }

  await page.getByRole('button', { name: '暂不登录，返回浏览', exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/entries\/details\?id=21$/);
  expect(await page.evaluate(() => localStorage.getItem('auth_intercept_intent'))).toBeNull();
});

test('cold cancellation without a recoverable public object falls back to search', async ({ page }) => {
  await openColdRecordingLogin(page, { page: 'record' });

  await page.getByRole('button', { name: '暂不登录，先去查词', exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/search$/);
  await expect(page.locator('.entry-search__bar input')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('auth_intercept_intent'))).toBeNull();
});

test('cancelling a guest bookmark returns to the same entry without bookmarking', async ({ page }) => {
  const runtimeIssues = observeRuntime(page);
  const bookmarkRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/entries/21/bookmark/') {
      bookmarkRequests.push(request.method());
    }
  });
  await installVisualFixture(page);
  const entryUrl = '/pages/entries/details?id=21';
  await openVisualRoute(page, entryUrl);
  const bookmark = page.getByRole('button', { name: /^(已收藏|收藏词条)$/ });
  await bookmark.click();
  await expect(page).toHaveURL(/\/pages\/login\/login$/);
  await expect(page.getByText('你刚才想收藏词条，验证身份后会回到原来的位置。')).toBeVisible();

  const browseFirst = page.getByRole('button', { name: '暂不登录，返回浏览' });
  await browseFirst.scrollIntoViewIfNeeded();
  await stableScreenshot(page, { path: 'test-results/guest-return-to-entry-390x844.png' });
  await browseFirst.click();

  await expect(page).toHaveURL(/\/pages\/entries\/details\?id=21$/);
  await expect(bookmark).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('auth_intercept_intent'))).toBeNull();
  expect(bookmarkRequests).toEqual([]);
  expect(runtimeIssues).toEqual([]);
});
test.describe('WeChat sign-in cold return', () => {
  for (const outcome of ['cancel', 'confirm']) {
    test(`same-origin ${outcome} restores the initiating entry after a full reload`, async ({ page }) => {
      await installVisualFixture(page, { preserveStorage: true });
      let confirmed = false;
      let cancellations = 0;
      const endpoint = '**/login/wechat/bridge';
      const response = (json, status = 200) => ({
        json, status, headers: { 'access-control-allow-origin': '*' },
      });
      await page.route(`${endpoint}/availability`, (route) => route.fulfill(response({ web: true, app: false })));
      await page.route(`${endpoint}/start`, (route) => route.fulfill(response({
        request_id: 'a'.repeat(32),
        exchange_key: 'b'.repeat(43),
        expires_at: new Date(Date.now() + 300000).toISOString(),
        reference: '432100',
        qr_image: 'data:image/png;base64,AA==',
      }, 201)));
      await page.route(`${endpoint}/exchange`, (route) => route.fulfill(confirmed
        ? response({ id: 7, token: 'visual-review-token', isNew: false })
        : response({ status: 'pending' }, 202)));
      await page.route(`${endpoint}/cancel`, (route) => {
        cancellations += 1;
        return route.fulfill(response({ status: 'cancelled' }));
      });

      const entryUrl = '/pages/entries/details?id=21';
      await openVisualRoute(page, entryUrl);
      const entry = new URL(page.url());
      await page.getByRole('button', { name: /^(已收藏|收藏词条)$/ }).click();
      await page.getByRole('button', { name: '微信登录', exact: true }).click();
      await expect(page.getByText('核对编号 432100')).toBeVisible();
      await page.reload();
      await expect(page.getByText('核对编号 432100')).toBeVisible();
      await page.evaluate(() => {
        const value = JSON.parse(localStorage.getItem('auth_intercept_intent'));
        value.context.entryId = 99;
        localStorage.setItem('auth_intercept_intent', JSON.stringify(value));
      });

      if (outcome === 'cancel') {
        await page.getByRole('button', { name: '取消微信登录', exact: true }).click();
        await expect.poll(() => cancellations).toBe(1);
      } else {
        confirmed = true;
      }
      await expect(page).toHaveURL(entry.href);
      await expect.poll(() => page.evaluate(() => ({
        loggedIn: Boolean(localStorage.getItem('token')),
        pending: Boolean(sessionStorage.getItem('wechat_login_request')),
        intent: Boolean(localStorage.getItem('auth_intercept_intent')),
      }))).toEqual({ loggedIn: outcome === 'confirm', pending: false, intent: false });
    });
  }
});
