import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/recordingDrafts', () => ({ draftOwner: vi.fn(() => 'user:1'), saveRecordingDraft: vi.fn(), restoreRecordingDraft: vi.fn(), deleteRecordingDraft: vi.fn() }));
vi.mock('@/services/collections', () => ({ listCollections: vi.fn(), createCollection: vi.fn(), addCollectionEntry: vi.fn(), addCollectionRecording: vi.fn(), getCollection: vi.fn(), updateCollection: vi.fn(), deleteCollection: vi.fn(), removeCollectionItem: vi.fn(), orderCollection: vi.fn() }));
vi.mock('@/services/entrySearchAssist', () => ({ suggestEntries: vi.fn(), popularEntries: vi.fn(), searchHistory: vi.fn(() => []), rememberSearch: vi.fn(), clearSearchHistory: vi.fn() }));
vi.mock('@/services/recordingSocial', () => ({ likeRecording: vi.fn(), listComments: vi.fn(), createComment: vi.fn(), deleteComment: vi.fn(), likeComment: vi.fn(), commentRequestId: vi.fn(() => 'same-request') }));
vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));
vi.mock('@/services/feedback', () => ({ notify: vi.fn(), confirm: vi.fn(async () => true) }));
import RecordingCreate from '@/pages/recordings/create.vue';
import { saveRecordingDraft, draftOwner } from '@/services/recordingDrafts';
import Picker from '@/components/CollectionPicker.vue';
import Search from '@/pages/search.vue';
import Detail from '@/components/DiscussionThread.vue';
import { addCollectionEntry, addCollectionRecording } from '@/services/collections';
import { suggestEntries } from '@/services/entrySearchAssist';
import { createComment, listComments } from '@/services/recordingSocial';
const context = (component, extra = {}) => ({ ...component.data(), ...component.methods, ...extra });
beforeEach(() => { vi.clearAllMocks(); });
describe('restored journeys', () => {
  it('retries with the saved native path after draft index persistence fails', async () => {
    const error = Object.assign(new Error('草稿空间不足'), { persistedAudio: { path: 'wxfile://saved', persisted: true, mediaId: 'a' } });
    saveRecordingDraft.mockRejectedValueOnce(error);
    const page = context(RecordingCreate, { ownerScope: 'user:1', audio: { path: 'wxfile://temporary' } });
    await page.saveDraft();
    expect(page.audio.path).toBe('wxfile://saved');
    expect(page.draftMessage).toBe('草稿空间不足');
    saveRecordingDraft.mockResolvedValueOnce({ id: 'draft-a', audio: error.persistedAudio });
    await page.saveDraft();
    expect(saveRecordingDraft.mock.calls.at(-1)[0].audio.path).toBe('wxfile://saved');
  });
  it('keeps a mini-program recording submit-ready after saving moves its temporary file', async () => {
    saveRecordingDraft.mockResolvedValue({ id: 'draft-a', audio: { path: 'wxfile://saved', persisted: true, mediaId: 'a' } });
    const page = context(RecordingCreate, { ownerScope: 'user:1', audio: { path: 'wxfile://temporary' } });
    await page.saveDraft();
    expect(page.audio.path).toBe('wxfile://saved');
    expect(page.draftId).toBe('draft-a');
  });
  it('collects just an entry without automatically collecting all of its recordings', async () => {
    const picker = context(Picker, { entryId: 9, recording: null });
    await picker.collect(1);
    expect(addCollectionEntry).toHaveBeenCalledWith(1, 9);
    expect(addCollectionRecording).not.toHaveBeenCalled();
  });
  it('uses the chosen entry only as collection placement', async () => {
    const picker = context(Picker, { recording: { id: 5 }, selectedEntry: 7 });
    await picker.collect(1);
    expect(addCollectionRecording).toHaveBeenCalledWith(1, 5, 7);
    expect(addCollectionEntry).not.toHaveBeenCalled();
  });
  it('ignores a late suggestion response after the user changes the query', async () => {
    vi.useFakeTimers();
    let resolveFirst;
    suggestEntries.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; })).mockResolvedValueOnce([{ id: 2 }]);
    const search = context(Search);
    Search.watch['filters.keyword'].call(search, '月');
    await vi.advanceTimersByTimeAsync(250);
    Search.watch['filters.keyword'].call(search, '雨');
    await vi.advanceTimersByTimeAsync(250);
    resolveFirst([{ id: 1 }]); await Promise.resolve();
    expect(search.suggestions).toEqual([{ id: 2 }]);
    vi.useRealTimers();
  });
  it('retains a comment request id after a failed send to prevent duplicate comments', async () => {
    const detail = context(Detail, { targetId: 5, targetType: 'recording', form: { body: '乡音' }, $refs: { commentForm: { validate: async () => true } }, $emit: vi.fn() });
    createComment.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 1 });
    listComments.mockResolvedValue({ results: [], next: null });
    await detail.send(); expect(detail.form.body).toBe('乡音');
    await detail.send();
    expect(createComment.mock.calls[0][0].client_id).toBe(createComment.mock.calls[1][0].client_id);
    expect(detail.form.body).toBe('');
  });
});

describe('draft interruption recovery', () => {
  it('debounces editing and persists a dirty form when the page is hidden', async () => {
    vi.useFakeTimers();
    saveRecordingDraft.mockResolvedValue({ id: 'auto', audio: null });
    const page = context(RecordingCreate, { draftReady: true, ownerScope: 'user:1' });
    page.form.original_gloss = '月娘';
    page.scheduleDraft();
    page.form.original_gloss = '月娘出来了';
    page.scheduleDraft();
    await vi.advanceTimersByTimeAsync(700);
    expect(saveRecordingDraft).toHaveBeenCalledTimes(1);
    expect(saveRecordingDraft.mock.calls[0][0].form.original_gloss).toBe('月娘出来了');
    page.form.original_gloss = '又改了一句';
    RecordingCreate.onHide.call(page);
    await page.draftSavePromise;
    expect(saveRecordingDraft.mock.calls.at(-1)[0].form.original_gloss).toBe('又改了一句');
    vi.useRealTimers();
  });
  it('does not recreate a submitted draft or persist an untouched empty form', async () => {
    const page = context(RecordingCreate, { draftReady: true, ownerScope: 'user:1' });
    await page.persistDirtyDraft();
    expect(saveRecordingDraft).not.toHaveBeenCalled();
    page.form.original_gloss = '已经提交';
    page.submitted = true;
    await page.persistDirtyDraft();
    await page.saveDraft();
    expect(saveRecordingDraft).not.toHaveBeenCalled();
  });
  it('keeps the currently selected replacement audio during an in-flight save', async () => {
    let finish;
    saveRecordingDraft.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const page = context(RecordingCreate, { ownerScope: 'user:1', audio: { path: 'wxfile://old' } });
    const saving = page.saveDraft();
    await Promise.resolve(); await Promise.resolve();
    page.audio = { path: 'wxfile://replacement' };
    finish({ id: 'a', audio: { path: 'wxfile://saved-old' } });
    await saving;
    expect(page.audio.path).toBe('wxfile://replacement');
    expect(page.savedDraftSignature).not.toBe(page.draftSignature());
  });
});

describe('entry discussion payload', () => {
  it('posts to Entry discussion without accidentally attaching a Recording', async () => {
    const detail = context(Detail, { targetId: 9, targetType: 'entry', form: { body: '另一种用法' }, $refs: { commentForm: { validate: async () => true } }, $emit: vi.fn() });
    createComment.mockResolvedValue({ id: 1 });
    listComments.mockResolvedValue({ results: [], next: null });
    await detail.send();
    expect(createComment).toHaveBeenCalledWith(expect.objectContaining({ entry_id: 9 }), 'entry');
    expect(createComment.mock.calls[0][0]).not.toHaveProperty('recording_id');
    /* 顶层评论：不带 parent_id，用服务端默认页大小 */
    expect(listComments).toHaveBeenCalledWith(9, 1, 'entry', undefined, undefined);
  });
});

it('clears displayed draft content when returning under another account', () => {
  const page = context(RecordingCreate, { draftReady: true, ownerScope: 'user:1', draftId: 'old', audio: { path: 'wxfile://old' }, form: { original_gloss: 'private' }, goRecordingDrafts: vi.fn() });
  draftOwner.mockReturnValueOnce('user:2');
  RecordingCreate.onShow.call(page);
  expect(page.form.original_gloss).toBe('');
  expect(page.audio.path).toBe('');
  expect(page.draftId).toBe('');
  expect(page.goRecordingDrafts).toHaveBeenCalled();
  expect(saveRecordingDraft).not.toHaveBeenCalled();
});


describe('review regressions', () => {
  it('persists clearing an existing draft instead of restoring stale content', async () => {
    saveRecordingDraft.mockResolvedValueOnce({ id: 'existing', audio: null });
    const page = context(RecordingCreate, { draftReady: true, ownerScope: 'user:1', draftId: 'existing', savedDraftSignature: 'previous content' });
    await page.persistDirtyDraft();
    expect(saveRecordingDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 'existing', form: expect.objectContaining({ original_gloss: '' }) }), 'user:1');
  });
  it('retries incomplete audio persistence on leaving the page', async () => {
    saveRecordingDraft.mockResolvedValueOnce({ id: 'retry', audio: null, audioError: true }).mockResolvedValueOnce({ id: 'retry', audio: { path: 'saved' } });
    const page = context(RecordingCreate, { draftReady: true, ownerScope: 'user:1', audio: { path: 'temporary' } });
    await page.persistDirtyDraft();
    expect(page.savedDraftSignature).not.toBe(page.draftSignature());
    await page.persistDirtyDraft();
    expect(saveRecordingDraft).toHaveBeenCalledTimes(2);
    expect(page.savedDraftSignature).toBe(page.draftSignature());
  });
  it('does not repopulate a cleared page with another account’s in-flight save', async () => {
    let finish;
    saveRecordingDraft.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const page = context(RecordingCreate, { draftReady: true, ownerScope: 'user:1', audio: { path: 'old' }, goRecordingDrafts: vi.fn() });
    const saving = page.saveDraft();
    await Promise.resolve(); await Promise.resolve();
    draftOwner.mockReturnValue('user:2');
    RecordingCreate.onShow.call(page);
    finish({ id: 'private-draft', audio: { path: 'saved' } });
    await saving;
    expect(page.draftId).toBe('');
    expect(page.audio.path).toBe('');
    draftOwner.mockReturnValue('user:1');
  });
});
