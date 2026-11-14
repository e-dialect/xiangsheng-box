import { expect, test } from '@playwright/test';
import { installVisualFixture, observeRuntime, openVisualRoute } from './helpers/visualReviewFixture';

['light', 'dark'].forEach((theme) => {
  test(`draft text survives unavailable preview and audio recovers on reopening (${theme})`, async ({ page }, testInfo) => {
    const runtime = observeRuntime(page);
    await installVisualFixture(page, { persona: 'member', theme, preserveStorage: true });
    await openVisualRoute(page, '/', { persona: 'member' });
    await page.evaluate(async () => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('guantou-recording-drafts-v2', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('audio');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = database.transaction('audio', 'readwrite');
        transaction.objectStore('audio').put(new Blob(['fixture'], { type: 'audio/wav' }), 'restore-test');
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
      uni.setStorageSync('recording_drafts:v2:user:7', JSON.stringify([{
        id: 'restore-test',
        owner: 'user:7',
        form: { original_gloss: '音频暂时打不开也保留这句话', usage_dialect_id: 3 },
        entryId: 21,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        audio: {
          path: '', mediaId: 'restore-test', storage: 'indexeddb', persisted: true, durationMs: 1000,
        },
      }]));
      const { createObjectURL } = URL;
      URL.createObjectURL = function failOnce(blob) {
        URL.createObjectURL = createObjectURL;
        throw new Error(`Simulated unavailable preview (${blob.size})`);
      };
      uni.navigateTo({ url: '/pages/recordings/create?draft_id=restore-test' });
    });
    await expect(page.locator('textarea:visible').first()).toHaveValue('音频暂时打不开也保留这句话');
    await expect(page.getByText('文字已恢复，音频不可用，请重新选择或录制').first()).toBeVisible();
    await expect(page.getByText('落大雨', { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`unavailable-${theme}.png`), fullPage: true });
    await page.locator('textarea:visible').first().fill('音频暂时打不开时仍可以改文字');
    await expect.poll(() => page.evaluate(() => {
      const raw = uni.getStorageSync('recording_drafts:v2:user:7');
      const draft = raw ? JSON.parse(raw)[0] : null;
      return draft?.form.original_gloss;
    })).toBe('音频暂时打不开时仍可以改文字');
    const saved = await page.evaluate(() => uni.getStorageSync('recording_drafts:v2:user:7'));
    expect(JSON.parse(saved)[0].audio.mediaId).toBe('restore-test');
    await page.reload();
    await expect(page.locator('textarea:visible').first()).toHaveValue('音频暂时打不开时仍可以改文字');
    await expect(page.getByText('播放录音', { exact: true })).toBeVisible();
    await expect(page.getByText('落大雨', { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => uni.getStorageSync('recording_drafts:v2:user:7'))).toBe(saved);
    await page.screenshot({ path: testInfo.outputPath(`recovered-${theme}.png`), fullPage: true });
    expect(runtime).toEqual([]);
  });
});
