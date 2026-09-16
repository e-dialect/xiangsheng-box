import { expect, test } from '@playwright/test';

const circle = {
  id: 4,
  name: '莆仙方言圈',
  description: '一起听、录和核对莆仙方言乡音。',
  dialect: { id: 2, name: '莆仙方言' },
  is_member: false,
  member_count: 18,
  recording_count: 3,
};

const entry = {
  id: 21,
  display_writing: '行',
  summary: '走；步行',
  pronunciation_variants: [{ surface_romanization: 'giang' }],
};

const recording = {
  id: 11,
  audio_url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA',
  original_gloss: '走路',
  recording_type: 'word',
  usage_dialect: { id: 2, name: '莆仙方言' },
  entry_links: [{ id: 31, role: 'primary', entry }],
};

const publicProfile = {
  user: {
    id: 9,
    avatar: '',
    nickname: '阿荔',
    username: 'field_li',
    primary_dialect: { id: 2, name: '莆仙方言' },
    follower_count: 12,
    following_count: 5,
    is_following: false,
  },
  contribution: { recordings: 3, entries: 2, senses: 0 },
};

async function routeBackgroundRequests(page) {
  await page.route('**/product-events/', async (route) => {
    await route.fulfill({ status: 202, json: { accepted: 1 } });
  });
}

test('circle directory leads from context and search into a real circle', async ({ page }) => {
  await routeBackgroundRequests(page);
  await page.route(/\/circles\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { count: 1, results: [circle] } });
  });
  await page.route('**/circles/4/', async (route) => {
    await route.fulfill({ json: circle });
  });
  await page.route(/\/circles\/4\/recordings\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { count: 1, results: [recording] } });
  });

  await page.goto('/pages/circles/index');

  const intro = page.locator('.circle-intro');
  const search = page.locator('.search-panel');
  const results = page.locator('[data-circle-state="results"]');
  await expect(page.getByText('找到与你乡音相连的圈子')).toBeVisible();
  await expect(page.getByText('莆仙方言圈', { exact: true })).toBeVisible();
  expect((await intro.boundingBox()).y).toBeLessThan((await search.boundingBox()).y);
  expect((await search.boundingBox()).y).toBeLessThan((await results.boundingBox()).y);

  await page.getByRole('button', { name: '查看圈子' }).click();
  await expect(page).toHaveURL(/\/pages\/circles\/details\?id=4$/);
  await expect(page.getByText('圈内录音')).toBeVisible();
  await expect(page.getByText('走路', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '录一段', exact: true })).toHaveCount(1);
});

test('circle directory exposes loading, failure, and empty next steps', async ({ page }) => {
  await routeBackgroundRequests(page);
  let requests = 0;
  await page.route(/\/circles\/(?:\?.*)?$/, async (route) => {
    requests += 1;
    if (requests === 1) {
      await new Promise((resolve) => { setTimeout(resolve, 1000); });
      await route.fulfill({ status: 503, json: { detail: 'unavailable' } });
      return;
    }
    await route.fulfill({ json: { count: 0, results: [] } });
  });

  await page.goto('/pages/circles/index');

  await expect(page.getByText('正在加载方言圈…')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible();
  await page.getByRole('button', { name: '重新加载' }).click();
  await expect(page.getByText('还没有匹配的方言圈')).toBeVisible();
  await expect(page.getByRole('button', { name: '去听乡音' })).toBeVisible();
});

test('circle detail keeps its context when recordings alone fail', async ({ page }) => {
  await routeBackgroundRequests(page);
  let recordingRequests = 0;
  await page.route('**/circles/4/', async (route) => {
    await new Promise((resolve) => { setTimeout(resolve, 1000); });
    await route.fulfill({ json: circle });
  });
  await page.route(/\/circles\/4\/recordings\/(?:\?.*)?$/, async (route) => {
    recordingRequests += 1;
    if (recordingRequests === 1) {
      await route.fulfill({ status: 503, json: { detail: 'unavailable' } });
      return;
    }
    await route.fulfill({ json: { count: 0, results: [] } });
  });

  await page.goto('/pages/circles/details?id=4');

  await expect(page.getByText('正在进入方言圈…')).toBeVisible();
  await expect(page.getByText('莆仙方言', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '重新获取录音' })).toBeVisible();
  await page.getByRole('button', { name: '重新获取录音' }).click();
  await expect(page.getByText('圈里还没有公开录音')).toBeVisible();
  await expect(page.getByRole('button', { name: '录第一段' })).toHaveCount(1);
});

test('public profile moves from recoverable error to an accessible contribution view', async ({ page }) => {
  await routeBackgroundRequests(page);
  let requests = 0;
  await page.route(/\/users\/9\/?(?:\?.*)?$/, async (route) => {
    requests += 1;
    if (requests === 1) {
      await new Promise((resolve) => { setTimeout(resolve, 1000); });
      await route.fulfill({ status: 503, json: { detail: 'unavailable' } });
      return;
    }
    await route.fulfill({ json: publicProfile });
  });

  await page.goto('/pages/users/details?id=9');

  await expect(page.getByText('正在读取用户档案…')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible();
  await page.getByRole('button', { name: '重新加载' }).click();
  await expect(page.getByText('阿荔', { exact: true }).last()).toBeVisible();
  await expect(page.locator('.avatar--fallback')).toHaveText('阿');
  await expect(page.getByRole('tab', { name: '录音 3', selected: true })).toBeVisible();

  await page.getByRole('tab', { name: '词条 2' }).press('Enter');
  await expect(page.getByRole('tab', { name: '词条 2', selected: true })).toBeVisible();
  await expect(page.getByText('参与 2 个词条')).toBeVisible();

  await page.getByRole('tab', { name: '义项 0' }).click();
  await expect(page.getByText('还没有公开义项', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '先去听乡音' })).toBeVisible();
});
