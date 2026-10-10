import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/recordingDrafts', () => ({
  draftOwner: vi.fn(() => 'user:1'),
  saveRecordingDraft: vi.fn(),
  listRecordingDrafts: vi.fn(() => []),
  restoreRecordingDraft: vi.fn(),
  deleteRecordingDraft: vi.fn(),
}));
vi.mock('@/services/file', () => ({ uploadFile: vi.fn() }));
vi.mock('@/services/entryRecording', () => ({
  createRecording: vi.fn(), dialectLabel: vi.fn(), entryTitle: vi.fn(),
  getEntry: vi.fn(), listEntries: vi.fn(), pageResults: vi.fn(),
}));
vi.mock('@/services/feedback', () => ({
  confirm: vi.fn(), notify: vi.fn(), notifySuccess: vi.fn(),
}));
vi.mock('@/services/navigation', () => ({
  goRecordingDetail: vi.fn(), goRecordingDrafts: vi.fn(),
}));
vi.mock('@/services/productAnalytics', () => ({
  PRODUCT_EVENTS: { RECORDING_SUBMIT: 'recording_submit' }, trackProductEvent: vi.fn(),
}));

const { draftOwner, saveRecordingDraft } = await import('@/services/recordingDrafts');
const { uploadFile } = await import('@/services/file');
const { createRecording } = await import('@/services/entryRecording');
const { notify, notifySuccess } = await import('@/services/feedback');
const { goRecordingDetail } = await import('@/services/navigation');
const RecordingCreate = (await import('@/pages/recordings/create.vue')).default;

function pageContext() {
  const page = {
    ...RecordingCreate.data(), ...RecordingCreate.methods,
    ownerScope: 'user:1',
    $refs: { form: { validate: vi.fn(async () => true) } },
  };
  page.audio = { path: 'blob:recording', durationMs: 2300 };
  page.form.usage_dialect_id = 11;
  page.form.original_gloss = '测试录音';
  return page;
}

beforeEach(() => {
  vi.resetAllMocks();
  draftOwner.mockReturnValue('user:1');
  globalThis.uni = { getStorageSync: vi.fn(() => 1) };
  saveRecordingDraft.mockResolvedValue({ id: 'draft-1', audio: null, audioError: false });
  uploadFile.mockRejectedValue(new Error('音频格式不支持'));
});

describe('recording submission failure feedback', () => {
  it('retains the upload error while confirming a complete draft can be retried', async () => {
    const page = pageContext();
    await page.submit();
    expect(page.draftMessage).toContain('提交失败：音频格式不支持');
    expect(page.draftMessage).toContain('尚未加入个人贡献');
    expect(page.draftMessage).toContain('草稿已保存，可从草稿箱重试');
    expect(createRecording).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(goRecordingDetail).not.toHaveBeenCalled();
    expect(page.submitting).toBe(false);
    expect(page.submitted).toBe(false);
  });

  it('keeps the upload error and warns when only text was saved', async () => {
    saveRecordingDraft.mockResolvedValue({ id: 'draft-1', audio: null, audioError: true });
    const page = pageContext();
    await page.submit();
    expect(page.draftMessage).toContain('提交失败：音频格式不支持');
    expect(page.draftMessage).toContain('音频保存失败');
    expect(page.draftMessage).toContain('请保留本页重试');
    expect(page.draftMessage).not.toContain('从草稿箱重试');
  });

  it('keeps quota failure visible without claiming the draft can be restored', async () => {
    saveRecordingDraft.mockRejectedValue(new Error('草稿箱已满，请清理后重试'));
    const page = pageContext();
    await page.submit();
    expect(page.draftMessage).toContain('提交失败：音频格式不支持');
    expect(page.draftMessage).toContain('草稿箱已满');
    expect(page.draftMessage).toContain('请保留本页重试');
    expect(page.draftMessage).not.toContain('从草稿箱重试');
    expect(notify).toHaveBeenLastCalledWith({ title: page.draftMessage, icon: 'none' });
  });

  it('does not promise restoration of edits made while saving', async () => {
    const page = pageContext();
    saveRecordingDraft.mockImplementation(async () => {
      page.form.original_gloss += '新修改';
      return { id: 'draft-1', audioError: false };
    });
    await page.submit();
    expect(page.draftMessage).toContain('新修改仍待保存');
    expect(page.draftMessage).not.toContain('从草稿箱重试');
  });

  it('reports recording API failure after upload and retains recovery instructions', async () => {
    uploadFile.mockResolvedValue({ url: '/files/voice.mp3', duration_ms: 2300 });
    createRecording.mockRejectedValue(new Error('录音提交服务暂不可用'));
    const page = pageContext();
    await page.submit();
    expect(page.draftMessage).toContain('提交失败：录音提交服务暂不可用');
    expect(page.draftMessage).toContain('从草稿箱重试');
    expect(goRecordingDetail).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
