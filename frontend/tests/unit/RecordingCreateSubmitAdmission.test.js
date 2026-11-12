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

const { draftOwner, saveRecordingDraft } = await import('@/services/recordingDrafts');
const { createRecording } = await import('@/services/entryRecording');
const { uploadFile } = await import('@/services/file');
const RecordingCreate = (await import('@/pages/recordings/create.vue')).default;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function pageContext() {
  return {
    ...RecordingCreate.data(),
    ...RecordingCreate.methods,
    ownerScope: 'user:1',
    audio: { path: 'blob:recording', durationMs: 1000 },
    form: { original_gloss: '家乡话', usage_dialect_id: 1 },
    $refs: { form: { validate: vi.fn().mockResolvedValue(true) } },
    $nextTick: vi.fn().mockResolvedValue(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  draftOwner.mockReturnValue('user:1');
  saveRecordingDraft.mockResolvedValue({ id: 'draft-1', audio: null });
  uploadFile.mockResolvedValue({ url: 'https://example.com/audio.mp3' });
  createRecording.mockResolvedValue({ id: 23 });
});

describe('recording submit admission', () => {
  it('uploads and creates only once when tapped twice during validation', async () => {
    const validation = deferred();
    const page = pageContext();
    page.$refs.form.validate.mockReturnValue(validation.promise);
    const first = page.submit();
    const second = page.submit();
    expect(page.validatingSubmission).toBe(true);
    expect(page.$refs.form.validate).toHaveBeenCalledTimes(1);
    validation.resolve(true);
    await Promise.all([first, second]);
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(createRecording).toHaveBeenCalledTimes(1);
  });

  it('allows retry after validation fails', async () => {
    const page = pageContext();
    page.$refs.form.validate.mockResolvedValueOnce(false);
    await page.submit();
    expect(uploadFile).not.toHaveBeenCalled();
    expect(page.submitting).toBe(false);
    expect(page.validatingSubmission).toBe(false);
    await page.submit();
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(createRecording).toHaveBeenCalledTimes(1);
  });

  it('releases admission after rejected validation so a retry can succeed', async () => {
    const page = pageContext();
    page.$refs.form.validate.mockRejectedValueOnce(new Error('validation interrupted'));
    // Permit either deliberate handled feedback or existing rejection propagation;
    // the invariant is that failed validation cannot strand the submission lock.
    await page.submit().catch(() => {});
    expect(uploadFile).not.toHaveBeenCalled();
    expect(page.submitting).toBe(false);
    expect(page.validatingSubmission).toBe(false);
    await page.submit();
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(createRecording).toHaveBeenCalledTimes(1);
  });
  it.each(['upload', 'create'])('releases the lock and preserves recovery feedback after %s failure', async (stage) => {
    const page = pageContext();
    const request = stage === 'upload' ? uploadFile : createRecording;
    request.mockRejectedValueOnce(new Error('network unavailable'));
    await page.submit();
    expect(page.submitting).toBe(false);
    expect(page.validatingSubmission).toBe(false);
    expect(page.draftMessage).toContain('network unavailable');
    expect(page.draftMessage).toContain('草稿已保存');
    await page.submit();
    expect(page.submitted).toBe(true);
    expect(page.submitting).toBe(false);
    expect(page.validatingSubmission).toBe(false);
    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(createRecording).toHaveBeenCalledTimes(stage === 'create' ? 2 : 1);
  });

  it('releases the lock if the account changes during validation', async () => {
    const page = pageContext();
    draftOwner.mockReturnValue('user:2');
    await page.submit();
    expect(page.submitting).toBe(false);
    expect(page.validatingSubmission).toBe(false);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('releases the submission lock if the initial draft save unexpectedly rejects', async () => {
    const page = pageContext();
    page.saveDraft = vi.fn().mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValue({ restorable: true });
    await page.submit();
    expect(page.submitting).toBe(false);
    expect(page.validatingSubmission).toBe(false);
    expect(uploadFile).not.toHaveBeenCalled();
    await page.submit();
    expect(createRecording).toHaveBeenCalledTimes(1);
  });

  it('still persists dirty content when hidden during pending validation', async () => {
    const validation = deferred();
    const page = pageContext();
    page.draftReady = true;
    page.$refs.form.validate.mockReturnValue(validation.promise);
    const submission = page.submit();
    RecordingCreate.onHide.call(page);
    await page.draftSavePromise;
    expect(saveRecordingDraft).toHaveBeenCalledTimes(1);
    validation.resolve(false);
    await submission;
    expect(page.validatingSubmission).toBe(false);
    expect(uploadFile).not.toHaveBeenCalled();
  });

});
