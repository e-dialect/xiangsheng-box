import request from '@/utils/request';
import { dialectCardLabel } from '@/utils/dialectTree';

const PAGE_LOAD_OPTIONS = Object.freeze({ loading: false });

export function pageResults(response) {
  if (Array.isArray(response)) return response;
  return response?.results || [];
}

export function listEntries(params = {}) {
  return request.get('/entries/', params, true, PAGE_LOAD_OPTIONS);
}

export function getEntry(id) {
  return request.get(`/entries/${id}/`, {}, true, PAGE_LOAD_OPTIONS);
}

export function listEntryBookmarks(params = {}) {
  return request.get('/entries/bookmarks/', params, true, PAGE_LOAD_OPTIONS);
}

export function listPublicCreatorEntries(creatorId, page) {
  return request.get('/entries/public-contributions/', {
    creator_id: creatorId, page,
  }, true, PAGE_LOAD_OPTIONS);
}

export function bookmarkEntry(id) {
  return request.put(`/entries/${id}/bookmark/`, {});
}

export function unbookmarkEntry(id) {
  return request.del(`/entries/${id}/bookmark/`);
}

export function listRecordings(params = {}) {
  return request.get('/recordings/', params, true, PAGE_LOAD_OPTIONS);
}

export function getRecording(id) {
  return request.get(`/recordings/${id}/`, {}, true, PAGE_LOAD_OPTIONS);
}

export function createRecording(payload) {
  return request.post('/recordings/', payload);
}

export function createUsageAttestation(entryId, dialectId, note = '') {
  return request.post('/usage-attestations/', {
    entry_id: Number(entryId),
    dialect_id: Number(dialectId),
    note: String(note || '').trim(),
  });
}

export function getCurationSummary() {
  return request.get('/curation/', {}, true, PAGE_LOAD_OPTIONS);
}

export function listCuratorApplications(params = {}) {
  return request.get('/curator-applications/', params, true, PAGE_LOAD_OPTIONS);
}

export function createCuratorApplication(payload) {
  return request.post('/curator-applications/', payload);
}

export function withdrawCuratorApplication(id) {
  return request.del(`/curator-applications/${id}/`);
}

export function listCuratorGrants(params = {}) {
  return request.get('/curator-grants/', params, true, PAGE_LOAD_OPTIONS);
}

export function listCurationTasks(params = {}) {
  return request.get('/curation/tasks/', params, true, PAGE_LOAD_OPTIONS);
}

export function createCurationAction(payload) {
  return request.post('/curation/actions/', payload);
}

export function getMyContributionHistory() {
  return request.get('/contributions/me/', {}, true, PAGE_LOAD_OPTIONS);
}

export function primaryEntryLink(recording = {}) {
  const links = (recording.entry_links || []).filter((link) => (
    link.is_current !== false && link.status !== 'rejected'
  ));
  return links.find((link) => link.role === 'primary') || links[0] || null;
}

export function entryTitle(entry = {}) {
  return String(entry.display_writing || entry.summary || '待整理词条').trim();
}

export function dialectLabel(dialect = {}) {
  return dialectCardLabel(dialect);
}

export function buildEntrySearchParams(filters = {}) {
  const params = {};
  const values = {
    search: filters.keyword,
    dialect_id: filters.dialectId,
    dialect_scope: filters.dialectMatch,
    writing_type: filters.writingType,
    source_type: filters.sourceType,
    status: filters.status,
    ipa: filters.ipa,
    romanization: filters.romanization,
    source: filters.source,
    concept: filters.concept,
    has_recording: filters.hasRecording,
    ordering: filters.ordering,
    page: filters.page,
    page_size: filters.pageSize,
  };
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params[key] = value;
  });
  return params;
}

export default {
  buildEntrySearchParams,
  bookmarkEntry,
  createCurationAction,
  createCuratorApplication,
  createRecording,
  createUsageAttestation,
  dialectLabel,
  entryTitle,
  getCurationSummary,
  getEntry,
  getMyContributionHistory,
  getRecording,
  listCurationTasks,
  listCuratorApplications,
  listCuratorGrants,
  listEntries,
  listEntryBookmarks,
  listRecordings,
  pageResults,
  primaryEntryLink,
  unbookmarkEntry,
  withdrawCuratorApplication,
};
