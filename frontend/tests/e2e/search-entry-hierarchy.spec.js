import { expect, test } from '@playwright/test';

const enabledCapabilities = {
  listen_feed: true,
  entry_search: true,
  recording: true,
  usage_attestation: true,
  curation_workbench: true,
  wechat_auth: false,
};

const entries = [
  {
    id: 21,
    display_writing: '行',
    summary: '走；步行',
    status: 'reviewed',
    recording_count: 2,
    needs_audio: false,
    usage_dialect: { id: 3, name: '莆仙方言' },
  },
  {
    id: 22,
    display_writing: '行',
    summary: '金融机构或行业',
    status: 'draft',
    recording_count: 0,
    needs_audio: true,
    usage_dialect: { id: 4, name: '福州话' },
  },
];

const entry = {
  ...entries[0],
  identity_note: '本条只收录“步行”义，不与金融机构用字合并。',
  attestation_count: 7,
  evidence_count: 4,
  is_bookmarked: false,
  senses: [{
    id: 1,
    sense_number: 1,
    gloss: '走；步行',
    usage_note: '常用于描述出门或赶路。',
    examples: [{ type: '例', content: '有出处的原文例句，不与其他义项合并。', explain: '这里只展示资料已有的解释。' }],
    concepts: [{ code: 'WALK', label: '行走' }],
  }],
  writings: [{
    id: 2,
    writing: { text: '行', form_type: 'orthographic' },
  }],
  pronunciation_variants: [{
    id: 3,
    dialect: { id: 3, name: '莆仙方言' },
    surface_romanization: 'giang',
    ipa: 'kiaŋ',
  }],
};

async function routeCapabilities(page, overrides = {}) {
  await page.route('**/site-settings/capabilities', async (route) => {
    await route.fulfill({
      json: {
        version: 1,
        capabilities: { ...enabledCapabilities, ...overrides },
        updated_at: '2026-09-05T00:00:00Z',
        cache_seconds: 300,
      },
    });
  });
}

async function routeBackgroundRequests(page) {
  await page.route('**/product-events/', async (route) => {
    await route.fulfill({ status: 202, json: { accepted: 1 } });
  });
  await page.route('**/dialects/**', async (route) => {
    await route.fulfill({ json: { count: 0, results: [] } });
  });
}

for (const width of [390, 1440]) {
  test(`entry examples remain readable on Web at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await routeCapabilities(page);
    await routeBackgroundRequests(page);
    await page.route('**/entries/21/**', (route) => route.fulfill({ json: entry }));
    await page.route(/\/recordings\/(?:\?.*)?$/, (route) => route.fulfill({
      json: { count: 0, next: null, results: [] },
    }));
    await page.goto('/pages/entries/details?id=21');
    const examples = page.locator('.sense-examples');
    await expect(examples).toBeVisible();
    await expect(examples).toContainText('有出处的原文例句，不与其他义项合并。');
    await expect(examples).toContainText('这里只展示资料已有的解释。');
    const bounds = await examples.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/xsb-web-examples-${width}.png`, fullPage: true });
  });
}

test('search moves from one clue to separate same-writing results', async ({ page }) => {
  await routeCapabilities(page);
  await routeBackgroundRequests(page);
  await page.route(/\/entries\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { count: 2, next: null, results: entries } });
  });

  await page.goto('/pages/search');

  const input = page.locator('.entry-search__bar input');
  const initial = page.locator('[data-search-state="initial"]');
  const filters = page.locator('.entry-search__advanced');
  await expect(page.getByText('从一个线索开始')).toBeVisible();
  expect((await input.boundingBox()).y).toBeLessThan((await initial.boundingBox()).y);
  expect((await initial.boundingBox()).y).toBeLessThan((await filters.boundingBox()).y);

  await page.getByRole('button', { name: '试试：行' }).click();

  await expect(page.getByText('找到 2 个独立词条')).toBeVisible();
  await expect(page.getByRole('button', { name: '查看词条：行' })).toHaveCount(2);
  const states = await page.locator('[data-search-state]').evaluateAll(
    (nodes) => nodes.map((node) => node.dataset.searchState),
  );
  expect(states).toEqual(['summary', 'results']);
  expect(await page.locator('[data-search-state="summary"]').boundingBox())
    .toMatchObject({ y: expect.any(Number) });
  expect((await page.locator('[data-search-state="summary"]').boundingBox()).y)
    .toBeLessThan((await filters.boundingBox()).y);
});

test('search failures and empty results each provide a clear next step', async ({ page }) => {
  await routeCapabilities(page);
  await routeBackgroundRequests(page);
  let requestCount = 0;
  await page.route(/\/entries\/(?:\?.*)?$/, async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.fulfill({ status: 503, json: { detail: 'unavailable' } });
      return;
    }
    await route.fulfill({ json: { count: 0, next: null, results: [] } });
  });

  await page.goto('/pages/search?keywords=%E8%A1%8C');
  await expect(page.locator('[data-search-state="error"]')).toBeVisible();
  await page.getByRole('button', { name: '重新查询' }).click();
  await expect(page.locator('[data-search-state="empty"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '录一段，让大家帮忙整理' })).toBeVisible();
});

test('a disabled search flow leads back to the working listening surface', async ({ page }) => {
  await routeCapabilities(page, { entry_search: false });
  await routeBackgroundRequests(page);

  await page.goto('/pages/search?keywords=%E8%A1%8C');
  await expect(page.locator('[data-search-state="error"]')).toBeVisible();
  await page.getByRole('button', { name: '返回听乡音' }).click();
  await expect(page).toHaveURL(/\/(?:pages\/index)?$/);
});

test('entry detail presents recordings before pronunciation, evidence and actions', async ({ page }) => {
  await routeCapabilities(page);
  await routeBackgroundRequests(page);
  await page.route('**/entries/21/**', async (route) => {
    await route.fulfill({ json: entry });
  });
  await page.route(/\/recordings\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: { count: 0, next: null, results: [] } });
  });

  await page.goto('/pages/entries/details?id=21');

  const sections = page.locator('[data-detail-section]');
  await expect(sections).toHaveCount(5);
  expect(await sections.evaluateAll(
    (nodes) => nodes.map((node) => node.dataset.detailSection),
  )).toEqual(['meaning', 'recordings', 'pronunciation', 'evidence', 'actions']);
  await expect(page.getByText('整理状态与证据')).toBeVisible();
  await expect(page.getByText('本条只收录“步行”义，不与金融机构用字合并。')).toBeVisible();
  await expect(page.getByRole('button', { name: '录下我这边的说法' })).toBeVisible();
});

test('entry detail keeps later regional recordings reachable and retries a failed page', async ({ page }) => {
  await routeCapabilities(page);
  await routeBackgroundRequests(page);
  await page.route('**/entries/21/**', (route) => route.fulfill({ json: entry }));
  let pageTwoRequests = 0;
  const makeRecording = (id, name) => ({
    id,
    original_gloss: `${name}真人样例`,
    recording_type: 'word',
    usage_dialect: { id, name },
    entry_links: [],
    audio_url: '',
  });
  await page.route(/\/recordings\/(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('page') === '2') {
      pageTwoRequests += 1;
      if (pageTwoRequests === 1) {
        await route.fulfill({ status: 503, json: { detail: 'unavailable' } });
        return;
      }
      await route.fulfill({ json: { count: 2, next: null, results: [makeRecording(12, '仙游')] } });
      return;
    }
    await route.fulfill({
      json: {
        count: 2,
        next: '/recordings/?entry_id=21&page=2&page_size=50',
        results: [makeRecording(11, '莆田')],
      },
    });
  });
  await page.goto('/pages/entries/details?id=21');
  await expect(page.getByText('莆田真人样例', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '听更多乡音', exact: true }).click();
  await expect(page.getByText('更多乡音暂时没加载出来，已显示的录音仍可播放。请重试。')).toBeVisible();
  await expect(page.getByText('莆田真人样例', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重试加载更多乡音', exact: true }).click();
  await expect(page.getByText('仙游真人样例', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="load-more-recordings"]')).toHaveCount(0);
  expect(pageTwoRequests).toBe(2);
});
