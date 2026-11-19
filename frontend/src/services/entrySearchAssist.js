import request from '@/utils/request';
import { draftOwner } from './recordingDrafts';

const storageKey = () => `entry_search_history:v2:${draftOwner()}`;
export const suggestEntries = (q) => request.get('/entries/suggestions/', {
  q,
}, true, {
  loading: false,
});
export const popularEntries = () => request.get('/entries/popular/', {}, true, {
  loading: false,
});
export function getDailyEntry(dialectId, dialectScope) {
  const params = dialectId ? { dialect_id: dialectId, dialect_scope: dialectScope } : {};
  return request.get('/entries/daily/', params, true, {
    auth: false,
    visitor: false,
    loading: false,
  });
}
export function searchHistory() {
  try {
    const items = JSON.parse(uni.getStorageSync(storageKey()) || '[]');
    return Array.isArray(items) ? items.filter((term) => typeof term === 'string').slice(0, 10) : [];
  } catch (error) {
    return [];
  }
}
export function rememberSearch(term) {
  const text = String(term || '').trim().slice(0, 120);
  if (!text) return;
  try {
    const items = [text, ...searchHistory().filter((item) => item !== text)].slice(0, 10);
    uni.setStorageSync(storageKey(), JSON.stringify(items));
  } catch (error) { /* Search remains usable when local storage is full. */ }
}
export function clearSearchHistory() {
  uni.removeStorageSync(storageKey());
}
