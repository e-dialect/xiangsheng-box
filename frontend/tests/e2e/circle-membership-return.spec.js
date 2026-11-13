import { expect, test } from '@playwright/test';
import { installVisualFixture, openVisualRoute } from './helpers/visualReviewFixture';

const circle = {
  id: 664,
  name: '莆仙返回同步圈',
  description: '用于验证返回目录后的成员状态。',
  dialect: { id: 3, name: '莆仙方言' },
  is_member: false,
  member_count: 3,
  recording_count: 0,
};
const secondCircle = { ...circle, id: 665, name: '莆仙分页保留圈' };

['light', 'dark'].forEach((theme) => {
  test(`circle membership survives detail return and failures (${theme})`, async ({ page }, testInfo) => {
    const pageErrors = [];
    const unexpectedRequests = [];
    const mutations = [];
    const listQueries = [];
    let current = { ...circle };
    let failNext = false;
    page.on('pageerror', (error) => pageErrors.push(error.message));
    // Never let synthetic account tokens or mutations reach a real service.
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (['localhost', '127.0.0.1'].includes(url.hostname)
        && !['xhr', 'fetch'].includes(route.request().resourceType())) {
        await route.continue();
        return;
      }
      unexpectedRequests.push(route.request().url());
      await route.abort();
    });
    await installVisualFixture(page, { persona: 'member', theme });
    await page.route(/\/circles\/(?:\?.*)?$/, async (route) => {
      const params = new URL(route.request().url()).searchParams;
      listQueries.push({ search: params.get('search'), page: params.get('page') });
      const more = params.get('page') === '2';
      // Deliberately stale directory data: returning must reconcile without a refetch.
      await route.fulfill({
        json: {
          count: 2,
          next: more ? null : 'http://localhost:8000/circles/?page=2&search=莆仙',
          results: more ? [secondCircle] : [circle],
        },
      });
    });
    await page.route('**/circles/664/', (route) => route.fulfill({ json: current }));
    await page.route(/\/circles\/664\/recordings\/(?:\?.*)?$/, (route) => route.fulfill({
      json: { count: 0, next: null, results: [] },
    }));
    await page.route('**/circles/664/membership/', async (route) => {
      const method = route.request().method();
      mutations.push(method);
      if (failNext) {
        failNext = false;
        await route.fulfill({ status: 503, json: { message: '测试操作失败，请重试' } });
        return;
      }
      current = { ...circle, is_member: method === 'POST', member_count: method === 'POST' ? 4 : 3 };
      await route.fulfill({ json: current });
    });

    await openVisualRoute(page, '/pages/circles/index', { persona: 'member' });
    const directory = page.locator('.page-shell:visible');
    const search = directory.getByRole('textbox');
    await search.fill('莆仙');
    await directory.getByRole('button', { name: '搜索', exact: true }).click();
    await directory.getByRole('button', { name: '查看更多地区' }).click();
    await expect(directory.locator('.circle-card')).toHaveCount(2);
    expect(listQueries.slice(-2)).toEqual([
      { search: '莆仙', page: '1' }, { search: '莆仙', page: '2' },
    ]);
    const requestsBeforeReturn = listQueries.length;
    const card = directory.locator('.circle-card').filter({ hasText: circle.name });
    const assertDirectory = async (joined) => {
      await expect(page).toHaveURL(/\/pages\/circles\/index$/);
      await expect(search).toHaveValue('莆仙');
      await expect(directory.locator('.circle-card')).toHaveCount(2);
      await expect(card).toContainText(`${joined ? 4 : 3} 位成员`);
      await expect(card.getByRole('button', { name: joined ? '退出圈子' : '加入圈子', exact: true })).toBeVisible();
      await expect(card.locator('.circle-card__membership')).toHaveCount(joined ? 1 : 0);
      expect(listQueries).toHaveLength(requestsBeforeReturn);
    };
    const returnToDirectory = () => page.getByRole('button', { name: '返回', exact: true }).click();

    await card.getByRole('button', { name: '查看圈子' }).click();
    await page.getByRole('button', { name: '加入这个圈子' }).click();
    await expect(page.locator('.circle-hero__stats')).toContainText('4 位成员');
    await returnToDirectory();
    await assertDirectory(true);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`joined-return-${theme}.png`) });

    // The directory action must DELETE, never repeat POST against stale membership.
    await card.getByRole('button', { name: '退出圈子', exact: true }).click();
    await assertDirectory(false);
    expect(mutations).toEqual(['POST', 'DELETE']);
    await card.getByRole('button', { name: '加入圈子', exact: true }).click();
    await assertDirectory(true);
    await card.getByRole('button', { name: '查看圈子' }).click();
    await page.getByRole('button', { name: '退出这个圈子' }).click();
    await expect(page.locator('.circle-hero__stats')).toContainText('3 位成员');
    await returnToDirectory();
    await assertDirectory(false);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`left-return-${theme}.png`) });

    failNext = true;
    await card.getByRole('button', { name: '查看圈子' }).click();
    await page.getByRole('button', { name: '加入这个圈子' }).click();
    await expect(page.getByText('测试操作失败，请重试', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '加入这个圈子' })).toBeEnabled();
    await returnToDirectory();
    await assertDirectory(false);
    expect(mutations).toEqual(['POST', 'DELETE', 'POST', 'DELETE', 'POST']);
    expect(pageErrors).toEqual([]);
    expect(unexpectedRequests).toEqual([]);
  });
});
