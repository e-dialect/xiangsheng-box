import { contentFeedbackParams } from '@/services/contentFeedback';
import { toLoginPage } from '@/routers/login';
import {
  clearInterceptIntent,
  peekInterceptIntent,
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
  ROUTES.localTools,
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

  if (['interact_entry', 'bookmark_entry'].includes(intent.action) && context.entryId) {
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

  if (intent.action === 'content_feedback') {
    const params = contentFeedbackParams(context.object_type, context.object_id);
    if (params) return routeDestination(ROUTES.mailSend, params);
    return { kind: AUTH_DESTINATION_KINDS.FALLBACK };
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

function validGuestObjectId(id) {
  if (typeof id === 'number') return Number.isSafeInteger(id) && id > 0;
  return typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id);
}

export function guestReturnDestination(intent) {
  const context = intent?.context;
  if (intent?.action === 'content_feedback') {
    const params = contentFeedbackParams(context?.object_type, context?.object_id);
    if (!params?.object_id) return null;
    if (params.object_type === 'kinship') {
      return routeDestination(ROUTES.localTools, { tool: 'kinship', dialect: params.object_id });
    }
    const routes = {
      entry: ROUTES.entryDetail,
      recording: ROUTES.recordingDetail,
      collection: ROUTES.collectionDetail,
    };
    return routeDestination(routes[params.object_type], { id: params.object_id });
  }
  if (intent?.action === 'record_recording') {
    return validGuestObjectId(context?.entryId)
      ? routeDestination(ROUTES.entryDetail, { id: context.entryId }) : null;
  }
  const destination = resolveAuthDestination(intent);
  const route = `/${destination.route}`;
  const objectIds = {
    [ROUTES.entryDetail]: context?.entryId,
    [ROUTES.recordingDetail]: context?.recordingId,
    [ROUTES.userDetail]: context?.userId,
    [ROUTES.circleDetail]: context?.circleId,
  };
  if (Object.prototype.hasOwnProperty.call(objectIds, route)
    && !validGuestObjectId(objectIds[route])) return null;
  return GUEST_RETURN_ROUTES.has(route) ? destination : null;
}

export function cancelLogin(intent = peekInterceptIntent()) {
  const destination = guestReturnDestination(intent);
  clearInterceptIntent();
  if (canReturnToGuestPage()) {
    goBack(ROUTES.search);
    return;
  }
  openPage(destination?.url || ROUTES.search, {}, { reset: true });
}

export default {
  AUTH_DESTINATION_KINDS,
  cancelLogin,
  canReturnToGuestPage,
  openLoginFromMine,
  resolveAuthDestination,
};
