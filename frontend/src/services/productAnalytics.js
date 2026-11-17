import { isWechatMiniProgram } from '@/services/platform';
import { request } from '@/utils/httpClient';

export const PRODUCT_EVENTS = Object.freeze({
  LISTEN_FEED_VIEW: 'listen_feed_view',
  ENTRY_SEARCH: 'entry_search',
  RECORDING_SUBMIT: 'recording_submit',
  EVIDENCE_SUBMIT: 'evidence_submit',
  CURATION_TASK_COMPLETE: 'curation_task_complete',
  SHARE_CLIPBOARD: 'share_clipboard',
  SHARE_SYSTEM: 'share_system',
  SHARE_OPENED: 'share_opened',
  CAPABILITY_DEGRADED: 'capability_degraded',
});

const EVENT_NAMES = new Set(Object.values(PRODUCT_EVENTS));
const RESULTS = new Set(['view', 'success', 'empty', 'error', 'unavailable', 'cancelled', 'attempt']);
const SURFACES = new Set(['listen', 'search', 'record', 'entry_detail', 'curation', 'collection', 'entry', 'recording', 'quiz']);
const METADATA_KEYS = new Set([
  'tab',
  'result_bucket',
  'filter_count',
  'has_linked_entry',
  'dialect_depth',
  'task_kind',
  'capability',
  'reason',
]);

function createSessionId() {
  const random = Math.random().toString(36).slice(2);
  return `session-${Date.now().toString(36)}-${random.padEnd(8, '0')}`;
}

let sessionId = createSessionId();

export function productPlatform() {
  if (isWechatMiniProgram()) return 'mp-weixin';
  const platform = typeof uni === 'undefined'
    ? ''
    : uni.getSystemInfoSync?.().uniPlatform;
  if (platform === 'app' || platform === 'app-plus') return 'app';
  return platform === 'web' ? 'h5' : 'unknown';
}

function safeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => METADATA_KEYS.has(key)),
  );
}

export function productEventPayload(eventName, {
  surface = '',
  result = '',
  metadata = {},
} = {}) {
  if (!EVENT_NAMES.has(eventName)) return null;
  const normalizedSurface = String(surface || '').trim();
  if (normalizedSurface && !SURFACES.has(normalizedSurface)) return null;
  if (result && !RESULTS.has(result)) return null;
  return {
    session_id: sessionId,
    event_name: eventName,
    platform: productPlatform(),
    surface: normalizedSurface,
    result,
    metadata: safeMetadata(metadata),
  };
}

export function trackProductEvent(eventName, context = {}) {
  const payload = productEventPayload(eventName, context);
  if (!payload) return Promise.resolve(false);
  try {
    return Promise.resolve(request('POST', '/product-events/', payload, {
      auth: false,
      visitor: false,
      silent: true,
      redirectOnUnauthorized: false,
      loading: false,
      timeout: 2500,
    }))
      .then(() => true)
      .catch(() => false);
  } catch (error) {
    return Promise.resolve(false);
  }
}

export function resetProductAnalyticsSessionForTests(value = '') {
  sessionId = value || createSessionId();
}

export default {
  PRODUCT_EVENTS,
  productEventPayload,
  productPlatform,
  resetProductAnalyticsSessionForTests,
  trackProductEvent,
};
