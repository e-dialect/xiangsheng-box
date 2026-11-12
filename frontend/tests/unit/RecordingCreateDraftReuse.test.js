import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));
vi.mock('@/services/capabilities', () => ({
  CAPABILITIES: { RECORDING: 'recording' },
  ensureCapability: vi.fn(() => true),
}));
vi.mock('@/services/recordingDrafts', () => ({
  draftOwner: vi.fn(() => 'user:1'),
  listRecordingDrafts: vi.fn(() => []),
  restoreRecordingDraft: vi.fn(),
  saveRecordingDraft: vi.fn(),
  deleteRecordingDraft: vi.fn(),
}));
vi.mock('@/services/entryRecording', () => ({
  createRecording: vi.fn(),
  dialectLabel: vi.fn(),
  entryTitle: vi.fn(),
  getEntry: vi.fn(),
  listEntries: vi.fn(),
  pageResults: vi.fn(),
}));
vi.mock('@/services/file', () => ({ uploadFile: vi.fn() }));
vi.mock('@/services/feedback', () => ({
  confirm: vi.fn(), notify: vi.fn(), notifySuccess: vi.fn(),
}));
vi.mock('@/services/guantou', () => ({ listAllDialects: vi.fn(async () => []) }));
vi.mock('@/services/navigation', () => ({ goRecordingDetail: vi.fn(), goRecordingDrafts: vi.fn() }));
vi.mock('@/services/recordingDraftAudio', () => ({ releaseDraftAudioUrl: vi.fn() }));
vi.mock('@/services/productAnalytics', () => ({
  PRODUCT_EVENTS: { RECORDING_SUBMIT: 'recording_submit' }, trackProductEvent: vi.fn(),
}));

const {
  listRecordingDrafts, restoreRecordingDraft, draftOwner, saveRecordingDraft,
} = await import('@/services/recordingDrafts');
const { getEntry, createRecording } = await import('@/services/entryRecording');
const { uploadFile } = await import('@/services/file');
const { notify } = await import('@/services/feedback');
const RecordingCreate = (await import('@/pages/recordings/create.vue')).default;

function pageContext() {
  return {
    ...RecordingCreate.data(),
    ...RecordingCreate.methods,
    ownerScope: 'user:1',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  draftOwner.mockReturnValue('user:1');
  listRecordingDrafts.mockReturnValue([]);
  getEntry.mockResolvedValue({ id: 17, title: '已有词条' });
  saveRecordingDraft.mockReset();
});

describe('recording page draft reuse by entry', () => {
  it('restores the newest draft for the selected entry instead of opening a duplicate', async () => {
    listRecordingDrafts.mockReturnValue([
      { id: 'older', entryId: 17, updatedAt: 10 },
      { id: 'newest', entryId: '17', updatedAt: 20 },
      { id: 'other-entry', entryId: 18, updatedAt: 30 },
    ]);
    restoreRecordingDraft.mockResolvedValue({
      id: 'newest',
      entryId: 17,
      form: { original_gloss: '已写的大意' },
      audio: { path: 'blob:saved', invalid: false },
    });
    const page = pageContext();

    await RecordingCreate.onLoad.call(page, { entry_id: '17' });

    expect(restoreRecordingDraft).toHaveBeenCalledWith('newest', 'user:1');
    expect(page.draftId).toBe('newest');
    expect(page.form.original_gloss).toBe('已写的大意');
    expect(page.audio.path).toBe('blob:saved');
    expect(page.selectedEntry).toEqual({ id: 17, title: '已有词条' });
    expect(getEntry).toHaveBeenCalledWith(17);
  });

  it('loads the selected entry normally when it has no matching draft', async () => {
    const page = pageContext();

    await RecordingCreate.onLoad.call(page, { entry_id: '17' });

    expect(restoreRecordingDraft).not.toHaveBeenCalled();
    expect(getEntry).toHaveBeenCalledWith('17');
    expect(page.selectedEntry).toEqual({ id: 17, title: '已有词条' });
  });

  it('keeps automatic quota failures in the page status without repeating toast notices', async () => {
    saveRecordingDraft.mockRejectedValue(new Error('草稿箱已满，请清理后重试'));
    const page = pageContext();
    page.audio = { path: 'blob:recording' };

    await page.performSaveDraft({ silent: true });
    await page.performSaveDraft({ silent: true });

    expect(page.draftMessage).toBe('草稿箱已满，请清理后重试');
    expect(notify).not.toHaveBeenCalled();

    await page.performSaveDraft();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({ title: '草稿箱已满，请清理后重试' });
  });
});

describe('recording entry association survives unavailable metadata', () => {
  beforeEach(() => {
    getEntry.mockRejectedValue(new Error('offline'));
    restoreRecordingDraft.mockResolvedValue({
      id: 'existing',
      entryId: 17,
      form: { original_gloss: '原大意', usage_dialect_id: 11 },
      audio: { path: 'blob:saved', invalid: false },
    });
    saveRecordingDraft.mockResolvedValue({ id: 'existing', audioError: false });
  });

  it('keeps the restored association when editing and saving, then submitting', async () => {
    const page = pageContext();
    await RecordingCreate.onLoad.call(page, { draft_id: 'existing' });
    expect(page.selectedEntry).toBeNull();
    expect(page.linkedEntryId).toBe(17);
    page.form.original_gloss = '修改的大意';
    await page.persistDirtyDraft();
    expect(saveRecordingDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ entryId: 17, form: expect.objectContaining({ original_gloss: '修改的大意' }) }),
      'user:1',
    );
    page.$refs = { form: { validate: vi.fn(async () => true) } };
    uploadFile.mockResolvedValue({ url: '/recording.wav' });
    createRecording.mockResolvedValue({ id: 90 });
    await page.submit();
    expect(createRecording).toHaveBeenCalledWith(expect.objectContaining({ primary_entry_id: 17 }));
  });

  it('keeps an entry route association and restores a matching draft even if lookup fails', async () => {
    const page = pageContext();
    await RecordingCreate.onLoad.call(page, { entry_id: '17' });
    expect(page.linkedEntryId).toBe('17');
    await page.saveDraft();
    expect(saveRecordingDraft).toHaveBeenLastCalledWith(expect.objectContaining({ entryId: '17' }), 'user:1');
    listRecordingDrafts.mockReturnValue([{ id: 'existing', entryId: 17, updatedAt: 1 }]);
    const restored = pageContext();
    await RecordingCreate.onLoad.call(restored, { entry_id: '17' });
    expect(restored.draftId).toBe('existing');
    expect(restored.linkedEntryId).toBe(17);
  });

  it('retries metadata without changing the draft signature or restored fields', async () => {
    const page = pageContext();
    await page.restoreDraft('existing');
    const signature = page.draftSignature();
    getEntry.mockResolvedValue({ id: 17, summary: '已恢复词条信息' });
    await page.loadEntry(page.linkedEntryId);
    expect(page.selectedEntry.summary).toBe('已恢复词条信息');
    expect(page.draftSignature()).toBe(signature);
  });

  it('only removes the association on explicit unlink and ignores a late lookup', async () => {
    const page = pageContext();
    let resolveEntry;
    getEntry.mockImplementation(() => new Promise((resolve) => { resolveEntry = resolve; }));
    const loading = page.loadEntry(17);
    page.clearEntry();
    resolveEntry({ id: 17 });
    await loading;
    await page.saveDraft();
    expect(page.selectedEntry).toBeNull();
    expect(page.linkedEntryId).toBeNull();
    expect(page.entryLoading).toBe(false);
    expect(saveRecordingDraft).toHaveBeenLastCalledWith(expect.objectContaining({ entryId: null }), 'user:1');
  });

  it('does not overwrite an explicit replacement with an older lookup', async () => {
    const page = pageContext();
    let resolveEntry;
    getEntry.mockImplementation(() => new Promise((resolve) => { resolveEntry = resolve; }));
    const loading = page.loadEntry(17);
    page.selectEntry({ id: 18, summary: '替换词条' });
    resolveEntry({ id: 17 });
    await loading;
    await page.saveDraft();
    expect(page.selectedEntry.id).toBe(18);
    expect(saveRecordingDraft).toHaveBeenLastCalledWith(expect.objectContaining({ entryId: 18 }), 'user:1');
  });
});

describe('pending entry lookup does not block draft persistence', () => {
  it('saves explicit unlink on unload before metadata resolves', async () => {
    let resolveEntry;
    getEntry.mockImplementation(() => new Promise((resolve) => { resolveEntry = resolve; }));
    restoreRecordingDraft.mockResolvedValue({
      id: 'existing', entryId: 17, form: {}, audio: null,
    });
    saveRecordingDraft.mockResolvedValue({ id: 'existing', audioError: false });
    const page = pageContext();
    await RecordingCreate.onLoad.call(page, { draft_id: 'existing' });
    expect(page.draftReady).toBe(true);
    page.clearEntry();
    RecordingCreate.onUnload.call(page);
    await page.draftSavePromise;
    expect(saveRecordingDraft).toHaveBeenLastCalledWith(expect.objectContaining({ entryId: null }), 'user:1');
    resolveEntry({ id: 17 });
    await Promise.resolve();
    expect(page.selectedEntry).toBeNull();
    const [savedDraft] = saveRecordingDraft.mock.calls.at(-1);
    restoreRecordingDraft.mockResolvedValue(savedDraft);
    const reopened = pageContext();
    await RecordingCreate.onLoad.call(reopened, { draft_id: 'existing' });
    expect(reopened.linkedEntryId).toBeNull();
    expect(reopened.selectedEntry).toBeNull();
  });
});
