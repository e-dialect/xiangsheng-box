import { expect, test } from '@playwright/test';
import { installVisualFixture, openVisualRoute, horizontalOverflow } from './helpers/visualReviewFixture';

const pages = [
  { target: '/', slug: 'listen', persona: 'guest', ready: '.recording-card' },
  { target: '/pages/search', slug: 'search', persona: 'guest', ready: '.entry-search__prompt' },
  { target: '/pages/entries/details?id=21', slug: 'entry', persona: 'guest', ready: '.entry-hero' },
  { target: '/pages/recordings/create?dialect_id=3', slug: 'record', persona: 'member', ready: '.record-form' },
  { target: '/pages/users/me', slug: 'mine', persona: 'member', ready: '.works' },
];

for (const theme of ['light', 'dark']) {
  for (const item of pages) {
    test(`${item.slug} has a readable ${theme} core layout`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await installVisualFixture(page, { persona: item.persona, theme });
      await openVisualRoute(page, item.target, { persona: item.persona });
      await expect(page.locator(item.ready).first()).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
      if (item.slug === 'listen') {
        const play = page.getByRole('button', { name: '听录音', exact: true }).first();
        await expect(play).toBeInViewport();
        const bounds = await play.boundingBox();
        const nav = await page.locator('.home-tab-bar').boundingBox();
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(nav.y);
      }
      if (item.slug === 'entry') {
        const order = await page.locator('[data-detail-section]').evaluateAll(
          (nodes) => nodes.map((node) => node.dataset.detailSection),
        );
        expect(order.indexOf('recordings')).toBeLessThan(order.indexOf('pronunciation'));
      }
      if (item.slug === 'record') {
        await expect(page.getByText('说一个日常用的词或短句，最长 15 秒')).toBeVisible();
        const recordButton = await page.locator('.record-primary.t-button').boundingBox();
        expect(recordButton.width).toBeGreaterThanOrEqual(88);
        expect(Math.abs(recordButton.width - recordButton.height)).toBeLessThanOrEqual(1);
        await page.getByRole('button', { name: '提交并公开', exact: true }).scrollIntoViewIfNeeded();
        await expect(page.getByText('草稿仅保存在当前设备，不会公开。')).toBeVisible();
        await expect(page.getByRole('button', { name: '保存草稿', exact: true })).toHaveCount(1);
      }
      // Capture the initial screen, then check every supported shell size.
      await page.locator('.platform-scroll, .shell-content, .app-shell__content').evaluateAll(
        (nodes) => nodes.forEach((node) => { node.scrollTop = 0; }),
      );
      await page.screenshot({ path: testInfo.outputPath(`${item.slug}-${theme}.png`) });
      for (const viewport of [
        { width: 844, height: 390 },
        { width: 768, height: 1024 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(viewport);
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
      }
      expect(errors).toEqual([]);
    });
  }
  test(`featured audio uses the ${theme} listening layout`, async ({ page }, testInfo) => {
    await installVisualFixture(page, { persona: 'guest', theme });
    await openVisualRoute(page, '/');
    await page.getByRole('button', { name: '今日精选', exact: true }).click();
    const featured = page.locator('.recording-feed__discovery .recording-card');
    await expect(featured).toBeVisible();
    await expect(featured.getByRole('button', { name: '听录音', exact: true })).toBeInViewport();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`featured-${theme}.png`) });
  });
}
