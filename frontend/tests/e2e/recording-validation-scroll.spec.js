import { expect, test } from '@playwright/test';
import { installVisualFixture, openVisualRoute } from './helpers/visualReviewFixture';

['light', 'dark'].forEach((theme) => {
  [{ width: 390, height: 844 }, { width: 1440, height: 900 }].forEach((viewport) => {
    test(`missing recording step clears the sticky toolbar in ${theme}-${viewport.width}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await installVisualFixture(page, { persona: 'member', theme });
      await openVisualRoute(page, '/pages/recordings/create?dialect_id=3', { persona: 'member' });
      const submit = page.getByRole('button', { name: '提交并公开', exact: true });
      const section = page.locator('#record-required-audio');
      const toolbar = page.locator('.record-tools');
      const assertMissingStepVisible = async () => {
        await submit.click();
        await expect(section.getByRole('alert')).toHaveText('请先录音或选择一段音频');
        await expect.poll(async () => {
          const target = await section.boundingBox();
          const tools = await toolbar.boundingBox();
          return target.y - tools.y - tools.height;
        }).toBeGreaterThanOrEqual(-1);
        await expect(section.getByText('录下这句乡音', { exact: true })).toBeInViewport();
        await expect(page.getByRole('button', { name: '选择本地录音', exact: true })).toBeInViewport();
      };
      await assertMissingStepVisible();
      await assertMissingStepVisible();
      await page.screenshot({ path: testInfo.outputPath(`validation-${theme}-${viewport.width}.png`) });
    });
  });
});
