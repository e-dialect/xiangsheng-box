import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/recordingDraftAudio', () => ({ persistDraftAudio: vi.fn(), restoreDraftAudio: vi.fn(), removeDraftAudio: vi.fn(), isDraftAudioAvailable: vi.fn() }));
import { persistDraftAudio, restoreDraftAudio, removeDraftAudio, isDraftAudioAvailable } from '@/services/recordingDraftAudio';
import {
  clearInvalidRecordingDraftAudio,
  discardLegacyRecordingDrafts,
  draftOwner,
  listLegacyRecordingDrafts,
  migrateLegacyRecordingDrafts,
  saveRecordingDraft,
  restoreRecordingDraft,
  listRecordingDrafts,
  deleteRecordingDraft,
  listRecordingDraftsWithAudioStatus,
} from '@/services/recordingDrafts';
import { searchHistory, rememberSearch, clearSearchHistory } from '@/services/entrySearchAssist';

let storage;
let user;
beforeEach(() => {
  vi.resetAllMocks(); storage = new Map(); user = 1;
  globalThis.uni = { getStorageSync: vi.fn((key) => key === 'id' ? user : storage.get(key)), setStorageSync: vi.fn((key, value) => storage.set(key, value)), removeStorageSync: vi.fn((key) => storage.delete(key)) };
});
const input = () => ({ form: { original_gloss: '月娘', usage_dialect_id: 2 }, audio: { path: 'blob:audio' }, entryId: 3 });
describe('Recording draft lifecycle', () => {
  it('restores fields and audio after a refresh, keeps logout data isolated, then cleans submitted drafts', async () => {
    persistDraftAudio.mockResolvedValue({ persisted: true, mediaId: 'a', storage: 'indexeddb' });
    restoreDraftAudio.mockResolvedValue({ path: 'blob:restored', persisted: true });
    const saved = await saveRecordingDraft(input());
    expect(listRecordingDrafts()).toHaveLength(1);
    const restored = await restoreRecordingDraft(saved.id);
    expect(restored.form).toEqual(input().form);
    expect(restored.entryId).toBe(3);
    expect(restored.audio.path).toBe('blob:restored');
    user = ''; expect(listRecordingDrafts()).toEqual([]);
    user = 2; await expect(restoreRecordingDraft(saved.id)).rejects.toThrow('其他账号');
    user = 1; expect(listRecordingDrafts()).toHaveLength(1);
    await deleteRecordingDraft(saved.id);
    expect(listRecordingDrafts()).toEqual([]);
    expect(removeDraftAudio).toHaveBeenCalledWith(expect.objectContaining({ mediaId: 'a' }));
  });
  it('distinguishes text-only saving from successful audio persistence', async () => {
    persistDraftAudio.mockRejectedValue(new Error('quota'));
    const saved = await saveRecordingDraft(input());
    expect(saved.audioError).toBe(true);
    expect(saved.audio).toBeNull();
    expect(listRecordingDrafts()[0].form.original_gloss).toBe('月娘');
  });
  it('does not destroy the last saved draft when metadata storage fails', async () => {
    persistDraftAudio.mockResolvedValueOnce({ persisted: true, mediaId: 'old' });
    const old = await saveRecordingDraft(input());
    persistDraftAudio.mockResolvedValueOnce({ persisted: true, mediaId: 'new' });
    uni.setStorageSync.mockImplementationOnce(() => { throw new Error('quota'); });
    await expect(saveRecordingDraft({ ...input(), id: old.id })).rejects.toThrow('空间不足');
    expect(listRecordingDrafts()[0].audio.mediaId).toBe('old');
    expect(removeDraftAudio).toHaveBeenCalledWith(expect.objectContaining({ mediaId: 'new' }));
    expect(removeDraftAudio).not.toHaveBeenCalledWith(expect.objectContaining({ mediaId: 'old' }));
  });
  it('never imports archived can drafts', () => {
    storage.set('can_drafts:user:1', '[{"id":"old"}]');
    expect(listRecordingDrafts()).toEqual([]);
    expect(storage.has('can_drafts:user:1')).toBe(true);
  });
  it('retains a moved native file for retry when the draft index cannot be written', async () => {
    const audio = { persisted: true, mediaId: 'native', storage: 'saved-file', path: '/saved/audio' };
    persistDraftAudio.mockResolvedValueOnce(audio);
    uni.setStorageSync.mockImplementationOnce(() => { throw new Error('quota'); });
    await expect(saveRecordingDraft(input())).rejects.toMatchObject({ persistedAudio: audio });
    expect(removeDraftAudio).not.toHaveBeenCalled();
    expect(listRecordingDrafts()).toEqual([]);
  });
  it('keeps the previous form and audio when replacement audio cannot be saved', async () => {
    persistDraftAudio.mockResolvedValueOnce({ persisted: true, mediaId: 'old' });
    const old = await saveRecordingDraft(input());
    persistDraftAudio.mockRejectedValueOnce(new Error('quota'));
    await expect(saveRecordingDraft({ ...input(), id: old.id, form: { original_gloss: 'new' } }))
      .rejects.toThrow('原草稿已保留');
    expect(listRecordingDrafts()[0]).toEqual(old);
    expect(removeDraftAudio).not.toHaveBeenCalled();
  });
});
describe('local search history', () => {
  it('deduplicates, isolates accounts, caps history and clears only the current account', () => {
    for (let index = 0; index < 15; index += 1) rememberSearch(`word${index}`);
    rememberSearch('word14'); expect(searchHistory()).toHaveLength(10);
    user = 2; expect(searchHistory()).toEqual([]); rememberSearch('月娘'); clearSearchHistory();
    expect(searchHistory()).toEqual([]); user = 1; expect(searchHistory()).toHaveLength(10);
  });
});

it('checks whether persisted draft audio still exists without discarding its text', async () => {
  persistDraftAudio.mockResolvedValue({ persisted: true, mediaId: 'missing' });
  await saveRecordingDraft(input());
  isDraftAudioAvailable.mockResolvedValue(false);
  const rows = await listRecordingDraftsWithAudioStatus();
  expect(rows[0].audio.available).toBe(false);
  expect(rows[0].form.original_gloss).toBe('月娘');
  expect(listRecordingDrafts()).toHaveLength(1);
});

it('writes an explicit v2 schema and isolates guest sessions', async () => {
  persistDraftAudio.mockResolvedValue(null);
  user = '';
  const firstOwner = draftOwner();
  await saveRecordingDraft({ form: { original_gloss: 'guest text' } }, firstOwner);
  expect(listRecordingDrafts(firstOwner)[0]).toMatchObject({
    schemaVersion: 2,
    formatVersion: 2,
    owner: firstOwner,
  });
  storage.delete('recording_drafts:guest_session:v2');
  const secondOwner = draftOwner();
  expect(secondOwner).not.toBe(firstOwner);
  expect(listRecordingDrafts(secondOwner)).toEqual([]);
});

it('clears only unavailable audio and keeps the draft fields', async () => {
  persistDraftAudio.mockResolvedValue({ persisted: true, mediaId: 'missing', storage: 'indexeddb' });
  await saveRecordingDraft(input());
  isDraftAudioAvailable.mockResolvedValue(false);
  expect(await clearInvalidRecordingDraftAudio()).toBe(1);
  expect(listRecordingDrafts()[0]).toMatchObject({ audio: null, audioInvalid: true });
  expect(listRecordingDrafts()[0].form.original_gloss).toBe(input().form.original_gloss);
});

it('does not import unmappable legacy can drafts and exposes an explicit cleanup path', async () => {
  storage.set('can_drafts:user:1', JSON.stringify([{ id: 'legacy', form: { concept_text: 'old' } }]));
  uni.getStorageInfoSync = vi.fn(() => ({ keys: ['can_drafts:user:1'] }));
  expect(listLegacyRecordingDrafts()).toHaveLength(1);
  expect(await migrateLegacyRecordingDrafts('user:1')).toBe(0);
  expect(listRecordingDrafts('user:1')).toEqual([]);
  expect(discardLegacyRecordingDrafts({ owner: 'user:1' })).toBe(1);
  expect(listLegacyRecordingDrafts()).toEqual([]);
});
