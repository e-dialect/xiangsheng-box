import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/recordingDraftAudio', () => ({ persistDraftAudio: vi.fn(), restoreDraftAudio: vi.fn(), removeDraftAudio: vi.fn(), isDraftAudioAvailable: vi.fn() }));
import { persistDraftAudio, restoreDraftAudio, removeDraftAudio, isDraftAudioAvailable } from '@/services/recordingDraftAudio';
import {
  clearInvalidRecordingDraftAudio,
  discardLegacyRecordingDrafts,
  draftOwner,
  endGuestDraftSession,
  listLegacyRecordingDrafts,
  migrateLegacyRecordingDrafts,
  saveRecordingDraft,
  restoreRecordingDraft,
  listRecordingDrafts,
  deleteRecordingDraft,
  listRecordingDraftsWithAudioStatus,
  MAX_RECORDING_DRAFTS,
  RECORDING_DRAFT_LIMIT_ERROR,
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
  endGuestDraftSession();
  const secondOwner = draftOwner();
  expect(secondOwner).not.toBe(firstOwner);
  expect(listRecordingDrafts(secondOwner)).toEqual([]);
});

it('rejects a new draft at the limit before persisting audio or deleting an older draft', async () => {
  const owner = 'user:1';
  const existing = Array.from({ length: MAX_RECORDING_DRAFTS }, (_, index) => ({
    id: `draft-${index}`,
    owner,
    schemaVersion: 2,
    formatVersion: 2,
    form: { original_gloss: `草稿${index}` },
  }));
  storage.set(`recording_drafts:v2:${owner}`, JSON.stringify(existing));

  await expect(saveRecordingDraft(input(), owner)).rejects.toMatchObject({
    code: RECORDING_DRAFT_LIMIT_ERROR,
    limit: MAX_RECORDING_DRAFTS,
  });

  expect(persistDraftAudio).not.toHaveBeenCalled();
  expect(removeDraftAudio).not.toHaveBeenCalled();
  expect(listRecordingDrafts(owner).map((draft) => draft.id))
    .toEqual(existing.map((draft) => draft.id));
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

// Shape verified against 0c8d92d: canDrafts.createDraftPayload and
// cans/create.vue initialForm/initialLabel; values below are synthetic.
function historicDraft() {
  return {
    id: 'old-owned', ownerScope: 'user:1', mode: 'free',
    targetFlavor: { id: '', name: '' }, dialectName: '游洋话',
    form: {
      audio_url: '', concept_text: '膝盖', submitted_dialect_id: 2,
      source_note: '', duration_ms: 0,
    },
    label: {
      text_content: '骹头', definition: '', pronunciation_text: 'kʰa',
      package_type: 'uncertain', evidence_level: 1,
      source: { type: 'creator', title: '', attributed_to: '', locator: '', note: '' },
    },
    audio: null, reason: 'page_hide', createdAt: 100, updatedAt: 200,
  };
}

function storeLegacy(drafts) {
  const raw = JSON.stringify(drafts);
  storage.set('can_drafts:user:1', raw);
  return raw;
}

describe('historical owned can draft recovery', () => {
  it('maps historical fields and retains the source record and timestamps across later saves', async () => {
    const legacy = historicDraft();
    storeLegacy([legacy]);
    expect(await migrateLegacyRecordingDrafts()).toBe(1);
    const [draft] = listRecordingDrafts();
    expect(draft).toMatchObject({
      id: legacy.id, createdAt: 100, updatedAt: 200, recordingType: 'word', entryId: null,
      form: {
        original_gloss: '膝盖', usage_dialect_id: 2,
        original_writing: '骹头', original_pronunciation: 'kʰa',
      },
      legacySource: { key: 'can_drafts:user:1', record: legacy },
    });
    expect(storage.has('can_drafts:user:1')).toBe(false);
    expect(await migrateLegacyRecordingDrafts()).toBe(0);
    await saveRecordingDraft({ id: draft.id, form: { ...draft.form, original_gloss: '膝' } });
    expect(listRecordingDrafts()[0].legacySource.record).toEqual(legacy);
  });

  it('maps the earlier numeric dialect and text_content fields without guessing a Flavor ID', async () => {
    // 753145e: cans/create.vue initialForm/initialLabel and canDrafts.test.js.
    const legacy = historicDraft();
    legacy.form = { audio_url: '', concept_text: 'knee', dialect: 1, county: '', town: '', source_note: '', duration_ms: 0 };
    legacy.label = { text_content: 'khnee', definition: '', package_type: 'uncertain', evidence_level: 1, source_citation: '' };
    storeLegacy([legacy]);
    expect(await migrateLegacyRecordingDrafts()).toBe(1);
    expect(listRecordingDrafts()[0].form).toMatchObject({ original_gloss: 'knee', usage_dialect_id: 1, original_writing: 'khnee' });
  });

  it('reuses native saved-file audio without moving or deleting it', async () => {
    const legacy = historicDraft();
    legacy.audio = { path: '/saved/old.mp3', storage: 'saved-file', persisted: true, mediaId: 'can-draft-audio:old-owned', durationMs: 1200 };
    legacy.form.duration_ms = 1200;
    storeLegacy([legacy]);
    expect(await migrateLegacyRecordingDrafts()).toBe(1);
    expect(listRecordingDrafts()[0].audio).toEqual(legacy.audio);
    expect(persistDraftAudio).not.toHaveBeenCalled();
    expect(removeDraftAudio).not.toHaveBeenCalled();
  });

  it.each([
    ['old IndexedDB audio', (draft) => { draft.audio = { path: '', storage: 'indexeddb', mediaId: 'old', persisted: true }; }],
    ['temporary audio', (draft) => { draft.audio = { path: '/tmp/audio', persisted: false }; }],
    ['unknown fields', (draft) => { draft.form.future_field = 'keep me'; }],
    ['unsupported evidence', (draft) => { draft.label.source.note = 'source context'; }],
    ['old location text', (draft) => { draft.form.county = 'original region'; }],
    ['different definition', (draft) => { draft.label.definition = 'different gloss'; }],
    ['conflicting dialects', (draft) => { draft.form.dialect = 3; }],
    ['invalid dialect', (draft) => { draft.form.submitted_dialect_id = 'region'; }],
    ['coercible array dialect', (draft) => { draft.form.submitted_dialect_id = [2]; }],
    ['unknown recording type', (draft) => { draft.recordingType = 'story'; }],
    ['conflicting writing', (draft) => { draft.form.original_writing = 'other'; }],
    ['Flavor context', (draft) => { draft.mode = 'flavor'; draft.targetFlavor = { id: 9, name: 'knee' }; }],
    ['foreign owner', (draft) => { draft.ownerScope = 'user:2'; }],
    ['missing ID', (draft) => { delete draft.id; }],
  ])('keeps %s intact and visible for explicit legacy handling', async (_, change) => {
    const legacy = historicDraft();
    change(legacy);
    const raw = storeLegacy([legacy]);
    expect(await migrateLegacyRecordingDrafts()).toBe(0);
    expect(storage.get('can_drafts:user:1')).toBe(raw);
    expect(listRecordingDrafts()).toEqual([]);
    expect(persistDraftAudio).not.toHaveBeenCalled();
    expect(removeDraftAudio).not.toHaveBeenCalled();
  });

  it('never overwrites a same-ID V2 draft, even if legacy cleanup previously failed', async () => {
    const legacy = historicDraft();
    storeLegacy([legacy]);
    uni.removeStorageSync.mockImplementationOnce(() => { throw new Error('storage unavailable'); });
    await expect(migrateLegacyRecordingDrafts()).rejects.toThrow('storage unavailable');
    await saveRecordingDraft({ id: legacy.id, form: { original_gloss: 'newer edit' } });
    const raw = storage.get('recording_drafts:v2:user:1');
    expect(await migrateLegacyRecordingDrafts()).toBe(0);
    expect(storage.get('recording_drafts:v2:user:1')).toBe(raw);
    expect(JSON.parse(storage.get('can_drafts:user:1'))).toEqual([legacy]);
  });

  it('keeps malformed records in a partially recovered bucket', async () => {
    const unknown = { id: 'unknown', form: { extra: 'keep' } };
    storeLegacy([historicDraft(), null, 5, unknown]);
    expect(await migrateLegacyRecordingDrafts()).toBe(1);
    expect(JSON.parse(storage.get('can_drafts:user:1'))).toEqual([null, 5, unknown]);
  });

  it('preserves all legacy data when the V2 write fails or its index is corrupt', async () => {
    const raw = storeLegacy([historicDraft()]);
    storage.set('recording_drafts:v2:user:1', 'broken');
    expect(await migrateLegacyRecordingDrafts()).toBe(0);
    expect(storage.get('recording_drafts:v2:user:1')).toBe('broken');
    storage.delete('recording_drafts:v2:user:1');
    uni.setStorageSync.mockImplementationOnce(() => { throw new Error('quota'); });
    await expect(migrateLegacyRecordingDrafts()).rejects.toThrow('quota');
    expect(storage.get('can_drafts:user:1')).toBe(raw);
    expect(removeDraftAudio).not.toHaveBeenCalled();
  });

  it('recovers only available quota and retains duplicate IDs plus other owners/unscoped buckets', async () => {
    const existing = Array.from({ length: MAX_RECORDING_DRAFTS - 1 }, (_, index) => ({
      id: `current-${index}`, owner: 'user:1', form: { original_gloss: 'existing' },
    }));
    storage.set('recording_drafts:v2:user:1', JSON.stringify(existing));
    const first = historicDraft();
    const second = { ...historicDraft(), id: 'second' };
    storeLegacy([first, first, second]);
    storage.set('can_drafts:user:2', JSON.stringify([historicDraft()]));
    storage.set('can_drafts', JSON.stringify([historicDraft()]));
    const foreign = storage.get('can_drafts:user:2');
    const unscoped = storage.get('can_drafts');
    expect(await migrateLegacyRecordingDrafts()).toBe(1);
    expect(listRecordingDrafts()).toHaveLength(MAX_RECORDING_DRAFTS);
    expect(JSON.parse(storage.get('can_drafts:user:1'))).toEqual([first, second]);
    expect(storage.get('can_drafts:user:2')).toBe(foreign);
    expect(storage.get('can_drafts')).toBe(unscoped);
    expect(removeDraftAudio).not.toHaveBeenCalled();
  });
});


it.each(['word', 'phrase', 'example', 'other'])('preserves explicit V2 %s drafts and Entry context', async (type) => {
  storeLegacy([{
    id: 'v2-compatible',
    form: { original_gloss: 'compatible', usage_dialect_id: '2', recording_type: type },
    recordingType: type, entryId: '9', audio: null,
  }]);
  expect(await migrateLegacyRecordingDrafts()).toBe(1);
  expect(listRecordingDrafts()[0]).toMatchObject({
    recordingType: type, entryId: 9,
    form: { original_gloss: 'compatible', usage_dialect_id: 2, recording_type: type },
  });
});
