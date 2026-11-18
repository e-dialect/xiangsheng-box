import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WechatBridgeLogin from '@/pages/login/components/WechatBridgeLogin.vue';
import { afterLogin } from '@/services/login';
import { peekInterceptIntent, saveInterceptIntent } from '@/services/authGuard';
import { isH5Runtime } from '@/services/platform';
import {
  bridgeChannel,
  cancelBridge,
  exchangeBridge,
  getBridgeAvailability,
  openBridgeLink,
  readBridgeAttempt,
  startBridge,
  storeBridgeAttempt,
} from '@/services/wechatBridge';

vi.mock('@/services/authGuard', () => ({
  clearInterceptIntent: vi.fn(),
  peekInterceptIntent: vi.fn(() => null),
  saveInterceptIntent: vi.fn(),
}));
vi.mock('@/services/login', () => ({ afterLogin: vi.fn() }));
vi.mock('@/services/platform', () => ({ isH5Runtime: vi.fn() }));
vi.mock('@/services/wechatBridge', () => ({
  bridgeChannel: vi.fn(),
  cancelBridge: vi.fn(),
  exchangeBridge: vi.fn(),
  getBridgeAvailability: vi.fn(),
  openBridgeLink: vi.fn(),
  readBridgeAttempt: vi.fn(),
  startBridge: vi.fn(),
  storeBridgeAttempt: vi.fn(),
}));

const qr = 'data:image/png;base64,AA==';
const link = 'https://wxaurl.cn/test';
const ticket = () => ({
  request_id: 'a'.repeat(32),
  exchange_key: 'b'.repeat(43),
  expires_at: new Date(Date.now() + 300000).toISOString(),
  reference: '123456',
});

describe('WeChat login through the mini-program', () => {
  let wrapper;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    globalThis.uni = {
      onAppShow: vi.fn(),
      offAppShow: vi.fn(),
      onAppHide: vi.fn(),
      offAppHide: vi.fn(),
    };
    isH5Runtime.mockReturnValue(true);
    bridgeChannel.mockReturnValue('web_qr');
    getBridgeAvailability.mockResolvedValue({ web: true, app: true });
    cancelBridge.mockResolvedValue({});
    exchangeBridge.mockResolvedValue({ status: 'pending' });
    readBridgeAttempt.mockReturnValue(null);
    peekInterceptIntent.mockReturnValue(null);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function showLogin() {
    wrapper = mount(WechatBridgeLogin, { global: { stubs: { BaseButton: true } } });
    await flushPromises();
  }

  async function click(text) {
    const button = wrapper.findAllComponents({ name: 'BaseButton' })
      .find((item) => item.props('text') === text);
    button.vm.$emit('click');
    await flushPromises();
  }

  it('shows the desktop QR then applies the login when the phone confirms', async () => {
    const intent = { action: 'bookmark_entry', context: { entryId: 42 } };
    const attempt = { ...ticket(), qr_image: qr };
    peekInterceptIntent.mockReturnValue(intent);
    startBridge.mockResolvedValue(attempt);
    await showLogin();
    await click('微信登录');

    expect(startBridge).toHaveBeenCalledWith('web_qr');
    expect(wrapper.text()).toContain('123456');
    expect(wrapper.find('image').attributes('src')).toBe(qr);
    expect(openBridgeLink).not.toHaveBeenCalled();
    expect(storeBridgeAttempt).toHaveBeenCalledWith({ ...attempt, channel: 'web_qr', intent });

    const result = { id: 7, token: 'example', isNew: true };
    exchangeBridge.mockResolvedValue(result);
    await vi.advanceTimersByTimeAsync(2000);
    expect(afterLogin).toHaveBeenCalledOnce();
    expect(saveInterceptIntent).toHaveBeenCalledWith(intent);
    expect(afterLogin).toHaveBeenCalledWith(result, { isNew: true });
    expect(storeBridgeAttempt).toHaveBeenLastCalledWith(null);
  });

  it('restores the same-tab mobile request after returning from WeChat', async () => {
    const attempt = { ...ticket(), channel: 'web', launch_url: link };
    readBridgeAttempt.mockReturnValue(attempt);
    const result = { id: 7, token: 'example', isNew: false };
    exchangeBridge.mockResolvedValue(result);
    bridgeChannel.mockReturnValue('web');

    await showLogin();
    expect(exchangeBridge).toHaveBeenCalledWith(attempt);
    expect(afterLogin).toHaveBeenCalledWith(result, { isNew: false });
    expect(openBridgeLink).not.toHaveBeenCalled();
  });

  it('pauses App polling in the background and completes on foreground', async () => {
    isH5Runtime.mockReturnValue(false);
    bridgeChannel.mockReturnValue('app');
    startBridge.mockResolvedValue({ ...ticket(), launch_url: link });
    await showLogin();
    await click('微信登录');

    expect(openBridgeLink).toHaveBeenCalledWith(link, expect.any(Function));
    globalThis.uni.onAppHide.mock.calls[0][0]();
    exchangeBridge.mockClear();
    await vi.advanceTimersByTimeAsync(4000);
    expect(exchangeBridge).not.toHaveBeenCalled();

    const result = { id: 7, token: 'example', isNew: false };
    exchangeBridge.mockResolvedValue(result);
    globalThis.uni.onAppShow.mock.calls[0][0]();
    await flushPromises();
    expect(afterLogin).toHaveBeenCalledOnce();
    expect(afterLogin).toHaveBeenCalledWith(result, { isNew: false });
  });

  it('ignores a response arriving after the user cancels', async () => {
    startBridge.mockResolvedValue({ ...ticket(), qr_image: qr });
    let finishExchange;
    exchangeBridge.mockReturnValue(new Promise((resolve) => { finishExchange = resolve; }));
    await showLogin();
    await click('微信登录');
    await click('取消微信登录');

    finishExchange({ id: 7, token: 'example', isNew: false });
    await flushPromises();
    expect(cancelBridge).toHaveBeenCalledOnce();
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(afterLogin).not.toHaveBeenCalled();
  });
});
