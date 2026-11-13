import {
  persistDraftAudio, restoreDraftAudio, removeDraftAudio, isDraftAudioAvailable,
} from './recordingDraftAudio';

export const RECORDING_DRAFT_SCHEMA_VERSION = 2;
export const MAX_RECORDING_DRAFTS = 20;
export const RECORDING_DRAFT_LIMIT_ERROR = 'recording-draft-limit';

const STORAGE_PREFIX = 'recording_drafts:v2:';
const GUEST_SESSION_KEY = 'recording_drafts:guest_session:v2';
const LEGACY_PREFIX = 'can_drafts:';
const LEGACY_UNSCOPED_KEY = 'can_drafts';

const key = (owner) => `${STORAGE_PREFIX}${owner}`;

function createGuestSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function endGuestDraftSession() {
  if (typeof uni !== 'undefined' && typeof uni.removeStorageSync === 'function') {
    uni.removeStorageSync(GUEST_SESSION_KEY);
  }
}

function draftLimitError() {
  const error = new Error(`草稿箱已满（最多 ${MAX_RECORDING_DRAFTS} 条），请先到草稿箱删除不需要的草稿`);
  error.code = RECORDING_DRAFT_LIMIT_ERROR;
  error.limit = MAX_RECORDING_DRAFTS;
  return error;
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
  const current = listRecordingDrafts(owner);
  const old = current.find((item) => item.id === draftId);
  if (!old && current.length >= MAX_RECORDING_DRAFTS) throw draftLimitError();
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
    ...(old?.legacySource ? { legacySource: old.legacySource } : {}),
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
  if (!old && existing.length >= MAX_RECORDING_DRAFTS) {
    if (storedAudio?.storage === 'saved-file') {
      const error = draftLimitError();
      error.persistedAudio = storedAudio;
      throw error;
    }
    await removeDraftAudio(storedAudio);
    throw draftLimitError();
  }
  const next = [item, ...existing];
  try {
    uni.setStorageSync(key(owner), JSON.stringify(next));
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
  return item;
}

export async function restoreRecordingDraft(id, owner = draftOwner()) {
  const item = listRecordingDrafts(owner).find((draft) => draft.id === id);
  if (!item) throw new Error('草稿不存在或属于其他账号');
  const audio = await restoreDraftAudio(item.audio);
  return {
    ...item,
    audio,
    audioInvalid: audio ? Boolean(audio.invalid) : Boolean(item.audioInvalid),
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

  // Availability checks yield to other pages/tabs saving or deleting drafts.
  // Apply their results only to the same audio in the latest stored draft list.
  const invalidAudio = new Map(invalid.map((item) => [item.id, item.audio]));
  const cleared = [];
  const updatedAt = Date.now();
  const next = listRecordingDrafts(owner).map((item) => {
    if (!sameAudio(item.audio, invalidAudio.get(item.id))) return item;
    cleared.push(item.audio);
    return {
      ...item,
      audio: null,
      audioError: false,
      audioInvalid: true,
      updatedAt,
    };
  });
  if (!cleared.length) return 0;
  uni.setStorageSync(key(owner), JSON.stringify(next));
  await Promise.all(cleared.map((audio) => removeDraftAudio(audio)));
  return cleared.length;
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

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return isRecord(value) && Object.keys(value).every((field) => keys.includes(field));
}

function emptyLegacyValue(value) {
  return value === undefined || value === null || value === '' || value === 0;
}

// Reject conflicting aliases rather than silently choosing one user's text/region.
function legacyAlias(values, valid, normalize = (value) => value) {
  const present = values.filter((value) => !emptyLegacyValue(value));
  if (!present.length || !present.every(valid)) return null;
  const normalized = present.map(normalize);
  return normalized.every((value) => value === normalized[0]) ? normalized[0] : null;
}

function isPositiveId(value) {
  return ['string', 'number'].includes(typeof value)
    && /^(?:[1-9][0-9]*)$/.test(String(value)) && Number.isSafeInteger(Number(value));
}

function mapLegacyDraft(draft, owner) {
  if (!hasOnlyKeys(draft, [
    'id', 'ownerScope', 'owner', 'mode', 'targetFlavor', 'dialectName', 'form', 'label',
    'audio', 'reason', 'createdAt', 'updatedAt', 'entryId', 'recordingType',
  ]) || typeof draft.id !== 'string' || !draft.id
    || (draft.ownerScope && draft.ownerScope !== owner)
    || (draft.owner && draft.owner !== owner)
    || (draft.mode && draft.mode !== 'free')
    || (draft.targetFlavor && (!hasOnlyKeys(draft.targetFlavor, ['id', 'name'])
      || Object.values(draft.targetFlavor).some((value) => !emptyLegacyValue(value))))) return null;

  const { form } = draft;
  const label = draft.label || {};
  if (!hasOnlyKeys(form, [
    'concept_text', 'submitted_dialect_id', 'dialect', 'audio_url', 'source_note',
    'duration_ms', 'county', 'town', 'original_gloss', 'usage_dialect_id',
    'original_writing', 'original_pronunciation', 'citation', 'rights_statement', 'recording_type',
  ]) || !hasOnlyKeys(label, [
    'text_content', 'definition', 'pronunciation_text', 'package_type',
    'evidence_level', 'source', 'source_citation',
  ])) return null;

  // Flavor links, evidence claims and old location text have no safe V2 equivalent.
  if (['audio_url', 'source_note', 'county', 'town'].some((field) => !emptyLegacyValue(form[field]))
    || !emptyLegacyValue(label.source_citation)
    || (label.package_type && label.package_type !== 'uncertain')
    || (label.evidence_level !== undefined && label.evidence_level !== 1)) return null;
  if (label.source && (!hasOnlyKeys(label.source, ['type', 'title', 'attributed_to', 'locator', 'note'])
    || (label.source.type && label.source.type !== 'creator')
    || ['title', 'attributed_to', 'locator', 'note'].some((field) => !emptyLegacyValue(label.source[field])))) return null;

  const text = (value) => typeof value === 'string';
  const gloss = [form.original_gloss, form.concept_text, label.definition];
  const originalGloss = legacyAlias(gloss, text);
  const usageDialectId = legacyAlias(
    [form.usage_dialect_id, form.submitted_dialect_id, form.dialect],
    isPositiveId,
    Number,
  );
  const writing = [form.original_writing, label.text_content];
  const pronunciation = [form.original_pronunciation, label.pronunciation_text];
  const originalWriting = legacyAlias(writing, text);
  const originalPronunciation = legacyAlias(pronunciation, text);
  if (!originalGloss?.trim() || !usageDialectId
    || (writing.some((value) => !emptyLegacyValue(value)) && originalWriting === null)
    || (pronunciation.some((value) => !emptyLegacyValue(value)) && originalPronunciation === null)
    || ['citation', 'rights_statement'].some((field) => form[field] !== undefined && !text(form[field]))) return null;
  const types = [draft.recordingType, form.recording_type];
  const validType = (value) => ['word', 'phrase', 'example', 'other'].includes(value);
  const recordingType = types.every(emptyLegacyValue) ? 'word' : legacyAlias(types, validType);
  // Only explicitly V2-shaped records can already carry a V2 Entry reference.
  const hasEntry = !emptyLegacyValue(draft.entryId);
  if (!recordingType || (hasEntry && (!form.original_gloss
    || !isPositiveId(form.usage_dialect_id) || !isPositiveId(draft.entryId)))) return null;

  // Old IndexedDB uses guantou-can-drafts, NOT V2's database. Do not move temporary
  // files or drop an unreadable reference. Native saved files can be reused as-is.
  const { audio } = draft;
  if (audio && (!hasOnlyKeys(audio, [
    'path', 'name', 'durationMs', 'origin', 'mediaId', 'storage', 'persisted', 'available', 'invalid',
  ]) || audio.storage !== 'saved-file' || audio.persisted !== true
    || typeof audio.path !== 'string' || !audio.path)) return null;
  if (!emptyLegacyValue(form.duration_ms) && form.duration_ms !== audio?.durationMs) return null;

  return {
    id: draft.id,
    // Retain labels/provenance verbatim for later inspection; references only, no audio bytes.
    legacySource: { key: `${LEGACY_PREFIX}${owner}`, record: draft },
    owner,
    schemaVersion: RECORDING_DRAFT_SCHEMA_VERSION,
    formatVersion: RECORDING_DRAFT_SCHEMA_VERSION,
    form: {
      original_gloss: originalGloss,
      usage_dialect_id: usageDialectId,
      original_writing: originalWriting || '',
      original_pronunciation: originalPronunciation || '',
      citation: form.citation || '',
      rights_statement: form.rights_statement || '',
      recording_type: recordingType,
    },
    recordingType,
    entryId: hasEntry ? Number(draft.entryId) : null,
    audio: audio ? { ...audio } : null,
    audioError: false,
    audioInvalid: Boolean(audio?.invalid),
    createdAt: draft.createdAt || draft.updatedAt || Date.now(),
    updatedAt: draft.updatedAt || draft.createdAt || Date.now(),
  };
}

/** Recover only unambiguous owned records; leave all other legacy bytes available. */
export async function migrateLegacyRecordingDrafts(owner = draftOwner()) {
  const legacyKey = `${LEGACY_PREFIX}${owner}`;
  let records;
  let current;
  try {
    records = JSON.parse(uni.getStorageSync(legacyKey) || '[]');
    current = JSON.parse(uni.getStorageSync(key(owner)) || '[]');
  } catch (error) { return 0; }
  if (!Array.isArray(records) || !records.length) return 0;
  // Do not overwrite a corrupt/foreign V2 index by treating it as an empty list.
  if (!Array.isArray(current)
    || current.some((item) => !isRecord(item) || item.owner !== owner)) return 0;
  const remaining = [];
  const recovered = [];
  records.forEach((draft) => {
    const item = mapLegacyDraft(draft, owner);
    if (!item || current.length + recovered.length >= MAX_RECORDING_DRAFTS
      || [...current, ...recovered].some((existing) => existing.id === item.id)) {
      remaining.push(draft);
    } else recovered.push(item);
  });
  if (!recovered.length) return 0;
  // Keep existing drafts accessible when automatic recovery cannot write.
  try {
    uni.setStorageSync(key(owner), JSON.stringify([...recovered, ...current]));
  } catch (error) { return 0; }
  try {
    if (remaining.length) uni.setStorageSync(legacyKey, JSON.stringify(remaining));
    else uni.removeStorageSync(legacyKey);
  } catch (error) {
    // Recovery has already been saved. A later attempt skips matching V2 IDs.
    return recovered.length;
  }
  return recovered.length;
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
  endGuestDraftSession,
  listLegacyRecordingDrafts,
  listRecordingDrafts,
  listRecordingDraftsWithAudioStatus,
  migrateLegacyRecordingDrafts,
  restoreRecordingDraft,
  saveRecordingDraft,
};
