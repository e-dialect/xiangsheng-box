import { expect, test } from '@playwright/test';
import { installVisualFixture, openVisualRoute } from './helpers/visualReviewFixture';

['light', 'dark'].forEach((theme) => {
  test(`region retry preserves the contribution in ${theme}`, async ({ page }, testInfo) => {
    await installVisualFixture(page, { persona: 'member', theme });
    let fail = true;
    await page.route('**/dialects/?*', async (route) => {
      if (!fail) { await route.fallback(); return; }
      await route.fulfill({ status: 503, json: { message: '暂时不可用' } });
    });
    await openVisualRoute(page, '/', { persona: 'member' });
    await page.evaluate(() => { getApp().globalData.userInfo.primary_dialect = null; });
    await page.evaluate(() => uni.navigateTo({ url: '/pages/recordings/create' }));
    await expect(page.getByText('重新加载地区', { exact: true })).toBeVisible();
    await page.locator('textarea:visible').first().fill('网络恢复后保留的大意');
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('选择已有录音', { exact: true }).click();
    const wav = Buffer.alloc(16044);
    wav.write('RIFF'); wav.writeUInt32LE(16036, 4); wav.write('WAVE', 8);
    wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
    wav.writeUInt32LE(16000, 40);
    await (await chooser).setFiles({ name: 'retry.wav', mimeType: 'audio/wav', buffer: wav });
    await expect(page.getByText('播放录音', { exact: true })).toBeVisible();
    await expect(page.getByText('暂时不可用', { exact: true })).toBeHidden();
    await page.locator('#record-required-dialect').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`region-error-${theme}.png`) });
    fail = false;
    await page.getByText('重新加载地区', { exact: true }).click();
    await expect(page.getByText('重新加载地区', { exact: true })).toHaveCount(0);
    await page.getByText('请选择已知范围', { exact: true }).click();
    await page.getByRole('dialog', { name: '选择使用地区' }).getByRole('textbox').fill('莆仙');
    await page.getByText('就选这里', { exact: true }).click();
    await expect(page.locator('#record-required-dialect')).toContainText('莆仙');
    await expect(page.locator('textarea:visible').first()).toHaveValue('网络恢复后保留的大意');
    await expect(page.getByText('播放录音', { exact: true })).toBeVisible();
    await expect(page.getByText('三项必要信息已齐，可以保存')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`region-recovered-${theme}.png`) });
  });
});
