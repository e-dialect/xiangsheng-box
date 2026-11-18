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
  draftOwner, saveRecordingDraft, restoreRecordingDraft, deleteRecordingDraft,
} = await import('@/services/recordingDrafts');
const { createRecording } = await import('@/services/entryRecording');
const { notify, notifySuccess } = await import('@/services/feedback');
const { uploadFile } = await import('@/services/file');
const { goRecordingDrafts, goRecordingDetail } = await import('@/services/navigation');
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
    draftReady: true,
    audio: { path: 'blob:recording', durationMs: 1000 },
    form: { original_gloss: '家乡话', usage_dialect_id: 1, speaker_consent_source: 'self' },
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
    validation.resolve(true);
    await submission;
    expect(page.validatingSubmission).toBe(false);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it.each(['validation', 'upload'])('freezes audio, fields, dialect and entry during %s', async (stage) => {
    const gate = deferred();
    const page = pageContext();
    page.selectEntry({ id: 10 });
    page.dialectPickerVisible = true;
    if (stage === 'validation') page.$refs.form.validate.mockReturnValue(gate.promise);
    else uploadFile.mockReturnValue(gate.promise);
    const pending = page.submit();
    if (stage === 'upload') {
      await vi.waitFor(() => expect(uploadFile).toHaveBeenCalled());
    }
    expect(page.isSubmissionLocked()).toBe(true);
    expect(page.dialectPickerVisible).toBe(false);
    page.onAudioChange({ path: 'blob:B', durationMs: 9000 });
    page.clearAudio();
    page.updateFormField('original_gloss', 'meaning B');
    page.updateFormField('rights_statement', 'other rights');
    page.onDialectChange({ value: 2 });
    page.selectEntry({ id: 20 });
    page.clearEntry();
    page.openDialectPicker();
    expect(page.audio.path).toBe('blob:recording');
    expect(page.form.original_gloss).toBe('家乡话');
    expect(page.dialectPickerVisible).toBe(false);
    gate.resolve(stage === 'validation' ? true : { url: 'https://example.com/A.mp3' });
    await pending;
    expect(uploadFile.mock.calls[0][0]).toBe('blob:recording');
    expect(createRecording).toHaveBeenCalledWith(expect.objectContaining({
      original_gloss: '家乡话',
      usage_dialect_id: 1,
      primary_entry_id: 10,
      duration_ms: 1000,
      rights_statement: '',
    }), expect.any(Object));
  });

  it('uses an immutable payload even if reactive state changes during upload', async () => {
    const gate = deferred();
    const page = pageContext();
    page.linkedEntryId = 10;
    uploadFile.mockReturnValue(gate.promise);
    const pending = page.submit();
    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalled());
    page.form.original_gloss = 'unexpected state';
    page.audio.durationMs = 9000;
    page.linkedEntryId = 20;
    gate.resolve({ url: 'https://example.com/A.mp3' });
    await pending;
    expect(createRecording).toHaveBeenCalledWith(expect.objectContaining({
      original_gloss: '家乡话', duration_ms: 1000, primary_entry_id: 10,
    }), expect.any(Object));
  });

  it('unlocks edits after upload failure while retaining the original recovery draft', async () => {
    const page = pageContext();
    uploadFile.mockRejectedValueOnce(new Error('offline'));
    await page.submit();
    expect(page.isSubmissionLocked()).toBe(false);
    expect(saveRecordingDraft).toHaveBeenLastCalledWith(expect.objectContaining({
      audio: expect.objectContaining({ path: 'blob:recording' }),
      form: expect.objectContaining({ original_gloss: '家乡话' }),
    }), 'user:1');
    page.updateFormField('original_gloss', 'retry');
    page.onAudioChange({ path: 'blob:B', durationMs: 2000 });
    expect(page.form.original_gloss).toBe('retry');
    expect(page.audio.path).toBe('blob:B');
  });

  it('opens the new account draft list while an old account upload is pending', async () => {
    const uploadStarted = deferred();
    const upload = deferred();
    const page = pageContext();
    page.selectEntry({ id: 10 });
    uploadFile.mockImplementationOnce(() => {
      uploadStarted.resolve();
      return upload.promise;
    });
    const submission = page.submit();
    await uploadStarted.promise;
    await page.goRecordingDrafts();
    expect(goRecordingDrafts).not.toHaveBeenCalled();

    draftOwner.mockReturnValue('user:2');
    RecordingCreate.onShow.call(page);
    expect(goRecordingDrafts).toHaveBeenCalledTimes(1);
    expect(page.linkedEntryId).toBeNull();
    expect(page.audio.path).toBe('');
    expect(page.form.original_gloss).toBe('');
    upload.resolve({ url: 'https://example.com/old-account.mp3' });
    await submission;
    RecordingCreate.onShow.call(page);
    expect(goRecordingDrafts).toHaveBeenCalledTimes(1);
    expect(createRecording).not.toHaveBeenCalled();
    expect(goRecordingDetail).not.toHaveBeenCalled();
    expect(saveRecordingDraft).toHaveBeenCalledTimes(1);
    expect(page.isSubmissionLocked()).toBe(false);
  });

  it.each([false, true])('uploads the moved native file even when metadata storage fails: %s', async (fails) => {
    const page = pageContext();
    page.audio = { path: 'wxfile://temporary', durationMs: 2000 };
    if (fails) {
      const error = new Error('metadata storage failed');
      error.persistedAudio = { path: 'wxfile://saved' };
      saveRecordingDraft.mockRejectedValueOnce(error);
    } else saveRecordingDraft.mockResolvedValueOnce({ id: 'draft-1', audio: { path: 'wxfile://saved' } });
    await page.submit();
    expect(uploadFile.mock.calls[0][0]).toBe('wxfile://saved');
    expect(createRecording).toHaveBeenCalledWith(
      expect.objectContaining({ duration_ms: 2000 }),
      expect.any(Object),
    );
  });

  it('does not interrupt editing during a background draft save', () => {
    const page = pageContext();
    page.savingDraft = true;
    page.updateFormField('original_gloss', 'still typing');
    page.onAudioChange({ path: 'blob:B' });
    expect(page.isSubmissionLocked()).toBe(false);
    expect(page.form.original_gloss).toBe('still typing');
    expect(page.audio.path).toBe('blob:B');
  });

  it('waits for draft restoration and keeps the entry association while metadata loads', async () => {
    const restore = deferred();
    const entry = deferred();
    const page = pageContext();
    page.draftReady = false;
    page.loadDialects = vi.fn().mockResolvedValue();
    page.loadEntry = vi.fn(async (id) => {
      page.linkedEntryId = id;
      await entry.promise;
      page.selectedEntry = { id };
    });
    restoreRecordingDraft.mockReturnValue(restore.promise);
    const loading = RecordingCreate.onLoad.call(page, { draft_id: 'draft-B' });
    await Promise.resolve();
    await page.submit();
    expect(page.$refs.form.validate).not.toHaveBeenCalled();
    expect(uploadFile).not.toHaveBeenCalled();
    restore.resolve({
      id: 'draft-B',
      entryId: 20,
      form: { original_gloss: 'meaning B', usage_dialect_id: 2, speaker_consent_source: 'speaker_written' },
      audio: { path: 'blob:B', durationMs: 2000 },
    });
    await loading;
    expect(page.draftReady).toBe(true);
    expect(page.selectedEntry).toBeNull();
    await page.submit();
    expect(uploadFile.mock.calls[0][0]).toBe('blob:B');
    expect(createRecording).toHaveBeenCalledWith(expect.objectContaining({
      original_gloss: 'meaning B',
      usage_dialect_id: 2,
      primary_entry_id: 20,
      duration_ms: 2000,
      speaker_consent_source: 'speaker_written',
    }), expect.any(Object));
    entry.resolve();
  });
});

describe('recording submission after leaving the page', () => {
  it.each([
    ['upload', 'onUnload'],
    ['create', 'onHide'],
  ])('finishes submission after leaving during %s without updating navigation or repeating the submission', async (stage, lifecycle) => {
    const response = deferred();
    const request = stage === 'upload' ? uploadFile : createRecording;
    request.mockReturnValueOnce(response.promise);
    const page = pageContext();
    const submit = page.submit();
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    const { canPresent } = request.mock.calls[0][1];
    expect(canPresent()).toBe(true);

    RecordingCreate[lifecycle].call(page);
    if (lifecycle === 'onHide') RecordingCreate.onShow.call(page);
    expect(canPresent()).toBe(false);
    response.resolve(stage === 'upload' ? { url: 'https://example.com/audio.mp3' } : { id: 23 });
    await submit;

    expect(page.submitting).toBe(false);
    expect(page.submitted).toBe(true);
    expect(deleteRecordingDraft).toHaveBeenCalledTimes(1);
    expect(deleteRecordingDraft).toHaveBeenCalledWith('draft-1', 'user:1');
    expect(goRecordingDetail).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    await page.submit();
    expect(createRecording).toHaveBeenCalledTimes(1);
  });

  it.each(['upload', 'create'])('retains a retryable draft without stale feedback on late %s failure', async (stage) => {
    const response = deferred();
    const request = stage === 'upload' ? uploadFile : createRecording;
    request.mockReturnValueOnce(response.promise);
    const page = pageContext();
    const submit = page.submit();
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    saveRecordingDraft.mockResolvedValueOnce({ id: 'draft-1', audioError: true });

    RecordingCreate.onHide.call(page);
    RecordingCreate.onShow.call(page);
    response.reject(Object.assign(new Error('offline'), { data: { audio_url: 'old error' } }));
    await submit;

    expect(page.submitting).toBe(false);
    expect(page.submitted).toBe(false);
    expect(saveRecordingDraft).toHaveBeenCalledTimes(2);
    expect(page.draftId).toBe('draft-1');
    expect(page.draftMessage).toBe('');
    expect(page.fieldErrors).toEqual({});
    expect(deleteRecordingDraft).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(goRecordingDetail).not.toHaveBeenCalled();
    await page.submit();
    expect(page.submitted).toBe(true);
    expect(goRecordingDetail).toHaveBeenCalledWith(23, { replace: true });
  });

  it('suppresses completion feedback if the user leaves during draft cleanup', async () => {
    const cleanup = deferred();
    deleteRecordingDraft.mockReturnValueOnce(cleanup.promise);
    const page = pageContext();
    const submit = page.submit();
    await vi.waitFor(() => expect(deleteRecordingDraft).toHaveBeenCalled());

    RecordingCreate.onHide.call(page);
    cleanup.reject(new Error('storage unavailable'));
    await submit;

    expect(page.submitted).toBe(true);
    expect(goRecordingDetail).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('cleans only the original account draft if creation already succeeded after switching accounts', async () => {
    const response = deferred();
    createRecording.mockReturnValueOnce(response.promise);
    const page = pageContext();
    const submit = page.submit();
    await vi.waitFor(() => expect(createRecording).toHaveBeenCalled());

    draftOwner.mockReturnValue('user:2');
    RecordingCreate.onShow.call(page);
    response.resolve({ id: 23 });
    await submit;

    expect(goRecordingDrafts).toHaveBeenCalledTimes(1);
    expect(deleteRecordingDraft).toHaveBeenCalledTimes(1);
    expect(deleteRecordingDraft).toHaveBeenCalledWith('draft-1', 'user:1');
    expect(goRecordingDetail).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
