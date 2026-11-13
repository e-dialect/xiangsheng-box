import { toLoginPage } from '@/routers/login';
import {
  clearInterceptIntent,
  saveInterceptIntent,
} from '@/services/authGuard';
import {
  goBack,
  openPage,
  routeDestination,
  ROUTES,
} from '@/services/navigation';

export const AUTH_DESTINATION_KINDS = {
  DEFAULT: 'default',
  FALLBACK: 'fallback',
  URL: 'url',
};

const GUEST_RETURN_ROUTES = new Set([
  ROUTES.home,
  ROUTES.search,
  ROUTES.entryDetail,
  ROUTES.recordingDetail,
  ROUTES.collectionDetail,
  ROUTES.circleList,
  ROUTES.circleDetail,
  ROUTES.userDetail,
  ROUTES.mine,
]);

export function resolveAuthDestination(intent) {
  if (!intent) return { kind: AUTH_DESTINATION_KINDS.DEFAULT };

  const context = intent.context || {};
  if (intent.voluntary || intent.action === 'open_mine') {
    return routeDestination(ROUTES.mine);
  }

  if (intent.action === 'interact_entry' && context.entryId) {
    return routeDestination(ROUTES.entryDetail, { id: context.entryId });
  }
  if (intent.action === 'interact_recording' && context.recordingId) {
    return routeDestination(ROUTES.recordingDetail, { id: context.recordingId });
  }
  if (intent.action === 'manage_collection') {
    if (context.recordingId) {
      return routeDestination(ROUTES.recordingDetail, { id: context.recordingId });
    }
    if (context.entryId) return routeDestination(ROUTES.entryDetail, { id: context.entryId });
    return routeDestination(ROUTES.collections, { mine: true });
  }
  if (intent.action === 'record_recording') {
    return routeDestination(ROUTES.record, {
      entry_id: context.entryId || undefined,
    });
  }

  if (intent.action === 'attest_usage' && context.entryId) {
    return routeDestination(ROUTES.entryDetail, { id: context.entryId });
  }

  if (intent.action === 'dm') {
    if (!context.userId) return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
    return routeDestination(ROUTES.mailSend, { id: context.userId });
  }

  if (intent.action === 'follow') {
    if (!context.userId) return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
    return routeDestination(ROUTES.userDetail, { id: context.userId });
  }

  if (intent.action === 'circle_join' && context.circleId) {
    return routeDestination(ROUTES.circleDetail, { id: context.circleId });
  }

  return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
}

export function openLoginFromMine() {
  saveInterceptIntent({
    action: 'open_mine',
    context: { page: 'mine' },
    voluntary: true,
  });
  toLoginPage();
}

export function canReturnToGuestPage() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  const previousPage = pages[pages.length - 2];
  const route = String(previousPage?.route || '').replace(/^\//, '');
  return GUEST_RETURN_ROUTES.has(`/${route}`);
}

export function cancelLogin() {
  clearInterceptIntent();
  if (canReturnToGuestPage()) {
    goBack(ROUTES.search);
    return;
  }
  openPage(ROUTES.search, {}, { reset: true });
}

export default {
  AUTH_DESTINATION_KINDS,
  cancelLogin,
  canReturnToGuestPage,
  openLoginFromMine,
  resolveAuthDestination,
};
