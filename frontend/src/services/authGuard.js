import { toLoginPage } from '@/routers/login';
import { notify } from '@/services/feedback';

export const PROTECTED_ACTIONS = {
  interact_entry: '参与词条讨论',
  interact_recording: '回应乡音',
  manage_collection: '收纳乡音',
  record_recording: '录制乡音',
  attest_usage: '确认本地使用',
  follow: '关注',
  circle_join: '加入方言圈',
  dm: '私信',
  content_feedback: '反馈内容链接',
  open_mine: '查看我的',
  bookmark_entry: '收藏词条',
};

const STORAGE_KEY = 'auth_intercept_intent';
const INTENT_VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function isProtectedAction(action) {
  return Object.prototype.hasOwnProperty.call(PROTECTED_ACTIONS, action);
}

export function actionLabel(action) {
  return PROTECTED_ACTIONS[action] || action || '';
}

export function isLoggedIn() {
  return Boolean(uni.getStorageSync('token'));
}

export function saveInterceptIntent(intent) {
  const payload = {
    version: INTENT_VERSION,
    action: intent.action,
    context: intent.context || {},
    createdAt: intent.createdAt || Date.now(),
    voluntary: Boolean(intent.voluntary),
  };
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function peekInterceptIntent() {
  const raw = uni.getStorageSync(STORAGE_KEY);
  if (!raw) return null;
  try {
    const intent = JSON.parse(raw);
    if (
      intent.version !== INTENT_VERSION
      || !isProtectedAction(intent.action)
      || !intent.createdAt
      || Date.now() - intent.createdAt > MAX_AGE_MS
      || !intent.context
      || typeof intent.context !== 'object'
      || Array.isArray(intent.context)
    ) {
      uni.removeStorageSync(STORAGE_KEY);
      return null;
    }
    return intent;
  } catch (error) {
    uni.removeStorageSync(STORAGE_KEY);
    return null;
  }
}

export function clearInterceptIntent() {
  uni.removeStorageSync(STORAGE_KEY);
}

export function requireAuth(action, context = {}) {
  if (!isProtectedAction(action)) return true;
  if (isLoggedIn()) return true;
  saveInterceptIntent({ action, context });
  notify({ title: '请先登录' });
  toLoginPage();
  return false;
}

export default {
  PROTECTED_ACTIONS,
  actionLabel,
  clearInterceptIntent,
  isLoggedIn,
  isProtectedAction,
  peekInterceptIntent,
  requireAuth,
  saveInterceptIntent,
};
