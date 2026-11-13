import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { restoreRecordingDraft, saveRecordingDraft } from '@/services/recordingDrafts';
import {
  persistDraftAudio, restoreDraftAudio, isDraftAudioAvailable, removeDraftAudio,
} from '@/services/recordingDraftAudio';

function indexedDatabase({ abort = false, read = () => {} } = {}) {
  const values = new Map();
  const db = {
    objectStoreNames: { contains: () => true },
    close: vi.fn(),
    transaction() {
      const tx = {
        objectStore() {
          const operation = (kind, value, key) => {
            const request = {};
            queueMicrotask(() => {
              if (abort) { tx.onabort(); return; }
              if (kind === 'put') { values.set(key, value); request.result = key; } else if (kind === 'get') {
                const error = read();
                if (error) { tx.error = error; tx.onabort(); return; }
                request.result = values.get(value);
              } else values.delete(value);
              tx.oncomplete();
            });
            return request;
          };
          return { put: (value, key) => operation('put', value, key), get: (key) => operation('get', key), delete: (key) => operation('delete', key) };
        },
      };
      return tx;
    },
  };
  return {
    open: () => {
      const request = { result: db };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  };
}
beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.uni = { getSystemInfoSync: () => ({ uniPlatform: 'web' }) };
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:restored') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
describe('durable audio storage adapted from v1', () => {
  it('round-trips a Blob and releases persistent audio on deletion', async () => {
    globalThis.indexedDB = indexedDatabase();
    const audio = await persistDraftAudio({ path: 'blob:tmp', blob: new Blob(['audio']) }, 'user:1:a');
    expect((await restoreDraftAudio(audio)).path).toBe('blob:restored');
    await removeDraftAudio(audio);
    expect(await isDraftAudioAvailable(audio)).toBe(false);
    expect((await restoreDraftAudio(audio)).invalid).toBe(true);
  });
  it('rejects an aborted transaction rather than announcing successful persistence', async () => {
    globalThis.indexedDB = indexedDatabase({ abort: true });
    await expect(persistDraftAudio({ path: 'blob:tmp', blob: new Blob(['audio']) }, 'a')).rejects.toThrow('事务失败');
  });
  it('saves and reuses a mini-program persistent file', async () => {
    globalThis.uni = {
      getSystemInfoSync: () => ({ uniPlatform: 'mp-weixin' }),
      saveFile: vi.fn(({ success }) => success({ savedFilePath: 'wxfile://saved' })),
      getSavedFileInfo: vi.fn(({ success }) => success({ size: 10 })),
      removeSavedFile: vi.fn(({ success }) => success({})),
    };
    const saved = await persistDraftAudio({ path: 'wxfile://temp' }, 'a');
    expect((await restoreDraftAudio(saved)).path).toBe('wxfile://saved');
    await persistDraftAudio(saved, 'a');
    expect(uni.saveFile).toHaveBeenCalledTimes(1);
    await removeDraftAudio(saved);
    expect(uni.removeSavedFile).toHaveBeenCalled();
  });
});

describe('interrupted browser draft restoration', () => {
  it('restores from one read rather than failing if a redundant second read aborts', async () => {
    const read = vi.fn().mockReturnValueOnce(null).mockReturnValue(new Error('storage interrupted'));
    globalThis.indexedDB = indexedDatabase({ read });
    const saved = await persistDraftAudio({ path: 'blob:tmp', blob: new Blob(['audio']) }, 'saved');
    await expect(restoreDraftAudio(saved)).resolves.toMatchObject({ path: 'blob:restored', available: true });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps text and entry when the preview cannot open, then restores audio on retry', async () => {
    globalThis.indexedDB = indexedDatabase();
    const audio = await persistDraftAudio({ path: 'blob:tmp', blob: new Blob(['audio']) }, 'saved');
    const draft = {
      id: 'draft', owner: 'user:1', form: { original_gloss: '月娘' }, entryId: 3, audio,
    };
    uni.getStorageSync = vi.fn(() => JSON.stringify([draft]));
    URL.createObjectURL.mockImplementationOnce(() => { throw new Error('preview unavailable'); });
    await expect(restoreRecordingDraft('draft', 'user:1')).resolves.toMatchObject({
      form: draft.form,
      entryId: 3,
      audio: {
        path: '', invalid: true, available: false, mediaId: 'saved',
      },
    });
    await expect(restoreRecordingDraft('draft', 'user:1')).resolves.toMatchObject({
      form: draft.form, entryId: 3, audio: { path: 'blob:restored', invalid: false, available: true },
    });
    expect(await isDraftAudioAvailable(audio)).toBe(true);
  });

  it('keeps persisted metadata on a failed read and retries without deleting the blob', async () => {
    const read = vi.fn().mockReturnValueOnce(new Error('storage busy')).mockReturnValue(null);
    globalThis.indexedDB = indexedDatabase({ read });
    const saved = await persistDraftAudio({ path: 'blob:tmp', blob: new Blob(['audio']) }, 'saved');
    await expect(restoreDraftAudio(saved)).resolves.toMatchObject({
      path: '', invalid: true, mediaId: 'saved', persisted: true,
    });
    await expect(restoreDraftAudio(saved)).resolves.toMatchObject({ path: 'blob:restored', invalid: false });
  });
});

it('preserves unavailable persisted audio when editing text, but honors explicit removal', async () => {
  globalThis.indexedDB = indexedDatabase();
  const storage = new Map();
  uni.getStorageSync = vi.fn((key) => storage.get(key));
  uni.setStorageSync = vi.fn((key, value) => storage.set(key, value));
  const original = await saveRecordingDraft({
    form: { original_gloss: '原文字' },
    entryId: 3,
    audio: { path: 'blob:tmp', blob: new Blob(['audio']) },
  }, 'user:1');
  URL.createObjectURL.mockImplementationOnce(() => { throw new Error('preview unavailable'); });
  const restored = await restoreRecordingDraft(original.id, 'user:1');
  expect(restored.audio.path).toBe('');
  await saveRecordingDraft({ ...restored, form: { original_gloss: '修改后的文字' } }, 'user:1');
  const retry = await restoreRecordingDraft(original.id, 'user:1');
  expect(retry.audioInvalid).toBe(false);
  expect(retry).toMatchObject({
    form: { original_gloss: '修改后的文字' },
    entryId: 3,
    audio: { path: 'blob:restored', mediaId: original.audio.mediaId, available: true },
  });
  await saveRecordingDraft({ ...retry, audio: { path: '' } }, 'user:1');
  expect(await isDraftAudioAvailable(original.audio)).toBe(false);
  expect((await restoreRecordingDraft(original.id, 'user:1')).audio).toBeNull();
});
