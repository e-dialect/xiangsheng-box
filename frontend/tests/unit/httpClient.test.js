import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

vi.mock('@/routers/login', () => ({
  toLoginPage: vi.fn(),
}));

const { toLoginPage } = await import('@/routers/login');
const feedback = await import('@/services/feedback');
const httpClient = await import('@/utils/httpClient');
const request = (await import('@/utils/request')).default;
const rawRequest = (await import('@/utils/rawRequest')).default;

function installUniMock() {
  const storage = {
    token: 'stored-token',
    visitor_id: 'stored-visitor',
  };
  global.uni = {
    getStorageSync: vi.fn((key) => storage[key] || ''),
    setStorageSync: vi.fn((key, value) => {
      storage[key] = value;
    }),
    request: vi.fn(),
    uploadFile: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    showToast: vi.fn(),
  };
}

describe('httpClient compatibility wrappers', () => {
  beforeEach(() => {
    feedback.resetLoading();
    installUniMock();
    vi.useRealTimers();
  });

  it('request wrapper sends Bearer token and resolves JSON data', async () => {
    uni.request.mockResolvedValue({
      statusCode: 200,
      data: { ok: true },
    });

    await expect(request.get('/recordings/', { page: 1 })).resolves.toEqual({ ok: true });

    expect(uni.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      url: 'http://localhost:8000/recordings/',
      data: { page: 1 },
      header: expect.objectContaining({
        'content-type': 'application/json',
        Authorization: 'Bearer stored-token',
        'X-Visitor-ID': 'stored-visitor',
      }),
    }));
    expect(uni.showLoading).toHaveBeenCalledWith({ title: '加载中', mask: false });
    expect(uni.hideLoading).toHaveBeenCalled();
  });

  it('request wrapper can opt out of auth headers', async () => {
    uni.request.mockResolvedValue({
      statusCode: 200,
      data: { ok: true },
    });

    await expect(httpClient.request('GET', '/public', {}, {
      auth: false,
      loading: false,
    })).resolves.toEqual({ ok: true });

    expect(uni.request).toHaveBeenCalledWith(expect.objectContaining({
      header: {
        'content-type': 'application/json',
        'X-Visitor-ID': 'stored-visitor',
      },
    }));
    expect(uni.showLoading).not.toHaveBeenCalled();
  });

  it('legacy request wrapper forwards local page loading options', async () => {
    uni.request.mockResolvedValue({
      statusCode: 200,
      data: { results: [] },
    });

    await expect(request.get('/recordings/', { page: 1 }, true, {
      loading: false,
    })).resolves.toEqual({ results: [] });

    expect(uni.showLoading).not.toHaveBeenCalled();
    expect(uni.hideLoading).not.toHaveBeenCalled();
  });

  it('pairs concurrent success, HTTP failure and network rejection at the last settle', async () => {
    const pending = [];
    uni.hideLoading.mockResolvedValue();
    uni.request.mockImplementation(() => new Promise((resolve, reject) => {
      pending.push({ resolve, reject });
    }));

    const success = httpClient.request('GET', '/success');
    const httpFailure = httpClient.request('GET', '/http-failure');
    const networkFailure = httpClient.request('GET', '/network-failure');
    const silent = httpClient.request('GET', '/silent', {}, { loading: false, silent: true });

    expect(uni.showLoading).toHaveBeenCalledTimes(1);
    pending[1].resolve({ statusCode: 503, data: { message: '服务繁忙' } });
    pending[2].reject({ errMsg: '网络断开' });
    pending[3].resolve({ statusCode: 200, data: { quiet: true } });
    await silent;
    await Promise.resolve();
    expect(uni.hideLoading).not.toHaveBeenCalled();

    pending[0].resolve({ statusCode: 200, data: { ok: true } });
    const results = await Promise.allSettled([success, httpFailure, networkFailure]);
    await Promise.resolve();

    expect(results).toMatchObject([
      { status: 'fulfilled', value: { ok: true } },
      { status: 'rejected', reason: { statusCode: 503, message: '服务繁忙' } },
      { status: 'rejected', reason: { statusCode: 0, message: '网络断开' } },
    ]);
    expect(uni.hideLoading).toHaveBeenCalledTimes(1);
    expect(uni.showToast).toHaveBeenCalledTimes(1);

    uni.request.mockResolvedValueOnce({ statusCode: 200, data: { recovered: true } });
    await expect(httpClient.request('GET', '/after')).resolves.toEqual({ recovered: true });
    expect(uni.showLoading).toHaveBeenCalledTimes(2);
    expect(uni.hideLoading).toHaveBeenCalledTimes(2);
  });

  it('releases loading when uni.request throws synchronously', async () => {
    uni.request.mockImplementation(() => {
      throw new Error('request unavailable');
    });

    await expect(httpClient.request('GET', '/sync-failure')).rejects.toMatchObject({
      message: 'request unavailable',
    });
    expect(uni.showLoading).toHaveBeenCalledTimes(1);
    expect(uni.hideLoading).toHaveBeenCalledTimes(1);
  });

  it('privacy-sensitive requests can omit and avoid persisting visitor ids', async () => {
    uni.request.mockResolvedValue({
      statusCode: 202,
      data: { accepted: 1 },
      header: { 'X-Visitor-ID': 'response-visitor' },
    });

    await expect(httpClient.request('POST', '/product-events/', {}, {
      auth: false,
      visitor: false,
      silent: true,
      loading: false,
    })).resolves.toEqual({ accepted: 1 });

    expect(uni.request).toHaveBeenCalledWith(expect.objectContaining({
      header: { 'content-type': 'application/json' },
    }));
    expect(uni.setStorageSync).not.toHaveBeenCalled();
  });

  it('forwards a request timeout to uni.request', async () => {
    uni.request.mockResolvedValue({
      statusCode: 200,
      data: { ok: true },
    });
    await expect(httpClient.request('GET', '/users/theme/config/', {}, {
      auth: true,
      silent: true,
      loading: false,
      timeout: 15000,
    })).resolves.toEqual({ ok: true });
    expect(uni.request).toHaveBeenCalledWith(expect.objectContaining({
      timeout: 15000,
    }));
  });

  it('request wrapper redirects on visible 401 errors', async () => {
    vi.useFakeTimers();
    uni.request.mockResolvedValue({
      statusCode: 401,
      data: {
        code: 401,
        message: '未登录',
        data: { reason: 'token_expired' },
        request_id: 'request-1',
      },
    });

    await expect(request.get('/users/1')).rejects.toMatchObject({
      statusCode: 401,
      code: 401,
      message: '未登录',
      data: { reason: 'token_expired' },
      requestId: 'request-1',
    });

    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '未登录',
      icon: 'error',
    }));
    expect(toLoginPage).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(toLoginPage).toHaveBeenCalledTimes(1);
  });

  it('request noPrompt remains silent and does not redirect', async () => {
    vi.useFakeTimers();
    uni.request.mockResolvedValue({
      statusCode: 401,
      data: { message: '未登录' },
    });

    await expect(request.get('/users/1', null, true)).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(uni.showToast).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(toLoginPage).not.toHaveBeenCalled();
  });

  it('rawRequest remains silent and does not redirect on 401', async () => {
    uni.request.mockResolvedValue({
      statusCode: 401,
      data: { message: '用户名或密码错误' },
    });

    await expect(rawRequest.post('/login', { username: 'a' })).rejects.toMatchObject({
      statusCode: 401,
      message: '用户名或密码错误',
    });

    expect(uni.showToast).not.toHaveBeenCalled();
    expect(toLoginPage).not.toHaveBeenCalled();
  });

  it('rawRequest supports explicit anonymous public requests', async () => {
    uni.request.mockResolvedValue({
      statusCode: 200,
      data: { token: 'new-token' },
      header: { 'X-Visitor-ID': 'response-visitor' },
    });

    await expect(rawRequest.post('/login', { username: 'a' }, { auth: false })).resolves.toEqual({
      token: 'new-token',
    });

    expect(uni.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: 'http://localhost:8000/login',
      header: {
        'content-type': 'application/json',
        'X-Visitor-ID': 'stored-visitor',
      },
    }));
    expect(uni.setStorageSync).toHaveBeenCalledWith('visitor_id', 'response-visitor');
  });

  it('rawRequest still accepts legacy boolean silent argument', async () => {
    uni.request.mockResolvedValue({
      statusCode: 500,
      data: { message: 'server failed' },
    });

    await expect(rawRequest.get('/legacy', null, false)).rejects.toMatchObject({
      statusCode: 500,
      message: 'server failed',
    });

    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'server failed',
      icon: 'error',
    }));
  });

  it('treats redirects as non-success responses', async () => {
    uni.request.mockResolvedValue({
      statusCode: 302,
      data: { message: '请求被重定向' },
    });

    await expect(rawRequest.get('/redirect')).rejects.toMatchObject({
      statusCode: 302,
      code: 302,
      message: '请求被重定向',
    });
  });

  it('upload uses the shared token and parses JSON response data', async () => {
    uni.uploadFile.mockResolvedValue({
      statusCode: 200,
      data: '{"url":"https://cos.example.test/file.mp3"}',
    });

    await expect(httpClient.upload('/tmp/audio.mp3')).resolves.toEqual({
      url: 'https://cos.example.test/file.mp3',
    });

    expect(uni.uploadFile).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:8000/files',
      filePath: '/tmp/audio.mp3',
      name: 'file',
      header: {
        Authorization: 'Bearer stored-token',
        'X-Visitor-ID': 'stored-visitor',
      },
    }));
    expect(uni.showLoading).toHaveBeenCalledWith({ title: '上传中……', mask: false });
  });

  it('upload falls back to raw data when response body is not JSON', async () => {
    uni.uploadFile.mockResolvedValue({
      statusCode: 200,
      data: 'not-json',
    });

    await expect(httpClient.upload('/tmp/audio.mp3')).resolves.toEqual({
      data: 'not-json',
    });
  });

  it('preserves a JSON-string upload error and structured diagnostics', async () => {
    uni.uploadFile.mockResolvedValue({
      statusCode: 400,
      errMsg: 'uploadFile:ok',
      data: JSON.stringify({
        code: 400, message: '无法解析音频文件', data: { file: '损坏的音频' }, request_id: 'upload-error-1',
      }),
    });
    await expect(httpClient.upload('/tmp/broken.webm')).rejects.toMatchObject({
      statusCode: 400,
      code: 400,
      message: '无法解析音频文件',
      data: { file: '损坏的音频' },
      requestId: 'upload-error-1',
    });
  });

  it('accepts an object error body from upload adapters', async () => {
    uni.uploadFile.mockResolvedValue({ statusCode: 503, data: { message: '录音服务维护中' }, errMsg: 'uploadFile:ok' });
    await expect(httpClient.upload('/tmp/audio.mp3')).rejects.toMatchObject({ message: '录音服务维护中' });
  });

  it.each(['', '<html>Bad Gateway</html>', '{broken', 'null', '[]'])('uses a readable HTTP fallback for an unusable upload error body: %s', async (data) => {
    uni.uploadFile.mockResolvedValue({ statusCode: 503, data, errMsg: 'uploadFile:ok' });
    await expect(httpClient.upload('/tmp/audio.mp3')).rejects.toMatchObject({
      statusCode: 503, message: '服务暂不可用，请稍后重试', data: {},
    });
  });

  it('preserves the reason for a rejected upload transport', async () => {
    uni.uploadFile.mockRejectedValue({ errMsg: '网络连接已断开' });
    await expect(httpClient.upload('/tmp/audio.mp3')).rejects.toMatchObject({ statusCode: 0, message: '网络连接已断开' });
  });
});
