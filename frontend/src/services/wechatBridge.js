/* eslint-env browser */
/* global plus */
import rawRequest from '@/utils/rawRequest';
import { isH5Runtime } from '@/services/platform';

const BRIDGE = '/login/wechat/bridge';
const STORAGE_KEY = 'wechat_login_request';
const options = {
  auth: false, visitor: false, loading: false, timeout: 18000,
};

export function bridgeChannel() {
  if (!isH5Runtime()) return 'app';
  const { userAgent, maxTouchPoints } = window.navigator;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  return mobile ? 'web' : 'web_qr';
}

export function readBridgeAttempt() {
  if (!isH5Runtime()) return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeBridgeAttempt(attempt) {
  if (!isH5Runtime()) return;
  if (attempt) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  } else {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function openBridgeLink(url, onError) {
  if (isH5Runtime()) {
    window.location.assign(url);
    return;
  }
  // #ifdef APP-PLUS
  if (typeof plus !== 'undefined' && plus.runtime?.openURL) {
    plus.runtime.openURL(url, onError);
    return;
  }
  // #endif
  onError();
}

export function getBridgeAvailability() {
  return rawRequest.get(`${BRIDGE}/availability`, {}, options);
}

export function startBridge(channel) {
  return rawRequest.post(`${BRIDGE}/start`, { channel }, options);
}

function exchangeParams(attempt) {
  return { request_id: attempt.request_id, exchange_key: attempt.exchange_key };
}

export function exchangeBridge(attempt) {
  return rawRequest.post(`${BRIDGE}/exchange`, exchangeParams(attempt), options);
}

export function cancelBridge(attempt) {
  return rawRequest.post(`${BRIDGE}/cancel`, exchangeParams(attempt), options);
}

export function bridgeDetails(requestId) {
  return rawRequest.get(`${BRIDGE}/details`, { request_id: requestId }, options);
}

export function getBridgeRequestId(query = {}) {
  const id = query.request_id || query.scene || '';
  return typeof id === 'string' && /^[0-9a-f]{32}$/.test(id) ? id : '';
}

export async function confirmBridge(requestId) {
  const result = await uni.login();
  if (!result?.code) throw new Error('无法取得微信登录凭证，请重试');
  return rawRequest.post(`${BRIDGE}/confirm`, { request_id: requestId, jscode: result.code }, options);
}
