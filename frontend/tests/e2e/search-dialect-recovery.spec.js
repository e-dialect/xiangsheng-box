import { expect, test } from '@playwright/test';
import { installVisualFixture } from './helpers/visualReviewFixture';

['light', 'dark'].forEach((theme) => {
  ['error', 'empty'].forEach((state) => {
    test(`search keeps its results while region catalog recovers from ${state} in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await installVisualFixture(page, { theme });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      const searches = [];
      page.on('request', (request) => {
        if (new URL(request.url()).pathname === '/entries/') searches.push(request.url());
      });
      let releaseCatalog;
      const catalogGate = new Promise((resolve) => { releaseCatalog = resolve; });
      let catalogs = 0;
      await page.route(/\/dialects\/(?:\?.*)?$/, async (route) => {
        catalogs += 1;
        if (catalogs === 1) {
          await catalogGate;
          await route.fulfill(state === 'error'
            ? { status: 503, json: { detail: 'simulated catalog outage' } }
            : { json: { count: 0, results: [] } });
          return;
        }
        await route.fulfill({
          json: {
            count: 1,
            results: [{
              id: 3, name: '莆仙方言', qualified_code: '闽.莆仙', parent_id: null,
            }],
          },
        });
      });

      await page.goto('/pages/search?key=%E8%90%BD%E5%A4%A7%E9%9B%A8');
      await expect(page.getByText('找到 1 个独立词条')).toBeVisible();
      await page.getByText('高级筛选', { exact: true }).click();
      await expect(page.getByText('正在读取地区列表…', { exact: true })).toBeVisible();
      await page.locator('.entry-search__bar input').fill('尚未提交的词');
      await page.getByRole('button', { name: '待补音', exact: true }).click();
      releaseCatalog();

      const errorState = page.locator('.entry-search__advanced .empty-state');
      await expect(errorState).toContainText(state === 'error'
        ? '地区列表暂时无法读取' : '暂时没有可选地区');
      await expect(page.getByRole('button', { name: '重新加载地区', exact: true })).toBeVisible();
      await errorState.scrollIntoViewIfNeeded();
      const bounds = await errorState.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
      await page.screenshot({ path: `/tmp/xsb-search-regions-${state}-${theme}.png`, fullPage: true });
      await page.getByRole('button', { name: '重新加载地区', exact: true }).click();
      await expect(errorState).toHaveCount(0);
      await expect(page.locator('.entry-search__bar input')).toHaveValue('尚未提交的词');
      await expect(page.getByRole('button', { name: '待补音', exact: true })).toHaveClass(/base-button--primary/);
      await expect(page.getByText('找到 1 个独立词条')).toBeVisible();
      expect(searches).toHaveLength(1);
      expect(catalogs).toBe(2);

      await page.getByText('地区范围', { exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: '莆仙方言，选择这里', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByText('仅这个范围', { exact: true })).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  });
});
