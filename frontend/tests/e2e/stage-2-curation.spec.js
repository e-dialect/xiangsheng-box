import { expect, test } from '@playwright/test';
import { installVisualFixture, openVisualRoute, horizontalOverflow } from './helpers/visualReviewFixture';
import { stableScreenshot } from './helpers/stableScreenshot';

const original = { id: 3, name: '莆仙方言', qualified_code: '闽.莆仙', path_names: ['闽语', '莆仙方言'] };
const target = { id: 4, name: '莆田', qualified_code: '闽.莆仙.莆田', path_names: ['闽语', '莆仙方言', '莆田'] };
const source = { id: 91, source_type: 'book', original_text: '合成材料：该用法暂仅在莆田得到支持，其他地区待核实。', citation: '合成来源卡，第 2 页', created_at: '2026-10-17T00:00:00Z' };

async function setup(page, theme, evidence = source) {
  await installVisualFixture(page, { persona: 'member', theme });
  const state = { dialect: original, posts: [], action: null, denied: false, staff: false };
  await page.route('http://localhost:8000/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    // Match the string ID seeded by installVisualFixture during cold-page startup.
    if (pathname === '/login') return route.fulfill({ json: { token: 'visual-review-token', id: '7' } });
    if (pathname === '/users/7') return route.fulfill({ json: { user: {
      id: 7, username: 'curation-reviewer', nickname: '合成整理员',
      primary_dialect: original, is_staff: state.staff,
    } } });
    if (pathname === '/dialects/') return route.fulfill({ json: { results: [original, target], next: null } });
    if (pathname === '/entries/21/') return route.fulfill({ json: {
      id: 21, display_writing: '落大雨', summary: '合成范围修正验收材料', status: 'reviewed',
      usage_dialect: state.dialect, evidence_count: 1,
    } });
    if (pathname === '/evidence-records/') return route.fulfill({ json: { results: [evidence], next: null } });
    if (pathname === '/evidence-records/91/') return route.fulfill({ json: evidence });
    if (pathname === '/curation/') return route.fulfill({ json: { grants: state.staff ? [] : [
      { id: 71, is_active: true, role: 'regional_curator', dialect: original },
    ] } });
    if (pathname === '/curation/actions/' && route.request().method() === 'POST') {
      state.posts.push(route.request().postDataJSON());
      state.dialect = target;
      state.action = {
        id: 92, target_type: 'entry', target_id: 21, target_label: '落大雨',
        action_type: 'narrow_scope', actor: { id: 7 }, grant: null,
        reason: state.posts[0].reason, evidence_ids: [91],
        before_snapshot: { usage_dialect: original }, after_snapshot: { usage_dialect: target },
        authority_snapshot: { status: 'captured', mode: 'grant', role: 'regional_curator', dialect: original,
          captured_at: '2026-10-17T00:00:00Z', valid_from: '2026-10-01', valid_until: '2026-11-01' },
        created_at: '2026-10-17T00:00:00Z',
      };
      return route.fulfill({ status: 201, json: state.action });
    }
    if (pathname === '/curation/actions/') return route.fulfill({ json: { results: state.action ? [state.action] : [], next: null } });
    if (pathname === '/curation/actions/92/') return route.fulfill(state.denied
      ? { status: 404, json: { detail: 'Not found' } } : { json: state.action });
    return route.fallback();
  });
  return state;
}

async function openReview(page) {
  const base = process.env.E2E_H5_BASE || '/';
  if (base === '/') {
    await openVisualRoute(page, '/pages/curation/entry-review?entry_id=21', { persona: 'member' });
    return;
  }
  await page.goto(base);
  await page.waitForFunction(() => typeof getApp === 'function'
    && Number(getApp()?.globalData?.userInfo?.id) === 7);
  await page.evaluate(() => new Promise((resolve, reject) => uni.navigateTo({
    url: '/pages/curation/entry-review?entry_id=21', success: resolve, fail: reject,
  })));
}

for (const theme of ['light', 'dark']) {
  test(`pronunciation-only evidence and persisted history labels ${theme}`, async ({ page }, testInfo) => {
    const state = await setup(page, theme, {
      id: 91, source_type: 'user_statement', original_pronunciation: 'kiaⁿ2',
    });
    for (const [type, label] of [
      ['split_entry', '拆分'], ['merge_entries', '合并'], ['link_concept', '关联概念'],
    ]) {
      state.action = {
        id: 92, target_type: 'entry', target_id: 21, action_type: type,
        reason: '合成历史验证', evidence_ids: [91],
      };
      await openReview(page);
      await expect(page.getByText('原读音：kiaⁿ2', { exact: true })).toBeVisible();
      await expect(page.locator('.history-row')).toContainText(label);
      await page.getByRole('button', { name: '查看决定与依据', exact: true }).click();
      await expect(page.locator('.eyebrow')).toHaveText(label);
      await expect(page.getByText('原读音：kiaⁿ2', { exact: true })).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
    }
    await stableScreenshot(page, { path: testInfo.outputPath('pronunciation-history.png'), fullPage: true });
  });
}

for (const theme of ['light', 'dark']) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    test(`scope correction and independent trace ${theme} ${viewport.width}`, async ({ page }, testInfo) => {
      test.setTimeout(60000);
      await page.setViewportSize(viewport);
      const state = await setup(page, theme);
      const runtimeErrors = [];
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      await openReview(page);
      await expect(page.getByText(source.original_text, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '选择更细地区', exact: true })).toBeEnabled();
      await stableScreenshot(page, { path: testInfo.outputPath('entry-review.png'), fullPage: true });
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
      await page.getByRole('button', { name: '选为范围修正依据', exact: true }).click();
      await page.getByRole('button', { name: '选择更细地区', exact: true }).click();
      await page.getByRole('button', { name: '莆田，选择这里', exact: true }).click();
      await page.locator('textarea').fill('依据合成来源卡缩小到莆田，其他地区尚待核实。');
      await stableScreenshot(page, { path: testInfo.outputPath('scope-form.png'), fullPage: true });
      await page.getByRole('button', { name: '核对并提交范围修正', exact: true }).click();
      await expect(page.getByText('确认缩小地区范围', { exact: true })).toBeVisible();
      await page.locator('.t-dialog__button--confirm').waitFor({ state: 'visible' });
      await stableScreenshot(page, { path: testInfo.outputPath('confirmation.png'), fullPage: true });
      await page.locator('.t-dialog__button--confirm').click();
      await expect(page).toHaveURL(/\/pages\/curation\/action-detail\?id=92/);
      await expect(page.getByText('操作时授权', { exact: true })).toBeVisible();
      await expect(page.getByText(source.citation, { exact: false })).toBeVisible();
      expect(state.posts).toEqual([{
        action_type: 'narrow_scope', target_type: 'entry', target_id: 21,
        reason: '依据合成来源卡缩小到莆田，其他地区尚待核实。', evidence_ids: [91],
        changes: { dialect_id: 4 },
      }]);
      await stableScreenshot(page, { path: testInfo.outputPath('action-detail.png'), fullPage: true });
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
      await page.evaluate(() => {
        uni.setClipboardData = ({ data }) => { window.copiedActionUrl = data; };
      });
      await page.getByRole('button', { name: '复制此记录的站内链接', exact: true }).click();
      const copied = await page.evaluate(() => window.copiedActionUrl);
      const expected = new URL(`${process.env.E2E_H5_BASE || '/'}pages/curation/action-detail?id=92`, page.url()).href;
      expect(copied).toBe(expected);
      await page.goto(copied);
      await expect(page.getByText('操作时授权', { exact: true })).toBeVisible();
      // Re-enter via the handed-over entry link; no internal action ID is typed.
      await page.getByRole('button', { name: '返回词条来源与历史', exact: true }).click();
      await page.getByRole('button', { name: '查看决定与依据', exact: true }).click();
      await expect(page.getByText('操作时授权', { exact: true })).toBeVisible();
      expect(runtimeErrors).toEqual([]);
      // A second tab changes the same-origin session. Rendered private data must disappear.
      const secondTab = await page.context().newPage();
      await secondTab.goto(process.env.E2E_H5_BASE || '/');
      await secondTab.evaluate(() => {
        localStorage.setItem('token', 'visual-review-b'); localStorage.setItem('id', '8');
      });
      await expect(page.getByText('账号已变更，请重新加载', { exact: true })).toBeVisible();
      await expect(page.getByText(source.original_text, { exact: true })).toHaveCount(0);
      await secondTab.close();
    });
  }
}

test('session changes also remove evidence and draft text from the pending confirmation', async ({ page }) => {
  await setup(page, 'light');
  await openReview(page);
  await page.getByRole('button', { name: '选为范围修正依据', exact: true }).click();
  await page.getByRole('button', { name: '选择更细地区', exact: true }).click();
  await page.getByRole('button', { name: '莆田，选择这里', exact: true }).click();
  await page.locator('textarea').fill('需要随会话清理的私有草稿理由');
  await page.getByRole('button', { name: '核对并提交范围修正', exact: true }).click();
  await expect(page.getByText('确认缩小地区范围', { exact: true })).toBeVisible();
  const secondTab = await page.context().newPage();
  await secondTab.goto(process.env.E2E_H5_BASE || '/');
  await secondTab.evaluate(() => {
    localStorage.setItem('token', 'visual-review-b'); localStorage.setItem('id', '8');
  });
  await expect(page.getByText('账号已变更，请重新加载', { exact: true })).toBeVisible();
  await expect(page.getByText('确认缩小地区范围', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/需要随会话清理的私有草稿理由/)).toHaveCount(0);
  await secondTab.close();
});

test('staff without any curator grant can submit a scope correction', async ({ page }) => {
  const state = await setup(page, 'light');
  state.staff = true;
  await openReview(page);
  await expect(page.getByRole('button', { name: '选择更细地区', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '选为范围修正依据', exact: true }).click();
  await page.getByRole('button', { name: '选择更细地区', exact: true }).click();
  await page.getByRole('button', { name: '莆田，选择这里', exact: true }).click();
  await page.locator('textarea').fill('站点审核员引用合成来源修正地区');
  await page.getByRole('button', { name: '核对并提交范围修正', exact: true }).click();
  await page.locator('.t-dialog__button--confirm').click();
  await expect(page.getByText('操作时授权', { exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(1);
});

test('unknown application routes still open the not-found page under the configured mount', async ({ page }) => {
  await setup(page, 'light');
  await page.goto(`${process.env.E2E_H5_BASE || '/'}pages/not-a-real-curation-route`);
  await expect(page.getByText('这条路没有找到页面', { exact: true })).toBeVisible();
});
