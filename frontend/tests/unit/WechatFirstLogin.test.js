import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import BaseButton from '@/components/BaseButton.vue';
import LoginPage from '@/pages/login/login.vue';
import { isCapabilityEnabled } from '@/services/capabilities';
import { mpLogin, normalLogin } from '@/services/login';
import { peekInterceptIntent } from '@/services/authGuard';

vi.mock('@/services/capabilities', () => ({
  CAPABILITIES: { WECHAT_AUTH: 'wechat_auth' },
  isCapabilityEnabled: vi.fn(),
}));

vi.mock('@/services/login', () => ({
  mpLogin: vi.fn(),
  normalLogin: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  actionLabel: vi.fn(() => '录制乡音'),
  peekInterceptIntent: vi.fn(),
}));

function mountLogin() {
  const wrapper = mount(LoginPage, {
    global: {
      stubs: { PageShell: { template: '<main><slot /></main>' } },
    },
  });
  wrapper.vm.$options.onLoad.call(wrapper.vm);
  return wrapper;
}

function findButton(wrapper, text) {
  return wrapper.findAllComponents(BaseButton).find((button) => button.props('text') === text);
}

describe('WeChat-first login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { getStorageSync: vi.fn(() => '') };
    isCapabilityEnabled.mockReturnValue(true);
    peekInterceptIntent.mockReturnValue({ action: 'record_recording' });
  });

  it('shows one primary WeChat action and opens password login on the same page', async () => {
    const wrapper = mountLogin();
    await wrapper.vm.$nextTick();

    expect(findButton(wrapper, '微信一键登录').props('variant')).toBe('primary');
    expect(wrapper.get('.login-form').classes()).toContain('login-alternative--hidden');
    expect(wrapper.find('.login-links').exists()).toBe(false);

    findButton(wrapper, '使用账号密码').vm.$emit('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.password-form').isVisible()).toBe(true);
    expect(wrapper.get('.login-links').isVisible()).toBe(true);
    expect(wrapper.get('.login-links').text()).toContain('邮箱注册');
    expect(findButton(wrapper, '微信一键登录')).toBeUndefined();

    await wrapper.setData({ username: 'collector', password: 'password123' });
    await wrapper.vm.passwordLogin();
    expect(normalLogin).toHaveBeenCalledWith('collector', 'password123');
    expect(wrapper.text()).toContain('你刚才想录制乡音');

    findButton(wrapper, '返回微信登录').vm.$emit('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.password-form').classes()).toContain('login-alternative--hidden');
    expect(wrapper.vm.username).toBe('collector');
  });

  it('reveals password login when the existing WeChat flow falls back', async () => {
    const wrapper = mountLogin();
    findButton(wrapper, '微信一键登录').vm.$emit('click');
    const [onFallback] = mpLogin.mock.calls[0];
    onFallback();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.password-form').isVisible()).toBe(true);
    expect(wrapper.text()).toContain('你刚才想录制乡音');
  });

  it('keeps existing account options when WeChat auth is unavailable', async () => {
    isCapabilityEnabled.mockReturnValue(false);
    const wrapper = mountLogin();
    await wrapper.vm.$nextTick();

    expect(findButton(wrapper, '微信一键登录')).toBeUndefined();
    expect(wrapper.get('.login-form').isVisible()).toBe(true);
    expect(wrapper.get('.login-links').isVisible()).toBe(true);
    expect(mpLogin).not.toHaveBeenCalled();
  });
});
