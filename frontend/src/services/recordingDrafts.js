import {
  persistDraftAudio, restoreDraftAudio, removeDraftAudio, isDraftAudioAvailable,
} from './recordingDraftAudio';

export const RECORDING_DRAFT_SCHEMA_VERSION = 2;
export const MAX_RECORDING_DRAFTS = 20;

const STORAGE_PREFIX = 'recording_drafts:v2:';
const GUEST_SESSION_KEY = 'recording_drafts:guest_session:v2';
const LEGACY_PREFIX = 'can_drafts:';
const LEGACY_UNSCOPED_KEY = 'can_drafts';

const key = (owner) => `${STORAGE_PREFIX}${owner}`;

function createGuestSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function draftOwner() {
  const id = uni.getStorageSync('id');
  if (id !== '' && id !== null && id !== undefined) return `user:${id}`;

  // A shared `guest` bucket would expose one visitor's unfinished recording to
  // the next visitor on the same device. Keep an anonymous scope in storage so
  // guest drafts survive a refresh while remaining isolated from other guests.
  let sessionId = uni.getStorageSync(GUEST_SESSION_KEY);
  if (!sessionId) {
    sessionId = createGuestSessionId();
    uni.setStorageSync(GUEST_SESSION_KEY, sessionId);
  }
  return `guest:${sessionId}`;
}

function parseItems(owner) {
  try {
    const items = JSON.parse(uni.getStorageSync(key(owner)) || '[]');
    if (!Array.isArray(items)) return [];
    return items
      .filter((item) => item && typeof item === 'object' && item.owner === owner)
      .map((item) => ({
        ...item,
        schemaVersion: item.schemaVersion || RECORDING_DRAFT_SCHEMA_VERSION,
        formatVersion: item.formatVersion || item.schemaVersion || RECORDING_DRAFT_SCHEMA_VERSION,
        form: item.form && typeof item.form === 'object' ? { ...item.form } : {},
        recordingType: item.recordingType || item.form?.recording_type || 'word',
      }));
  } catch (error) {
    return [];
  }
}

export function listRecordingDrafts(owner = draftOwner()) {
  return parseItems(owner);
}

function sameAudio(left, right) {
  if (!left || !right) return false;
  return left.mediaId === right.mediaId
    && left.storage === right.storage
    && left.path === right.path;
}

export async function saveRecordingDraft({
  id,
  form = {},
  audio,
  entryId,
  recordingType,
}, owner = draftOwner()) {
  const draftId = id || `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const old = listRecordingDrafts(owner).find((item) => item.id === draftId);
  let storedAudio = null;
  let audioError = false;
  try {
    storedAudio = await persistDraftAudio(audio, `${owner}:${draftId}:${Date.now()}`);
  } catch (error) {
    if (old?.audio) throw new Error('音频保存失败，原草稿已保留，请保留本页重试');
    audioError = true;
  }

  const item = {
    id: draftId,
    owner,
    schemaVersion: RECORDING_DRAFT_SCHEMA_VERSION,
    formatVersion: RECORDING_DRAFT_SCHEMA_VERSION,
    form: { ...form },
    recordingType: recordingType || form.recording_type || 'word',
    entryId: entryId || null,
    audio: storedAudio,
    audioError,
    audioInvalid: Boolean(audio?.invalid),
    createdAt: old?.createdAt || old?.updatedAt || Date.now(),
    updatedAt: Date.now(),
  };

  // Re-read after async audio persistence so another draft's save is not overwritten.
  const existing = listRecordingDrafts(owner).filter((draft) => draft.id !== draftId);
  const next = [item, ...existing];
  const evicted = next.slice(MAX_RECORDING_DRAFTS);
  try {
    uni.setStorageSync(key(owner), JSON.stringify(next.slice(0, MAX_RECORDING_DRAFTS)));
  } catch (error) {
    // saveFile moves the temporary file. Keep its new path available for retry.
    if (storedAudio?.storage === 'saved-file') {
      const failure = new Error('草稿空间不足，请保留本页并重试');
      failure.persistedAudio = storedAudio;
      throw failure;
    }
    if (!sameAudio(storedAudio, old?.audio)) await removeDraftAudio(storedAudio);
    throw new Error('草稿空间不足，请保留本页并重试');
  }
  if (old?.audio && !sameAudio(old.audio, storedAudio)) await removeDraftAudio(old.audio);
  await Promise.all(evicted.map((draft) => removeDraftAudio(draft.audio)));
  return item;
}

export async function restoreRecordingDraft(id, owner = draftOwner()) {
  const item = listRecordingDrafts(owner).find((draft) => draft.id === id);
  if (!item) throw new Error('草稿不存在或属于其他账号');
  return {
    ...item,
    audio: await restoreDraftAudio(item.audio),
  };
}

export async function deleteRecordingDraft(id, owner = draftOwner()) {
  const items = listRecordingDrafts(owner);
  const item = items.find((draft) => draft.id === id);
  uni.setStorageSync(key(owner), JSON.stringify(items.filter((draft) => draft.id !== id)));
  await removeDraftAudio(item?.audio);
}

export async function listRecordingDraftsWithAudioStatus(owner = draftOwner()) {
  return Promise.all(listRecordingDrafts(owner).map(async (item) => {
    if (!item.audio) return item;
    const available = await isDraftAudioAvailable(item.audio);
    return {
      ...item,
      audio: { ...item.audio, available, invalid: !available || item.audio.invalid },
    };
  }));
}

/** Remove broken audio references while deliberately retaining the text draft. */
export async function clearInvalidRecordingDraftAudio(owner = draftOwner()) {
  const items = listRecordingDrafts(owner);
  const availability = await Promise.all(items.map((item) => (
    item.audio ? isDraftAudioAvailable(item.audio) : true
  )));
  const invalid = items.filter((item, index) => item.audio && !availability[index]);
  if (!invalid.length) return 0;

  const invalidIds = new Set(invalid.map((item) => item.id));
  const updatedAt = Date.now();
  const next = items.map((item) => (invalidIds.has(item.id)
    ? {
      ...item,
      audio: null,
      audioError: false,
      audioInvalid: true,
      updatedAt,
    }
    : item));
  uni.setStorageSync(key(owner), JSON.stringify(next));
  await Promise.all(invalid.map((item) => removeDraftAudio(item.audio)));
  return invalid.length;
}

function storageKeys() {
  try {
    return uni.getStorageInfoSync()?.keys || [];
  } catch (error) {
    return [];
  }
}

function parseLegacy(raw) {
  try {
    const items = JSON.parse(raw || '[]');
    return Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : [];
  } catch (error) {
    return [];
  }
}

function legacyKeys() {
  return new Set([
    LEGACY_UNSCOPED_KEY,
    ...storageKeys().filter((storageKey) => storageKey.startsWith(LEGACY_PREFIX)),
  ]);
}

/**
 * Return old Can drafts without importing them. The caller can explain these
 * records to the user when their fields cannot be mapped to Recording V2.
 */
export function listLegacyRecordingDrafts() {
  return [...legacyKeys()].flatMap((legacyKey) => (
    parseLegacy(uni.getStorageSync(legacyKey)).map((draft) => ({
      ...draft,
      legacyKey,
      legacyOwner: legacyKey.startsWith(LEGACY_PREFIX)
        ? legacyKey.slice(LEGACY_PREFIX.length)
        : null,
    }))
  ));
}

function canMigrateLegacyDraft(draft) {
  return Boolean(
    draft.form
    && typeof draft.form === 'object'
    && draft.form.original_gloss
    && draft.form.usage_dialect_id,
  );
}

/** Migrate only records whose field names already match the V2 recording schema. */
export async function migrateLegacyRecordingDrafts(owner = draftOwner()) {
  const legacyKey = `${LEGACY_PREFIX}${owner}`;
  const records = parseLegacy(uni.getStorageSync(legacyKey));
  if (!records.length) return 0;
  const remaining = [];
  let migrated = 0;
  const outcomes = [];
  await records.reduce((chain, draft) => chain.then(async () => {
    if (!canMigrateLegacyDraft(draft)) {
      outcomes.push({ draft, migrated: false });
      return;
    }
    try {
      await saveRecordingDraft({
        id: draft.id,
        form: draft.form,
        audio: draft.audio,
        entryId: draft.entryId,
        recordingType: draft.recordingType,
      }, owner);
      outcomes.push({ draft, migrated: true });
    } catch (error) {
      outcomes.push({ draft, migrated: false });
    }
  }), Promise.resolve());
  outcomes.forEach((outcome) => {
    if (outcome.migrated) migrated += 1;
    else remaining.push(outcome.draft);
  });
  if (remaining.length) uni.setStorageSync(legacyKey, JSON.stringify(remaining));
  else uni.removeStorageSync(legacyKey);
  return migrated;
}

export function discardLegacyRecordingDrafts({
  owner = draftOwner(), includeUnscoped = false,
} = {}) {
  const keys = [`${LEGACY_PREFIX}${owner}`];
  if (includeUnscoped) keys.push(LEGACY_UNSCOPED_KEY);
  let removed = 0;
  keys.forEach((legacyKey) => {
    const items = parseLegacy(uni.getStorageSync(legacyKey));
    if (items.length) removed += items.length;
    uni.removeStorageSync(legacyKey);
  });
  return removed;
}

export default {
  clearInvalidRecordingDraftAudio,
  deleteRecordingDraft,
  discardLegacyRecordingDrafts,
  draftOwner,
  listLegacyRecordingDrafts,
  listRecordingDrafts,
  listRecordingDraftsWithAudioStatus,
  migrateLegacyRecordingDrafts,
  restoreRecordingDraft,
  saveRecordingDraft,
};
