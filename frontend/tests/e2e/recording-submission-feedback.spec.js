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
    await page.getByText('选择本地录音', { exact: true }).click();
    const firstChooser = await chooser;
    await expect(page.locator('.record-action')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('.record-primary')).toHaveAttribute('aria-disabled', 'true');
    await firstChooser.setFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: shortWav() });
    await expect(page.getByText('播放录音', { exact: true })).toBeVisible();
    await expect(page.locator('.record-action')).toHaveAttribute('aria-disabled', 'false');
    const replacement = page.waitForEvent('filechooser');
    await page.getByText('选择其他录音', { exact: true }).click();
    const replacementChooser = await replacement;
    await expect(page.locator('.record-ready-action--secondary')).toHaveAttribute('aria-disabled', 'true');
    await replacementChooser.setFiles({ name: 'replacement.wav', mimeType: 'audio/wav', buffer: shortWav() });
    await expect(page.locator('.record-action')).toHaveAttribute('aria-disabled', 'false');
    await expect(page.locator('.record-ready-action--secondary')).toHaveAttribute('aria-disabled', 'false');
    await expect(page.getByText('三项必要信息已齐，可以提交')).toBeVisible();
    await expect(page.getByText('保存草稿', { exact: true })).toBeEnabled();
    await page.getByText('同意并提交审核', { exact: true }).click();
    const message = page.locator('.record-draft-message');
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


['light', 'dark'].forEach((theme) => {
  test(`returned submission keeps its reason private and can be revised in ${theme}`, async ({ page }, testInfo) => {
    await installVisualFixture(page, { persona: 'member', theme });
    const media = 'ee606ad5-f3de-4a59-9350-f1951b5e4dfa';
    let revised = false;
    await page.route('**/recordings/11/', (route) => route.fulfill({
      json: {
        id: 11, original_gloss: '待修订的大意', visibility: false, media_id: media,
        status: revised ? 'draft' : 'rejected', can_withdraw: true, can_resubmit: !revised,
        audio_url: `http://localhost:8000/files/recording-media/${media}/`,
        review_reason: revised ? '' : '请补充原话的大意', entry_links: [],
      },
    }));
    await page.route('**/recordings/11/resubmit/', (route) => {
      const payload = route.request().postDataJSON();
      expect(payload.original_gloss).toBe('补充后的原话大意');
      expect(payload.publication_consent).toBe('public-display-v1');
      revised = true;
      return route.fulfill({ json: { status: 'draft' } });
    });
    let preview = false;
    await page.route('**/files/recording-media/*/', (route) => {
      expect(route.request().headers().authorization).toBe('Bearer visual-review-token');
      preview = true;
      return route.fulfill({ contentType: 'audio/wav', body: shortWav() });
    });
    await openVisualRoute(page, '/pages/recordings/details?id=11', { persona: 'member' });
    await expect(page.getByText('处理说明 · 请补充原话的大意')).toBeVisible();
    await expect(page.getByRole('button', { name: /分享乡音|复制乡音链接/ })).toHaveCount(0);
    await page.getByRole('button', { name: '听录音', exact: true }).click();
    await expect.poll(() => preview).toBe(true);
    await page.getByText('同意并重新提交审核', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`returned-${theme}.png`) });
    await page.locator('.box-panel textarea:visible').first().fill('补充后的原话大意');
    await page.getByRole('button', { name: '同意并重新提交审核' }).click();
    await expect(page.getByText('待审核', { exact: true })).toBeVisible();
    expect(revised).toBe(true);
  });
});
