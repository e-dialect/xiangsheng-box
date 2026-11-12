import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { isDraftAudioAvailable, removeDraftAudio } from '@/services/recordingDraftAudio';
import { clearInvalidRecordingDraftAudio, listRecordingDrafts } from '@/services/recordingDrafts';

vi.mock('@/services/recordingDraftAudio', () => ({
  persistDraftAudio: vi.fn(),
  restoreDraftAudio: vi.fn(),
  removeDraftAudio: vi.fn(),
  isDraftAudioAvailable: vi.fn(),
}));

const owner = 'user:1';
const key = `recording_drafts:v2:${owner}`;
let storage;
const draft = (id, extra = {}) => ({
  id,
  owner,
  schemaVersion: 2,
  formatVersion: 2,
  recordingType: 'word',
  form: { original_gloss: '原来的文字' },
  audio: { mediaId: id, storage: 'indexeddb', persisted: true },
  ...extra,
});
const putDrafts = (items) => storage.set(key, JSON.stringify(items));

beforeEach(() => {
  vi.resetAllMocks();
  storage = new Map();
  globalThis.uni = {
    getStorageSync: vi.fn((name) => storage.get(name)),
    setStorageSync: vi.fn((name, value) => storage.set(name, value)),
  };
});

describe('draft cleanup while another page saves', () => {
  function startCleanup(items, otherChecks = []) {
    putDrafts(items);
    let finishCheck;
    isDraftAudioAvailable.mockImplementationOnce(() => new Promise((resolve) => {
      finishCheck = resolve;
    }));
    otherChecks.forEach((available) => isDraftAudioAvailable.mockResolvedValueOnce(available));
    return {
      cleanup: clearInvalidRecordingDraftAudio(owner),
      finishCheck: () => finishCheck(false),
    };
  }

  it('preserves drafts added while audio availability is being checked', async () => {
    const original = draft('missing');
    const { cleanup, finishCheck } = startCleanup([original]);
    const added = draft('new', { form: { original_gloss: '刚录的乡音' } });
    putDrafts([added, original]);
    finishCheck();

    expect(await cleanup).toBe(1);
    expect(listRecordingDrafts(owner)).toEqual([
      added,
      expect.objectContaining({ id: original.id, audio: null, audioInvalid: true }),
    ]);
    expect(removeDraftAudio).toHaveBeenCalledTimes(1);
    expect(removeDraftAudio).toHaveBeenCalledWith(original.audio);
  });

  it('keeps the latest text when the same unavailable audio is still attached', async () => {
    const original = draft('missing');
    const { cleanup, finishCheck } = startCleanup([original]);
    putDrafts([{ ...original, form: { original_gloss: '刚补充的说明', usage_dialect_id: 9 } }]);
    finishCheck();

    expect(await cleanup).toBe(1);
    expect(listRecordingDrafts(owner)[0]).toMatchObject({
      form: { original_gloss: '刚补充的说明', usage_dialect_id: 9 },
      audio: null,
      audioInvalid: true,
    });
  });

  it.each([
    ['browser recording', { mediaId: 'new-recording', storage: 'indexeddb', persisted: true }],
    ['native saved file', {
      mediaId: 'new-recording', storage: 'saved-file', path: 'wxfile://new', persisted: true,
    }],
  ])('does not clear a replacement %s based on the old audio check', async (name, audio) => {
    const original = draft('missing');
    const { cleanup, finishCheck } = startCleanup([original]);
    const replacement = { ...original, form: { original_gloss: '重新录好了' }, audio };
    putDrafts([replacement]);
    finishCheck();

    expect(await cleanup).toBe(0);
    expect(listRecordingDrafts(owner)).toEqual([replacement]);
    expect(removeDraftAudio).not.toHaveBeenCalled();
    expect(uni.setStorageSync).not.toHaveBeenCalled();
  });

  it('does not resurrect a draft deleted while its audio was being checked', async () => {
    const { cleanup, finishCheck } = startCleanup([draft('missing')]);
    putDrafts([]);
    finishCheck();

    expect(await cleanup).toBe(0);
    expect(listRecordingDrafts(owner)).toEqual([]);
    expect(removeDraftAudio).not.toHaveBeenCalled();
    expect(uni.setStorageSync).not.toHaveBeenCalled();
  });

  it('preserves a replacement native path even when its media ID is reused', async () => {
    const audio = {
      mediaId: 'same', storage: 'saved-file', path: 'wxfile://old', persisted: true,
    };
    const original = draft('native', { audio });
    const { cleanup, finishCheck } = startCleanup([original]);
    const replacement = { ...original, audio: { ...audio, path: 'wxfile://new' } };
    putDrafts([replacement]);
    finishCheck();

    expect(await cleanup).toBe(0);
    expect(listRecordingDrafts(owner)).toEqual([replacement]);
    expect(removeDraftAudio).not.toHaveBeenCalled();
  });

  it('only counts unchanged invalid audio in a mixed batch and preserves text-only edits', async () => {
    const missing = draft('missing');
    const removedAudio = draft('removed-audio');
    const valid = draft('valid');
    const { cleanup, finishCheck } = startCleanup([missing, removedAudio, valid], [false, true]);
    // The other checks are scheduled synchronously when cleanup starts.
    const textOnly = { ...removedAudio, form: { original_gloss: '保留新文字' }, audio: null };
    putDrafts([missing, textOnly, valid]);
    finishCheck();

    expect(await cleanup).toBe(1);
    expect(listRecordingDrafts(owner)).toEqual([
      expect.objectContaining({ id: missing.id, audio: null, audioInvalid: true }),
      textOnly,
      valid,
    ]);
    expect(removeDraftAudio).toHaveBeenCalledTimes(1);
    expect(removeDraftAudio).toHaveBeenCalledWith(missing.audio);
  });

  it('does not remove stored audio when the metadata update fails', async () => {
    const original = draft('missing');
    const { cleanup, finishCheck } = startCleanup([original]);
    uni.setStorageSync.mockImplementationOnce(() => { throw new Error('quota'); });
    finishCheck();

    await expect(cleanup).rejects.toThrow('quota');
    expect(listRecordingDrafts(owner)).toEqual([original]);
    expect(removeDraftAudio).not.toHaveBeenCalled();
  });
});
