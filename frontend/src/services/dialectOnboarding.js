import { listRecordings, pageResults } from '@/services/entryRecording';
import {
  goOnboarding,
  pageUrl,
  ROUTES,
} from '@/services/navigation';
import request from '@/utils/request';

export const ONBOARDING_REASONS = {
  MISSING_DIALECT: 'missing_dialect',
  NEW_USER: 'new_user',
};

export function needsDialectOnboarding(user) {
  return Boolean(user && !user.primary_dialect);
}

export function normalizeOnboardingReason(reason) {
  return reason === ONBOARDING_REASONS.NEW_USER
    ? ONBOARDING_REASONS.NEW_USER
    : ONBOARDING_REASONS.MISSING_DIALECT;
}

export function dialectOnboardingUrl(reason) {
  const normalized = normalizeOnboardingReason(reason);
  return pageUrl(ROUTES.onboarding, { reason: normalized });
}

export function toDialectOnboarding(reason, closeAll = true) {
  goOnboarding(
    { reason: normalizeOnboardingReason(reason) },
    { reset: closeAll, replace: !closeAll },
  );
}

export function ensureDialectOnboarding(user, reason) {
  if (!needsDialectOnboarding(user)) return false;
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  const currentRoute = pages.length ? pages[pages.length - 1].route : '';
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const onboardingRoute = ROUTES.onboarding.slice(1);
  const alreadyOnboarding = String(currentRoute).replace(/^\//, '') === onboardingRoute
    || String(currentPath).replace(/^\//, '') === onboardingRoute;
  if (alreadyOnboarding) return true;
  toDialectOnboarding(reason, true);
  return true;
}

export async function loadDialectSample(dialectId) {
  if (!dialectId) return null;
  const response = await listRecordings({
    dialect_id: dialectId,
    dialect_scope: 'subtree',
    page: 1,
    page_size: 1,
  });
  return pageResults(response)[0] || null;
}

export async function saveDialectProfile(userId, { nickname, primaryDialectId }) {
  const token = uni.getStorageSync('token');
  const sameSession = () => Boolean(token)
    && uni.getStorageSync('token') === token
    && String(uni.getStorageSync('id')) === String(userId);
  if (!sameSession()) return null;

  let response;
  try {
    // The page owns failure feedback so a late response cannot redirect a new session.
    response = await request.put(`/users/${userId}`, {
      user: {
        nickname: String(nickname || '').trim(),
        primary_dialect_id: primaryDialectId,
      },
    }, true);
  } catch (error) {
    if (!sameSession()) return null;
    throw error;
  }
  // Logout, account replacement and a fresh login invalidate the initiating session.
  if (!sameSession()) return null;
  if (response.token) uni.setStorageSync('token', response.token);
  const app = getApp();
  app.globalData.userInfo = response.user;
  app.globalData.id = response.user.id;
  return response.user;
}

export default {
  ONBOARDING_REASONS,
  dialectOnboardingUrl,
  ensureDialectOnboarding,
  loadDialectSample,
  needsDialectOnboarding,
  normalizeOnboardingReason,
  saveDialectProfile,
  toDialectOnboarding,
};
