import { appRoutePath, ROUTES } from '@/services/navigation';
import { productEventPayload, PRODUCT_EVENTS } from '@/services/productAnalytics';
import { BASE_URL } from '@/const/urls';

const SHARE_MARKER = 'share_kind';
const QUIZ_ROUTE = '/pages/tools/local';
const SHARE_ROUTES = Object.freeze({
  [ROUTES.collectionDetail]: 'collection',
  [ROUTES.entryDetail]: 'entry',
  [ROUTES.recordingDetail]: 'recording',
  [ROUTES.search]: 'search',
  [QUIZ_ROUTE]: 'quiz',
});

let openedShare = false;

// The destination is used for a local equality check. Its identifying fields
// stay in the actual link and never enter the analytics request.
function classify(url, base) {
  const route = appRoutePath(url.pathname, base);
  const kind = SHARE_ROUTES[route];
  const params = url.searchParams;
  if (kind === 'search') {
    const key = params.get('keywords') || params.get('key');
    return key?.trim() ? { kind, target: [key] } : null;
  }
  if (kind === 'quiz') {
    const dialect = params.get('dialect');
    const version = params.get('quiz');
    return params.get('tool') === 'quiz' && dialect && version
      ? { kind, target: [dialect, version] } : null;
  }
  const id = params.get('id');
  return kind && id && /^[1-9][0-9]*$/.test(id) ? { kind, target: [id] } : null;
}

function sameTarget(left, right) {
  return left && right && left.kind === right.kind
    && left.target.length === right.target.length
    && left.target.every((value, index) => value === right.target[index]);
}

export function markWebShareUrl(value, base) {
  const url = new URL(value);
  const share = classify(url, base);
  if (!share) return { url: value, kind: '' };
  url.searchParams.set(SHARE_MARKER, share.kind);
  return { url: url.href, kind: share.kind };
}

export function trackShareObservation(eventName, kind, result) {
  if (!Object.values(SHARE_ROUTES).includes(kind) || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  try {
    const payload = productEventPayload(eventName, { surface: kind, result });
    if (!payload || payload.platform !== 'h5') return;
    window.fetch(`${BASE_URL}/product-events/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'strict-origin',
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // Telemetry must never prevent sharing or loading public content.
  }
}

export function observeSharedOpen(path) {
  if (openedShare || !path || typeof window === 'undefined') return;
  const initial = window.performance?.getEntriesByType?.('navigation')?.[0]?.name;
  if (!initial) return;
  const base = import.meta.env.BASE_URL;
  const launchUrl = new URL(initial);
  const liveUrl = new URL(window.location.href);
  const destination = new URL(path, window.location.origin);
  const landing = classify(launchUrl, base);
  if (!landing || launchUrl.origin !== liveUrl.origin
    || launchUrl.searchParams.get(SHARE_MARKER) !== landing.kind
    || !sameTarget(landing, classify(liveUrl, base))
    || !sameTarget(landing, classify(destination, '/'))) return;
  openedShare = true;
  trackShareObservation(PRODUCT_EVENTS.SHARE_OPENED, landing.kind, 'success');
}
