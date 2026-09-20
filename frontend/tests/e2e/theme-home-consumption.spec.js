import { expect, test } from '@playwright/test';
import { installVisualFixture } from './helpers/visualReviewFixture';

test('home feed consumes card and avatar dress without rebuilding cached tabs', async ({ page }, testInfo) => {
  await installVisualFixture(page, {
    persona: 'guest', theme: 'light', preserveStorage: true,
  });
  await page.goto('/');
  await expect(page.locator('[data-feed-state="normal"]')).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem('ui_theme_overlay_local', '0');
    localStorage.setItem('ui_local_dress', JSON.stringify({
      cards: 'cards-paper',
      'cards-tag': 'cards-tag-chip',
      avatar: 'avatar-frame',
    }));
  });
  await page.reload();

  const card = page.locator('.home-page__feed:visible .recording-card').first();
  const avatar = card.locator('.avatar-frame');
  const dialect = card.locator('.recording-card__dialect');
  await expect(card).toBeVisible();
  await expect(avatar).toBeVisible();
  await expect(card).toHaveCSS('border-radius', '4px');
  await expect(avatar).toHaveCSS('border-top-width', '4px');
  await expect(dialect).toHaveCSS('border-top-width', '1px');
  await expect(card.locator('.recording-card__texture')).toHaveCSS(
    'background-size',
    '7.28px 7.28px',
  );

  await card.evaluate((node) => { node.setAttribute('data-theme-cache-probe', 'kept'); });
  await page.getByRole('tab', { name: '新近' }).click();
  await expect(page.locator('[data-feed-state="normal"]:visible')).toBeVisible();
  await page.getByRole('tab', { name: '全部' }).click();
  const returnedCard = page.locator('.home-page__feed:visible .recording-card').first();
  await expect(returnedCard).toHaveAttribute('data-theme-cache-probe', 'kept');

  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
    uni.$emit('theme-change', { accent: 'tea' });
  });
  await expect(returnedCard).toHaveAttribute('data-theme-cache-probe', 'kept');
  await expect(returnedCard).toHaveCSS('border-radius', '4px');

  await page.screenshot({
    path: testInfo.outputPath('h5-iphone-390x844.png'),
    fullPage: true,
  });
});
