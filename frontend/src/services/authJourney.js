import { toLoginPage } from '@/routers/login';
import {
  clearInterceptIntent,
  saveInterceptIntent,
} from '@/services/authGuard';
import {
  openPage,
  routeDestination,
  ROUTES,
} from '@/services/navigation';

export const AUTH_DESTINATION_KINDS = {
  DEFAULT: 'default',
  FALLBACK: 'fallback',
  URL: 'url',
};

export function resolveAuthDestination(intent) {
  if (!intent) return { kind: AUTH_DESTINATION_KINDS.DEFAULT };

  const context = intent.context || {};
  if (intent.voluntary || intent.action === 'open_mine') {
    return routeDestination(ROUTES.mine);
  }

  if (intent.action === 'interact_entry' && context.entryId) {
    return routeDestination(ROUTES.entryDetail, {
      id: context.entryId,
      comment: context.commentId,
      root: context.rootId,
    });
  }
  if (intent.action === 'interact_recording' && context.recordingId) {
    return routeDestination(ROUTES.recordingDetail, {
      id: context.recordingId,
      comment: context.commentId,
      root: context.rootId,
    });
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

export function cancelLoginToSearch() {
  clearInterceptIntent();
  openPage(ROUTES.search, {}, { reset: true });
}

export default {
  AUTH_DESTINATION_KINDS,
  cancelLoginToSearch,
  openLoginFromMine,
  resolveAuthDestination,
};
