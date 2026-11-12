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
const { getEntry } = await import('@/services/entryRecording');
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
