import { BASE_URL } from '@/const/urls';
import { toLoginPage } from '@/routers/login';
import {
  hideLoading as hideGlobalLoading,
  notifyError as notifyGlobalError,
  showLoading as showGlobalLoading,
} from '@/services/feedback';

const DEFAULT_OPTIONS = {
  auth: true,
  visitor: true,
  silent: false,
  redirectOnUnauthorized: true,
  loading: true,
  loadingTitle: '加载中',
  timeout: 0,
};

const TOKEN_STORAGE_KEY = 'token';
const VISITOR_STORAGE_KEY = 'visitor_id';

function resolveOptions(options = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

function authHeaders(enabled) {
  if (!enabled) return {};
  const token = uni.getStorageSync(TOKEN_STORAGE_KEY);
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

function visitorHeaders() {
  const visitorId = uni.getStorageSync(VISITOR_STORAGE_KEY);
  if (!visitorId) return {};
  return {
    'X-Visitor-ID': visitorId,
  };
}

function buildHeaders(options) {
  return {
    'content-type': 'application/json',
    ...(options.visitor ? visitorHeaders() : {}),
    ...authHeaders(options.auth),
  };
}

function showLoading(options) {
  if (!options.loading) return;
  showGlobalLoading(options.loadingTitle);
}

function hideLoading(options) {
  if (!options.loading) return;
  hideGlobalLoading();
}

function parseUploadResponseData(data) {
  if (typeof data !== 'string') return data || {};
  if (!data.length) return {};
  try {
    return JSON.parse(data);
  } catch (error) {
    return { data };
  }
}

export function createApiError(error) {
  const statusCode = error && error.statusCode ? error.statusCode : 0;
  // uploadFile returns response.data as a JSON string even for HTTP errors.
  const parsed = parseUploadResponseData(error && error.data);
  const payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  const transportMessage = error?.errMsg && !/:ok$/.test(error.errMsg) ? error.errMsg : '';
  const serverMessage = typeof payload.message === 'string' ? payload.message.trim() : '';
  const message = serverMessage
    || transportMessage
    || error?.message
    || (statusCode >= 500 ? '服务暂不可用，请稍后重试' : '')
    || (statusCode ? `请求失败（HTTP ${statusCode}）` : '网络错误，请检查网络后重试');
  return {
    statusCode,
    code: payload.code || statusCode,
    message,
    data: payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data : {},
    requestId: payload.request_id || '',
    payload,
    raw: error,
  };
}

function notifyError(error, options) {
  if (options.silent) return;
  notifyGlobalError(error);
  if (error.statusCode === 401 && options.redirectOnUnauthorized) {
    setTimeout(() => {
      toLoginPage();
    }, 1000);
  }
}

function responseHeaderValue(headers, key) {
  if (!headers) return '';
  return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()] || '';
}

function persistVisitorId(res) {
  const visitorId = responseHeaderValue(res && res.header, 'X-Visitor-ID');
  if (visitorId) {
    uni.setStorageSync(VISITOR_STORAGE_KEY, visitorId);
  }
}

export async function request(method = 'GET', url = '', data = {}, options = {}) {
  const resolvedOptions = resolveOptions(options);
  const payload = {
    method,
    url: BASE_URL + url,
    data,
    header: buildHeaders(resolvedOptions),
    dataType: 'json',
  };
  const timeout = Number(resolvedOptions.timeout) || 0;
  if (timeout > 0) payload.timeout = timeout;

  let response;
  let requestError;
  showLoading(resolvedOptions);
  try {
    response = await uni.request(payload);
    if (resolvedOptions.visitor) persistVisitorId(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      requestError = createApiError(response);
    } else if (resolvedOptions.expectedStatus
      && response.statusCode !== resolvedOptions.expectedStatus) {
      requestError = { statusCode: 0, message: '返回状态异常，结果未知，请先核查历史记录' };
    }
  } catch (rawError) {
    requestError = createApiError(rawError);
  } finally {
    hideLoading(resolvedOptions);
  }

  if (requestError) {
    notifyError(requestError, resolvedOptions);
    throw requestError;
  }
  return response.data;
}

export async function upload(file, options = {}) {
  const resolvedOptions = resolveOptions({
    loadingTitle: '上传中……',
    ...options,
  });
  let response;
  let requestError;
  showLoading(resolvedOptions);
  try {
    response = await uni.uploadFile({
      url: `${BASE_URL}${options.url || '/files'}`,
      filePath: file,
      name: options.name || 'file',
      header: {
        ...visitorHeaders(),
        ...authHeaders(resolvedOptions.auth),
      },
    });
    persistVisitorId(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      requestError = createApiError(response);
    }
  } catch (rawError) {
    requestError = createApiError(rawError);
  } finally {
    hideLoading(resolvedOptions);
  }

  if (requestError) {
    notifyError(requestError, resolvedOptions);
    throw requestError;
  }
  return parseUploadResponseData(response.data);
}

export default {
  request,
  upload,
  createApiError,
};
