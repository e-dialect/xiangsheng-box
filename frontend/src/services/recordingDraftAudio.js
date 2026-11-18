const DB_NAME = 'guantou-recording-drafts-v2';
const DB_VERSION = 1;
const STORE_NAME = 'audio';

function isWebPlatform() {
  try {
    return uni.getSystemInfoSync().uniPlatform === 'web';
  } catch (error) {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }
}

function audioMetadata(audio = {}, overrides = {}) {
  return {
    path: '',
    name: audio.name || '',
    durationMs: audio.durationMs || 0,
    origin: audio.origin || '',
    mediaId: audio.mediaId || '',
    storage: audio.storage || '',
    persisted: Boolean(audio.persisted),
    available: audio.available !== false,
    ...overrides,
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持持久化录音'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开录音存储'));
  });
}

async function useObjectStore(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('录音存储操作失败'));
      transaction.onabort = () => reject(transaction.error || new Error('录音存储事务失败'));
    });
  } finally {
    database.close();
  }
}

async function blobForAudio(audio) {
  if (typeof Blob !== 'undefined' && audio.blob instanceof Blob) return audio.blob;
  if (!audio.path || typeof fetch !== 'function') {
    throw new Error('录音内容不可用');
  }
  const response = await fetch(audio.path);
  if (!response.ok) throw new Error('无法读取录音内容');
  return response.blob();
}

function callUniFileApi(method, options) {
  return new Promise((resolve, reject) => {
    if (typeof uni[method] !== 'function') {
      reject(new Error(`当前平台不支持 ${method}`));
      return;
    }
    uni[method]({
      ...options,
      success: resolve,
      fail: reject,
    });
  });
}

export async function isDraftAudioAvailable(audio) {
  if (!audio || !audio.persisted) return false;
  if (audio.storage === 'indexeddb') {
    try {
      return Boolean(await useObjectStore('readonly', (store) => store.get(audio.mediaId)));
    } catch (error) {
      return false;
    }
  }
  if (audio.storage === 'saved-file' && audio.path) {
    try {
      await callUniFileApi('getSavedFileInfo', { filePath: audio.path });
      return true;
    } catch (error) {
      return false;
    }
  }
  return false;
}

async function persistWebAudio(audio, mediaId) {
  if (audio.persisted && audio.storage === 'indexeddb' && audio.mediaId) {
    const available = await isDraftAudioAvailable(audio);
    if (available) {
      return audioMetadata(audio, {
        mediaId: audio.mediaId,
        storage: 'indexeddb',
        persisted: true,
        available: true,
      });
    }
  }
  const blob = await blobForAudio(audio);
  await useObjectStore('readwrite', (store) => store.put(blob, mediaId));
  return audioMetadata(audio, {
    mediaId,
    storage: 'indexeddb',
    persisted: true,
    available: true,
  });
}

async function persistSavedFile(audio, mediaId) {
  if (audio.persisted && audio.storage === 'saved-file' && audio.path) {
    const available = await isDraftAudioAvailable(audio);
    if (available) {
      return audioMetadata(audio, {
        path: audio.path,
        mediaId: audio.mediaId,
        storage: 'saved-file',
        persisted: true,
        available: true,
      });
    }
  }
  const result = await callUniFileApi('saveFile', { tempFilePath: audio.path });
  return audioMetadata(audio, {
    path: result.savedFilePath,
    mediaId,
    storage: 'saved-file',
    persisted: true,
    available: true,
  });
}

export async function persistDraftAudio(audio, mediaId) {
  if (!audio) return null;
  // A failed preview still refers to saved audio. Text-only edits must not
  // replace that reference with null and delete its Blob. Explicit removal
  // clears persistence metadata along with the path in the recording page.
  if (!audio.path && audio.persisted && audio.storage === 'indexeddb' && audio.mediaId) {
    return audioMetadata(audio, { available: false });
  }
  if (!audio.path) return null;
  if (isWebPlatform()) return persistWebAudio(audio, mediaId);
  return persistSavedFile(audio, mediaId);
}

export async function restoreDraftAudio(audio) {
  if (!audio) return null;
  const unavailable = () => audioMetadata(audio, {
    path: '',
    persisted: Boolean(audio.persisted),
    available: false,
    invalid: true,
  });
  if (audio.persisted && audio.storage === 'indexeddb') {
    try {
      // Restore the same Blob we checked, without a second storage transaction.
      const blob = await useObjectStore('readonly', (store) => store.get(audio.mediaId));
      if (!blob) return unavailable();
      return audioMetadata(audio, {
        path: URL.createObjectURL(blob),
        persisted: true,
        available: true,
        invalid: false,
      });
    } catch (error) {
      // Audio failure must not prevent restoring the draft's text and entry.
      // Keep persistence metadata so opening the draft again can retry.
      return unavailable();
    }
  }
  if (!(await isDraftAudioAvailable(audio))) return unavailable();
  return audioMetadata(audio, {
    path: audio.path,
    mediaId: audio.mediaId,
    storage: audio.storage,
    persisted: true,
    available: true,
    invalid: false,
  });
}

export function releaseDraftAudioUrl(audio) {
  if (audio?.path?.startsWith('blob:') && typeof URL !== 'undefined') {
    URL.revokeObjectURL(audio.path);
  }
}

export async function removeDraftAudio(audio) {
  if (!audio || !audio.persisted) return;
  if (audio.storage === 'indexeddb' && audio.mediaId) {
    try {
      await useObjectStore('readwrite', (store) => store.delete(audio.mediaId));
    } catch (error) {
      // Missing browser storage is equivalent to an already removed recording.
    }
  } else if (audio.storage === 'saved-file' && audio.path) {
    try {
      await callUniFileApi('removeSavedFile', { filePath: audio.path });
    } catch (error) {
      // Missing saved files are safe to treat as already removed.
    }
  }
  releaseDraftAudioUrl(audio);
}

export default {
  isDraftAudioAvailable,
  persistDraftAudio,
  releaseDraftAudioUrl,
  removeDraftAudio,
  restoreDraftAudio,
};
