import { expect, test } from '@playwright/test';

const enabledCapabilities = {
  listen_feed: true,
  entry_search: true,
  recording: true,
  usage_attestation: true,
  curation_workbench: true,
  wechat_auth: true,
};

const recording = {
  id: 11,
  audio_url: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=',
  original_gloss: '表示安逸、舒服，也可以形容日子过得称心',
  recording_type: 'word',
  usage_dialect: { id: 3, name: '四川话' },
  entry_links: [{
    id: 61,
    role: 'primary',
    status: 'accepted',
    entry: {
      id: 21,
      display_writing: '巴适',
      pronunciation_variants: [{ id: 51, ipa: 'pa˥ sɿ˥' }],
    },
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

async function routeRecordings(page, response) {
  await page.route('**/recordings/**', async (route) => {
    await route.fulfill(response);
  });
}

test('normal listening view presents region, entry, original gloss, context, then actions', async ({ page }) => {
  await routeCapabilities(page);
  await routeRecordings(page, {
    json: {
      count: 1,
      next: null,
      previous: null,
      results: [recording],
    },
  });

  await page.goto('/');
  const normalState = page.locator('[data-feed-state="normal"]');
  await expect(normalState).toBeVisible();
  await expect(normalState.getByText('正在听', { exact: true })).toBeVisible();
  await expect(normalState.getByText('巴适', { exact: true })).toBeVisible();
  await expect(normalState.getByText('四川话', { exact: true })).toBeVisible();
  await expect(normalState.getByRole('button', { name: '听录音' })).toBeVisible();

  const positions = await normalState.evaluate((root) => {
    const top = (selector) => root.querySelector(selector).getBoundingClientRect().top;
    return {
      current: top('.recording-feed__list-heading'),
      entry: top('.recording-card__title'),
      region: top('.recording-card__meta'),
      gloss: top('.recording-card__gloss'),
      context: top('.recording-context'),
      actions: top('.recording-card__actions'),
    };
  });
  expect(positions.current).toBeLessThan(positions.region);
  expect(positions.region).toBeLessThan(positions.entry);
  expect(positions.entry).toBeLessThan(positions.gloss);
  expect(positions.gloss).toBeLessThan(positions.context);
  expect(positions.context).toBeLessThan(positions.actions);
});

test('empty and error states always provide a working next step', async ({ page }) => {
  await routeCapabilities(page);
  let attempts = 0;
  await page.route('**/recordings/**', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 503, json: { detail: 'temporary' } });
      return;
    }
    await route.fulfill({
      json: {
        count: 0,
        next: null,
        previous: null,
        results: [],
      },
    });
  });

  await page.goto('/');
  await expect(page.locator('[data-feed-state="error"]')).toBeVisible();
  await page.getByRole('button', { name: '重新加载' }).click();
  await expect(page.locator('[data-feed-state="empty"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '录下第一段' })).toBeVisible();
});

test('maintenance state routes people to an available primary task', async ({ page }) => {
  await routeCapabilities(page, { listen_feed: false });

  await page.goto('/');
  await expect(page.locator('[data-feed-state="maintenance"]')).toBeVisible();
  await page.getByRole('button', { name: '先去查词条' }).click();

  await expect(page).toHaveURL(/\/pages\/search$/);
});

test('loading skeleton is stable and stops looping for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await routeCapabilities(page);
  let releaseResponse;
  const responseReady = new Promise((resolve) => {
    releaseResponse = resolve;
  });
  await page.route('**/recordings/**', async (route) => {
    await responseReady;
    await route.fulfill({
      json: {
        count: 0,
        next: null,
        previous: null,
        results: [],
      },
    });
  });

  await page.goto('/');
  const loadingState = page.locator('[data-feed-state="loading"]');
  await expect(loadingState).toBeVisible();
  await expect(loadingState.locator('.recording-feed__skeleton-button')).toHaveCount(2);
  await expect(loadingState.locator('.recording-feed__skeleton-line').first()).toHaveCSS(
    'animation-name',
    'none',
  );

  releaseResponse();
  await expect(page.locator('[data-feed-state="empty"]')).toBeVisible();
});
