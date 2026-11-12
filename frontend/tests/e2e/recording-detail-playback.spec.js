import { expect, test } from '@playwright/test';
import { installVisualFixture, openVisualRoute } from './helpers/visualReviewFixture';

['light', 'dark'].forEach((theme) => {
  [390, 1440].forEach((width) => {
    test(`detail playback stops before contributor navigation at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await installVisualFixture(page, { theme });
      await page.addInitScript(() => {
        window.testAudio = [];
        window.Audio = class extends EventTarget {
          constructor(src) {
            super();
            this.src = src;
            this.paused = true;
            window.testAudio.push(this);
          }

          play() {
            this.paused = false;
            return Promise.resolve();
          }

          pause() {
            this.paused = true;
          }
        };
      });
      await page.route('**/recordings/11/', async (route) => {
        await route.fulfill({
          json: {
            id: 11,
            audio_url: '/test-recording.mp3',
            original_gloss: '没有关联词条的乡音',
            visibility: true,
            recorder: { id: 12, nickname: '乡音记录者' },
            entry_links: [],
          },
        });
      });
      await openVisualRoute(page, '/pages/recordings/details?id=11');
      await page.getByRole('button', { name: '听录音', exact: true }).click();
      await expect(page.getByRole('button', { name: '停止', exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.testAudio.some((audio) => !audio.paused))).toBe(true);
      await page.getByRole('button', { name: '听这位乡友的录音', exact: true }).click();
      await expect(page).toHaveURL(/\/pages\/users\/details\?id=12$/);
      await expect(page.locator('.profile-overview')).toBeVisible();
      await expect.poll(() => page.evaluate(() => (
        window.testAudio.every((audio) => audio.paused && !audio.src)
      ))).toBe(true);
      await page.goBack();
      await expect(page).toHaveURL(/\/pages\/recordings\/details\?id=11$/);
      await page.getByRole('button', { name: '听录音', exact: true }).click();
      await expect(page.getByRole('button', { name: '停止', exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.testAudio.some((audio) => !audio.paused))).toBe(true);
      await page.getByRole('button', { name: '听这位乡友的录音', exact: true }).click();
      await expect(page).toHaveURL(/\/pages\/users\/details\?id=12$/);
      await expect(page.locator('.profile-overview')).toBeVisible();
      await expect.poll(() => page.evaluate(() => (
        window.testAudio.every((audio) => audio.paused && !audio.src)
      ))).toBe(true);
    });
  });
});
