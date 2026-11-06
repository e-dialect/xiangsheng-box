import { expect, test } from '@playwright/test';

function tinyWavDataUri() {
  return 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
}

const entry = {
  id: 21,
  display_writing: '巴适',
  summary: '安逸、舒服',
  status: 'verified',
  recording_count: 1,
  needs_audio: false,
  usage_dialect: { id: 3, name: '四川话' },
  writings: [{ id: 31, text: '巴适', writing_type: 'hanzi', is_preferred: true }],
  senses: [{ id: 41, order: 1, gloss: '安逸、舒服' }],
  concepts: [],
  pronunciation_variants: [{ id: 51, ipa: 'pa˥ sɿ˥' }],
};

const recording = {
  id: 11,
  audio_url: tinyWavDataUri(),
  original_gloss: '表示安逸、舒服',
  recording_type: 'word',
  usage_dialect: { id: 3, name: '四川话' },
  recorder: { id: 2, username: 'speaker', nickname: '录音人' },
  entry_links: [{ id: 61, role: 'primary', status: 'accepted', entry }],
};

test('guest listens to the Recording stream, opens an Entry, and searches entries', async ({ page }) => {
  await page.route(/\/recordings\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: { count: 1, next: null, previous: null, results: [recording] },
    });
  });
  await page.route('**/entries/21/**', async (route) => {
    await route.fulfill({ json: entry });
  });
  await page.route(/\/entries\/(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const results = url.searchParams.get('search') ? [entry] : [];
    await route.fulfill({
      json: { count: results.length, next: null, previous: null, results },
    });
  });
  await page.route('**/dialects/**', async (route) => {
    await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
  });

  await page.goto('/');
  await expect(page.getByRole('tab', { name: '全部', selected: true })).toBeVisible();
  await expect(page.getByText('巴适', { exact: true })).toBeVisible();
  await expect(page.getByText('表示安逸、舒服', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '听录音' }).click();
  await expect(page.getByRole('button', { name: '停止播放' })).toBeVisible();

  await page.getByRole('button', { name: '看词条' }).click();
  await expect(page).toHaveURL(/\/pages\/entries\/details\?id=21/);
  await expect(page.getByText('安逸、舒服', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('pa˥ sɿ˥', { exact: true }).first()).toBeVisible();

  await page.goto('/pages/search');
  const searchbox = page.locator('.entry-search__bar input');
  await searchbox.fill('巴适');
  await page.getByRole('button', { name: '查词条' }).click();
  await expect(page.getByText('找到 1 个独立词条')).toBeVisible();
  await expect(page.getByRole('button', { name: '查看词条：巴适' })).toBeVisible();
});
