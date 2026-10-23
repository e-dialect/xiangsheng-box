const DEFAULT_ERROR_MESSAGES = {
  0: '网络错误',
  400: '请求参数有误',
  401: '请先登录！',
  403: '没有权限！',
  404: '请求资源不存在',
  500: '服务器内部错误',
};

const MAX_TOAST_TITLE_LENGTH = 32;
let loadingReferences = 0;
let nextLoadingClosureId = 0;
const loadingClosures = new Set();
let pendingNativeNotification = null;
const feedbackHosts = [];
const ownedConfirmations = new WeakMap();

export function cancelConfirmation(owner) {
  ownedConfirmations.get(owner)?.();
  ownedConfirmations.delete(owner);
}

export function registerFeedbackHost(host) {
  if (!host || feedbackHosts.includes(host)) return;
  feedbackHosts.push(host);
  if (pendingNativeNotification && host.showToast(pendingNativeNotification)) {
    pendingNativeNotification = null;
  }
}

export function unregisterFeedbackHost(host) {
  const index = feedbackHosts.indexOf(host);
  if (index >= 0) feedbackHosts.splice(index, 1);
}

function activeFeedbackHost() {
  return feedbackHosts[feedbackHosts.length - 1] || null;
}

function showNativeNotification(options) {
  uni.showToast(options);
}

function flushNativeNotification() {
  if (loadingReferences > 0 || loadingClosures.size > 0 || !pendingNativeNotification) return;
  const notification = pendingNativeNotification;
  pendingNativeNotification = null;
  const host = activeFeedbackHost();
  if (host && host.showToast(notification)) return;
  showNativeNotification(notification);
}

function truncateTitle(title) {
  const normalized = String(title || '').trim();
  if (normalized.length <= MAX_TOAST_TITLE_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_TOAST_TITLE_LENGTH - 1)}…`;
}

export function notify({
  title,
  icon = 'none',
  duration = 2000,
  mask = false,
} = {}) {
  const normalizedTitle = truncateTitle(title);
  if (!normalizedTitle) return;
  const host = activeFeedbackHost();
  if (host && host.showToast({
    title: normalizedTitle,
    icon,
    duration,
    mask,
  })) return;
  const notification = {
    title: normalizedTitle,
    icon,
    duration,
    mask,
  };
  // Uni H5 的 loading 与 toast 共用弹层状态。加载尚未完成或正在关闭时直接
  // showToast 会把 loading 顶掉，随后 hideLoading 会报告未配对；只保留最新一条
  // 原生提示，等最后一次 loading 确认关闭后再显示。
  if (loadingReferences > 0 || loadingClosures.size > 0) {
    pendingNativeNotification = notification;
    return;
  }
  showNativeNotification(notification);
}

export function confirm({
  title = '请确认',
  content = '',
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  owner = null,
} = {}) {
  const host = activeFeedbackHost();
  if (host && typeof host.confirm === 'function') {
    const result = host.confirm({
      title,
      content,
      confirmText,
      cancelText,
      danger,
    });
    if (!owner) return result;
    const resolver = host.dialogResolver;
    const cancel = () => {
      if (host.dialogResolver === resolver) host.resolveDialog(false);
    };
    ownedConfirmations.set(owner, cancel);
    return Promise.resolve(result).finally(() => {
      if (ownedConfirmations.get(owner) === cancel) ownedConfirmations.delete(owner);
    });
  }

  // Sensitive, page-owned confirmations must be cancellable on session change.
  if (owner) return Promise.resolve(false);

  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      confirmText,
      cancelText,
      // uni.showModal 不支持 CSS 变量；仅兼容尚未挂载 FeedbackHost 的旧页面。
      confirmColor: danger ? '#d54941' : undefined,
      success: (result) => resolve(Boolean(result && result.confirm)),
      fail: () => resolve(false),
    });
  });
}

export function message({
  content,
  theme = 'info',
  duration = 3000,
} = {}) {
  const normalizedContent = truncateTitle(content);
  if (!normalizedContent) return;
  const host = activeFeedbackHost();
  if (host && host.showMessage({ content: normalizedContent, theme, duration })) return;
  notify({
    title: normalizedContent,
    icon: theme === 'info' ? 'none' : theme,
    duration,
  });
}

export function notifySuccess(title) {
  notify({ title, icon: 'success' });
}

export function errorMessage(error, fallback = '') {
  const statusCode = error && error.statusCode ? error.statusCode : 0;
  return (error && error.message)
    || DEFAULT_ERROR_MESSAGES[statusCode]
    || fallback
    || `错误代码${statusCode}`;
}

export function notifyError(error, fallback = '') {
  notify({
    title: errorMessage(error, fallback),
    icon: 'error',
  });
}

export function showLoading(title = '加载中') {
  // 只在 0→1 时打开原生 Loading，避免并发请求互相提前关闭。
  if (loadingReferences === 0) {
    uni.showLoading({
      title,
      // 页面与提交按钮自行管理 busy 状态；全局进度提示不应形成可能残留的透明点击层。
      mask: false,
    });
  }
  loadingReferences += 1;
}

export function hideLoading() {
  if (loadingReferences === 0) return;
  loadingReferences -= 1;
  // 只在最后一个请求结束（1→0）时关闭。
  if (loadingReferences !== 0) return;
  nextLoadingClosureId += 1;
  const closureId = nextLoadingClosureId;
  loadingClosures.add(closureId);
  const settleClosure = () => {
    loadingClosures.delete(closureId);
    flushNativeNotification();
  };
  let closing;
  try {
    closing = uni.hideLoading();
  } catch (error) {
    settleClosure();
    throw error;
  }
  Promise.resolve(closing).then(settleClosure, settleClosure);
}

export function resetLoading() {
  loadingReferences = 0;
  loadingClosures.clear();
  pendingNativeNotification = null;
}

export default {
  confirm,
  errorMessage,
  hideLoading,
  message,
  notify,
  notifyError,
  notifySuccess,
  registerFeedbackHost,
  resetLoading,
  showLoading,
  unregisterFeedbackHost,
};
