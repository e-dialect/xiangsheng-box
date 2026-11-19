import { test, expect } from '@playwright/test';
import { installVisualFixture, observeRuntime, openVisualRoute, horizontalOverflow } from './helpers/visualReviewFixture';

for (const theme of ['light', 'dark']) {
  test(`entry-first collection ${theme}`, async ({ page }, testInfo) => {
    const runtime = observeRuntime(page);
    await installVisualFixture(page, { persona: 'member', theme });
    await openVisualRoute(page, '/pages/collections/details?id=1', { persona: 'member' });
    await expect(page.getByText('雨落故乡', { exact: true })).toBeVisible();
    await expect(page.getByText('展开 1 段录音', { exact: true })).toBeVisible();
    await page.getByText('展开 1 段录音', { exact: true }).click();
    await expect(page.getByText('查看全部录音', { exact: true })).toBeVisible();
    await expect(page.getByText('录音详情', { exact: true })).toBeVisible();
    await page.getByText('听录音', { exact: true }).first().click();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath(`collection-${theme}.png`), fullPage: true });
    await page.getByText('整理目录', { exact: true }).click();
    await expect(page.getByText('挑选录音', { exact: true })).toBeVisible();
    await page.getByText('录音详情', { exact: true }).click();
    await expect(page.getByText('乡音留言', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`recording-${theme}.png`), fullPage: true });
    expect(runtime).toEqual([]);
  });
}

['light', 'dark'].forEach((theme) => {
  test(`guest reads the collection one word at a time in ${theme}`, async ({ page }, testInfo) => {
    await installVisualFixture(page, { theme });
    const sections = ['面线', '红团'].map((word, index) => ({
      id: index + 30,
      entry: { id: index + 10, display_writing: word, summary: '测试释义' },
      recordings: [],
      recording_count: 0,
    }));
    sections[0].recordings = ['莆田城里', '仙游'].map((name, index) => ({
      id: index + 50,
      recording: {
        id: index + 60,
        usage_dialect: { id: index + 70, name },
        original_gloss: `示例 ${index + 1}`,
      },
    }));
    sections[0].recording_count = 2;
    await page.route('**/collections/19/', (route) => route.fulfill({
      json: {
        id: 19, title: '测试菜单', is_public: true, sections, pending: [], entry_count: 2, recording_count: 2,
      },
    }));
    await openVisualRoute(page, '/pages/collections/details?id=19');
    await page.getByText('逐词阅读', { exact: true }).click();
    await expect(page.getByText('面线', { exact: true })).toBeVisible();
    await expect(page.locator('.box-directory', { hasText: '莆田城里' }).getByText('示例 1')).toBeVisible();
    await expect(page.locator('.box-directory', { hasText: '仙游' }).getByText('示例 2')).toBeVisible();
    await page.getByText('下一个词', { exact: true }).click();
    await expect(page.getByText('第 2 / 2 个词', { exact: true })).toBeVisible();
    await expect(page.getByText('红团', { exact: true })).toBeVisible();
    await expect(page.getByText('本集盒暂未收录这个词的读音。')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath(`collection-word-${theme}.png`) });
    await page.getByText('打开词条', { exact: true }).click();
    await expect(page).toHaveURL(/entries\/details\?id=11/);
    await page.goBack();
    await expect(page.getByText('第 2 / 2 个词', { exact: true })).toBeVisible();
    if (theme === 'dark') await page.locator('.shell-back:visible').click();
    else await page.getByText('返回目录', { exact: true }).click();
    await expect(page.getByText('逐词阅读', { exact: true })).toBeVisible();
  });
});

test('collection directory fits desktop and its box label remains editable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installVisualFixture(page, { persona: 'member' });
  await openVisualRoute(page, '/pages/collections/details?id=1', { persona: 'member' });
  await page.getByText('编辑盒签', { exact: true }).click();
  await expect(page.getByText('保存盒签', { exact: true })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath('collection-desktop.png'), fullPage: true });
});

test('text draft survives refresh and resumes into recording form', async ({ page }) => {
  await installVisualFixture(page, { persona: 'member', preserveStorage: true });
  await openVisualRoute(page, '/pages/recordings/create', { persona: 'member' });
  const gloss = page.getByPlaceholder('用普通话或你习惯的方式说明意思');
  // The actual BaseField label is the durable accessible entry point.
  const field = page.locator('textarea').first();
  if (await gloss.count()) await gloss.fill('窗外开始落大雨');
  else await field.fill('窗外开始落大雨');
  await page.getByText('保存草稿', { exact: true }).click();
  await expect(page.getByText('草稿已保存，可稍后继续', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('发现未完成草稿', { exact: true })).toBeVisible();
  const restoreButton = page.locator('uni-button[data-type="confirm"]', {
    hasText: '恢复草稿',
  });
  await expect(restoreButton).toBeVisible();
  await restoreButton.click();
  await page.getByText('草稿箱', { exact: true }).click();
  await expect(page.getByText('窗外开始落大雨', { exact: true })).toBeVisible();
  await page.getByText('继续录制', { exact: true }).click();
  await expect(page.locator('textarea').first()).toHaveValue('窗外开始落大雨');
});

for (const theme of ['light', 'dark']) {
  test(`entry discussion stays on the entry ${theme}`, async ({ page }, testInfo) => {
    const runtime = observeRuntime(page);
    await installVisualFixture(page, { persona: 'member', theme });
    const comments = [];
    await page.route('**/entry-comments/**', async (route) => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON();
        expect(data.entry_id).toBe(21);
        expect(data).not.toHaveProperty('recording_id');
        const comment = { ...data, id: 1, author_name: '视觉巡检员', like_count: 0, liked: false, editable: true };
        comments.push(comment);
        await route.fulfill({ status: 201, json: comment });
      } else {
        await route.fulfill({ json: { count: comments.length, results: comments, next: null } });
      }
    });
    await openVisualRoute(page, '/pages/entries/details?id=21', { persona: 'member' });
    await expect(page.getByText('词条讨论', { exact: true })).toBeVisible();
    await page.getByRole('textbox').fill('这个词在家乡也这样用');
    await page.getByText('发送留言', { exact: true }).click();
    await expect(page.locator('.comment-card').getByText('这个词在家乡也这样用', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveValue('');
    await page.screenshot({ path: testInfo.outputPath(`entry-discussion-${theme}.png`), fullPage: true });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
    expect(runtime).toEqual([]);
  });
}

test('editing saves automatically before leaving the recording page', async ({ page }) => {
  await installVisualFixture(page, { persona: 'member', preserveStorage: true });
  await openVisualRoute(page, '/pages/recordings/create', { persona: 'member' });
  await page.locator('textarea').first().fill('没有点保存也留住了');
  // Assert persistence before navigation: opening the draft box also flushes edits.
  // Silent autosave deliberately has no persistent success message.
  await expect.poll(() => page.evaluate(() => {
    const drafts = JSON.parse(localStorage.getItem('recording_drafts:v2:user:7') || '[]');
    return drafts.some((draft) => draft.form.original_gloss === '没有点保存也留住了');
  })).toBe(true);
  await expect(page.locator('.record-draft-message')).toHaveCount(0);
  await page.getByText('草稿箱', { exact: true }).click();
  await expect(page.getByText('没有点保存也留住了', { exact: true })).toBeVisible();
  await page.getByText('继续录制', { exact: true }).click();
  await expect(page.locator('textarea').first()).toHaveValue('没有点保存也留住了');
});

test('opening drafts immediately waits for the latest edit to persist', async ({ page }) => {
  await installVisualFixture(page, { persona: 'member', preserveStorage: true });
  await openVisualRoute(page, '/pages/recordings/create', { persona: 'member' });
  await page.locator('textarea').first().fill('立即离开也保留');
  await page.getByText('草稿箱', { exact: true }).click();
  await expect(page.getByText('立即离开也保留', { exact: true })).toBeVisible();
});
