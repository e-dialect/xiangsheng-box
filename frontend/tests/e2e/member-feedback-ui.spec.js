import { expect, test } from '@playwright/test';
import { installVisualFixture, openVisualRoute, horizontalOverflow } from './helpers/visualReviewFixture';

for (const theme of ['light', 'dark']) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const label = `${theme}-${viewport.width}`;
    test(`record toolbar stays accessible and draft saving stays private in ${label}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await installVisualFixture(page, { persona: 'member', theme });
      await openVisualRoute(page, '/pages/recordings/create?dialect_id=3', { persona: 'member' });
      let submitted = 0;
      page.on('request', (request) => {
        if (request.method() === 'POST' && /\/recordings\/$/.test(new URL(request.url()).pathname)) submitted += 1;
      });
      await expect(page.getByRole('button', { name: '选择本地录音', exact: true })).toBeVisible();
      await page.locator('textarea').first().fill('只保存为本地草稿');
      await page.getByRole('button', { name: '提交并公开', exact: true }).scrollIntoViewIfNeeded();
      const toolbar = page.locator('.record-tools');
      await expect(toolbar).toBeInViewport();
      const tools = await toolbar.boundingBox();
      const content = await page.locator('.platform-scroll--app-shell').boundingBox();
      expect(tools.y).toBeGreaterThanOrEqual(content.y - 1);
      const save = page.getByRole('button', { name: '保存草稿', exact: true });
      await expect(save).toBeInViewport();
      await save.click();
      await expect(page.locator('.t-toast')).toContainText('草稿已保存');
      await expect(page.locator('.record-draft-message')).toHaveCount(0);
      expect(submitted).toBe(0);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`record-${label}.png`) });
    });

    test(`dialect selector offers an explicit parent action in ${label}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await installVisualFixture(page, { persona: 'member', theme });
      await openVisualRoute(page, '/pages/recordings/create?dialect_id=3', { persona: 'member' });
      await page.getByRole('button', { name: '选择使用地区', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '选择使用地区' });
      await expect(dialog.getByText('默认与最近使用', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: '返回上一级', exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`dialect-${label}.png`) });
      await dialog.getByRole('button', { name: '返回上一级', exact: true }).click();
      await expect(dialog.locator('.dialect-selector__current-name')).toHaveText('闽语');
      await dialog.getByRole('button', { name: '就选这里', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await page.getByRole('button', { name: '选择使用地区', exact: true }).click();
      await expect(page.locator('.dialect-selector__current-name')).toHaveText('闽语');
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });
    test(`onboarding actions stay balanced in ${label}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await installVisualFixture(page, { persona: 'member', theme });
      await openVisualRoute(page, '/pages/users/onboarding?reason=missing_dialect', { persona: 'member' });
      await page.getByRole('button', { name: '继续选择主方言', exact: true }).click();
      await expect(page.getByText('选择你日常最常说的方言。', { exact: true })).toBeVisible();
      const back = await page.getByRole('button', { name: '上一步', exact: true }).boundingBox();
      const finish = await page.getByRole('button', { name: '完成设置', exact: true }).boundingBox();
      expect(Math.abs(back.width - finish.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.height - finish.height)).toBeLessThanOrEqual(1);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`onboarding-${label}.png`) });
    });
  }
  test(`list and detail keep the same restriction in ${theme}`, async ({ page }, testInfo) => {
    await installVisualFixture(page, { persona: 'guest', theme });
    // Layer over the existing mocked response without touching production data.
    await page.route('**/recordings/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (!pathname.startsWith('/recordings/')) { await route.fallback(); return; }
      const data = {
        id: 11, original_gloss: '害怕', visibility: true, status: 'draft',
        rights_statement: '仅用于核查，不对外使用', usage_dialect: { id: 3, name: '莆仙方言' },
      };
      await route.fulfill({ json: /\/recordings\/\d+\/$/.test(pathname) ? data : { count: 1, results: [data] } });
    });
    await openVisualRoute(page, '/');
    await expect(page.locator('.recording-card').first()).toContainText('仅用于核查，不对外使用');
    await page.getByRole('button', { name: '录音详情', exact: true }).first().click();
    await expect(page.locator('.recording-context')).toContainText('仅用于核查，不对外使用');
    await expect(page.getByText('贡献者原始大意', { exact: true })).toBeVisible();
    await expect(page.locator('.recording-context')).toContainText('初稿·待核对');
    await page.screenshot({ path: testInfo.outputPath(`context-${theme}.png`) });
  });
  test(`fixture audio actually starts in ${theme}`, async ({ page }) => {
    await page.addInitScript(() => {
      window.testAudioStarted = false;
      const nativePlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function play() {
        this.addEventListener('playing', () => { window.testAudioStarted = true; }, { once: true });
        return nativePlay.call(this);
      };
    });
    await installVisualFixture(page, { persona: 'guest', theme });
    await openVisualRoute(page, '/');
    await page.getByRole('button', { name: '听录音', exact: true }).first().click();
    await expect.poll(() => page.evaluate(() => window.testAudioStarted)).toBe(true);
  });
}
