import { expect, test } from '@playwright/test';
import { installVisualFixture } from './helpers/visualReviewFixture';

const box = process.env.E2E_BOX_PROFILE_URL;
const pxm = process.env.E2E_PXM_PROFILE_URL;
const general = process.env.E2E_GENERAL_PROFILE_URL;
const brand = (page) => page.locator('.product-brand:visible .product-brand__name').first();
const credit = (page) => page.locator('.product-brand:visible .product-brand__credit').first();
const boxName = '乡声集盒内测版';
const pxmName = '兴化语记 2.0 内测版';

test.skip(!box || !pxm, 'requires one H5 build on both allowed origins');

test('both beta hosts keep their brand through refresh, switching, and public navigation', async ({ page }) => {
  await page.goto(pxm);
  await expect(brand(page)).toHaveText(pxmName);
  await expect(credit(page)).toHaveText('powered by 乡声集盒');
  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.E2E_SCREENSHOT_DIR}/pxm-home-390.png` });
  }
  await expect(page).toHaveTitle(pxmName);
  await page.getByRole('button', { name: `切换到${boxName}` }).click();
  await expect(page).toHaveURL(new URL(box).href);
  await expect(brand(page)).toHaveText(boxName);
  await page.reload();
  await expect(brand(page)).toHaveText(boxName);
  await page.getByRole('button', { name: `切换到${pxmName}` }).click();
  await expect(page).toHaveURL(new URL(pxm).href);
  await page.goto(new URL('/pages/search?keywords=%E8%A1%8C', pxm).href);
  await expect(brand(page)).toHaveText(pxmName);
  await expect(page.locator('.entry-search__bar input')).toHaveValue('行');
  await expect(page.getByRole('button', { name: '地区：闽语 › 莆仙方言' })).toBeVisible();
  await page.getByRole('button', { name: '切换站点' }).click();
  await page.getByText(boxName, { exact: true }).click();
  await expect(page).toHaveURL(new URL('/pages/search?keywords=%E8%A1%8C&dialect=%E9%97%BD.%E8%8E%86%E4%BB%99&dialect_scope=subtree', box).href);
  await expect(brand(page)).toHaveText(boxName);
  await expect(page.locator('.entry-search__bar input')).toHaveValue('行');
});

test('a guest returns to the same branded detail from login and through cold-start fallback', async ({ page }) => {
  await installVisualFixture(page, {
    apiOrigin: process.env.E2E_PROFILE_API_URL || new URL(pxm).origin,
    passthroughPaths: ['/site-settings/product-profile'],
  });
  const detail = new URL('/pages/entries/details?id=21', pxm).href;
  await page.goto(detail);
  await expect(brand(page)).toHaveText(pxmName);
  const bookmark = page.getByRole('button', { name: /^(已收藏|收藏词条)$/ });
  await bookmark.click();
  await expect(page).toHaveURL(new URL('/pages/login/login', pxm).href);
  await expect(brand(page)).toHaveText(pxmName);
  await page.getByRole('button', { name: '暂不登录，返回浏览' }).click();
  await expect(page).toHaveURL(detail);
  await expect(bookmark).toBeVisible();
  await expect(brand(page)).toHaveText(pxmName);
  await page.reload();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(page).toHaveURL((url) => (
    url.origin === new URL(pxm).origin && ['/', '/pages/index'].includes(url.pathname)
  ));
  await expect(brand(page)).toHaveText(pxmName);
});

test('error and account routes remain branded and an unknown host uses the general profile', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(new URL('/pages/does-not-exist', pxm).href);
  await expect(page).toHaveURL((url) => (
    url.origin === new URL(pxm).origin && url.pathname === '/pages/error/not-found'
  ));
  await expect(brand(page)).toHaveText(pxmName);
  await expect(credit(page)).toBeVisible();
  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.E2E_SCREENSHOT_DIR}/pxm-error-dark-390.png` });
  }
  await page.getByRole('button', { name: '返回首页' }).click();
  await expect(brand(page)).toHaveText(pxmName);
  await page.goto(new URL('/pages/users/me', pxm).href);
  await expect(brand(page)).toHaveText(pxmName);
  await page.goto(new URL('/pages/recordings/create', pxm).href);
  await expect(brand(page)).toHaveText(pxmName);
  if (general) {
    await page.goto(general);
    await expect(brand(page)).toHaveText('乡声集盒');
    await expect(credit(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^切换/ })).toHaveCount(0);
  }
});
