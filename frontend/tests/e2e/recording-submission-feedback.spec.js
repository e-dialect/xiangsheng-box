import { expect, test } from '@playwright/test';
import { installVisualFixture, openVisualRoute } from './helpers/visualReviewFixture';

function shortWav() {
  const frames = 8000;
  const wav = Buffer.alloc(44 + frames * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(frames * 2, 40);
  return wav;
}

['light', 'dark'].forEach((theme) => {
  test(`upload error keeps its server reason and readable toast in ${theme} theme`, async ({ page }, testInfo) => {
    await installVisualFixture(page, { persona: 'member', theme });
    let recordingsCreated = 0;
    await page.route('**/recordings/', async (route) => {
      if (route.request().method() === 'POST') recordingsCreated += 1;
      await route.fallback();
    });
    await page.route('**/files', async (route) => {
      await route.fulfill({
        status: 503,
        json: {
          code: 503, message: '上传服务暂不可用，请稍后重试', data: {}, request_id: 'upload-e2e',
        },
      });
    });
    await openVisualRoute(page, '/pages/recordings/create', { persona: 'member' });
    await page.locator('textarea:visible').first().fill('上传错误回归测试');
    const chooser = page.waitForEvent('filechooser');
    await page.getByText('选择已有录音', { exact: true }).click();
    await (await chooser).setFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: shortWav() });
    await expect(page.getByText('播放录音', { exact: true })).toBeVisible();
    await expect(page.getByText('三项必要信息已齐，可以保存')).toBeVisible();
    await expect(page.getByText('保存草稿', { exact: true })).toBeEnabled();
    await page.getByText('保存这段乡音', { exact: true }).click();
    const message = page.locator('.record-draft-actions [aria-live="polite"]');
    await expect(message).toContainText('提交失败：上传服务暂不可用，请稍后重试');
    await expect(message).toContainText('尚未加入个人贡献');
    await expect(message).toContainText('草稿已保存，可从草稿箱重试');
    await expect(message).not.toContainText('uploadFile:ok');
    const toast = page.locator('.t-toast');
    await expect(toast).toContainText('提交失败，请查看页面说明');
    const contrast = await toast.evaluate((element) => {
      const style = getComputedStyle(element);
      const numbers = (color) => color.match(/[\d.]+/g).map(Number);
      const fg = numbers(style.color);
      const bg = numbers(style.backgroundColor);
      // Composite translucent backdrop over white, the worst case for white text.
      const alpha = bg[3] ?? 1;
      const luminance = (rgb) => rgb.slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const a = luminance(fg);
      const b = luminance(bg.slice(0, 3).map((v) => v * alpha + 255 * (1 - alpha)));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    expect(recordingsCreated).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`feedback-${theme}.png`) });
  });
});
