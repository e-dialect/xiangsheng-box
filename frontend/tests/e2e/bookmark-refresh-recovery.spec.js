import { expect, test } from '@playwright/test';
import { installVisualFixture, openVisualRoute, horizontalOverflow } from './helpers/visualReviewFixture';

for (const theme of ['light', 'dark']) {
  test(`bookmark removal keeps usable cards after refresh failure in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVisualFixture(page, { persona: 'member', theme });
    const item = (id) => ({
      id, display_writing: `收藏词条${id}`, summary: '可继续查看的原有收藏',
      status: 'reviewed', recording_count: 1, evidence_count: 0,
      usage_dialect: { id: 3, name: '莆田' },
    });
    let reads = 0;
    let deletes = 0;
    await page.route('**/entries/21/bookmark/', async (route) => {
      expect(route.request().method()).toBe('DELETE');
      deletes += 1;
      await route.fulfill({ json: { bookmarked: false } });
    });
    await page.route('**/entries/bookmarks/?*', async (route) => {
      reads += 1;
      expect(new URL(route.request().url()).searchParams.get('page')).toBe('1');
      if (reads === 2) {
        await route.fulfill({ status: 503, json: { message: 'offline' } });
        return;
      }
      await route.fulfill({ json: reads === 1
        ? { count: 3, next: '/entries/bookmarks/?page=2', results: [item(21), item(22)] }
        : { count: 2, next: null, results: [item(22), item(23)] } });
    });
    await openVisualRoute(page, '/pages/users/bookmarks', { persona: 'member' });
    await expect(page.locator('.bookmark-card')).toHaveCount(2);
    await page.getByRole('button', { name: '移出收藏：收藏词条21', exact: true }).click();
    await expect(page.getByText('列表暂时刷新失败，已显示的词条仍可查看。')).toBeVisible();
    await expect(page.locator('.bookmark-card')).toHaveCount(1);
    await expect(page.locator('.bookmark-card')).toContainText('收藏词条22');
    await expect(page.getByRole('button', { name: '查看更多收藏', exact: true })).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: `test-results/bookmark-refresh-${theme}.png`, fullPage: true });
    await page.getByRole('button', { name: '重新加载收藏列表', exact: true }).click();
    await expect(page.locator('.bookmark-card')).toHaveCount(2);
    await expect(page.getByRole('button', { name: '重新加载收藏列表', exact: true })).toHaveCount(0);
    expect(deletes).toBe(1);
    expect(reads).toBe(3);
  });
}
