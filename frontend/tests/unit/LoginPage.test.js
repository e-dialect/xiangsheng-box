import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/authGuard', () => ({
  actionLabel: vi.fn((action) => ({ record_recording: '录制乡音' }[action] || action)),
  peekInterceptIntent: vi.fn(),
}));

vi.mock('@/services/authJourney', () => ({
  cancelLoginToSearch: vi.fn(),
}));

vi.mock('@/services/login', () => ({
  mpLogin: vi.fn(),
  normalLogin: vi.fn(),
}));

vi.mock('@/services/phoneAuth', () => ({
  loginWithPhone: vi.fn(),
  requestPhoneCode: vi.fn(),
}));

vi.mock('@/routers/login', () => ({
  toForgetPage: vi.fn(),
  toRegisterPage: vi.fn(),
  toWechatRegisterPage: vi.fn(),
}));

import { cancelLoginToSearch } from '@/services/authJourney';
import { peekInterceptIntent } from '@/services/authGuard';
import { loginWithPhone, requestPhoneCode } from '@/services/phoneAuth';
import { toForgetPage, toRegisterPage } from '@/routers/login';

globalThis.getApp = vi.fn(() => ({
  globalData: {
    CustomBar: 64,
    StatusBar: 24,
  },
}));

const { default: LoginPage } = await import('@/pages/login/login.vue');
const phoneCodeLoginEnabled = import.meta.env.VITE_PHONE_CODE_LOGIN_ENABLED === 'true';

function mountLogin(query) {
  const wrapper = mount(LoginPage, {
    global: {
      stubs: {
        PageShell: {
          template: '<div><slot /></div>',
        },
      },
    },
  });
  wrapper.vm.$options.onLoad.call(wrapper.vm, query);
  return wrapper;
}

describe('login page intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {
      getStorageSync: vi.fn(() => ''),
      onThemeChange: vi.fn(),
      offThemeChange: vi.fn(),
      showToast: vi.fn(),
    };
    loginWithPhone.mockResolvedValue({});
  });

  it('explains the intercepted action and lets the guest return to search', async () => {
    peekInterceptIntent.mockReturnValue({
      action: 'record_recording',
      context: { page: 'recording_create' },
    });
    const wrapper = mountLogin();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('你刚才想录制乡音');
    const browseFirst = wrapper.findAllComponents({ name: 'TDesignStub' })
      .find((component) => component.props('ariaLabel') === '暂不登录，先去查词');
    browseFirst.vm.$emit('click');
    expect(cancelLoginToSearch).toHaveBeenCalledTimes(1);
  });

  it('uses TDesign text buttons for every visible secondary action', async () => {
    peekInterceptIntent.mockReturnValue(null);
    const wrapper = mountLogin();
    await wrapper.vm.$nextTick();

    const textButtons = wrapper.findAllComponents({ name: 'TDesignStub' })
      .filter((component) => component.props('variant') === 'text');
    expect(textButtons.map((component) => component.props('ariaLabel'))).toEqual([
      '暂不登录，先去查词',
      '忘记密码',
      '用户注册',
      '微信注册',
    ]);

    textButtons.find((component) => component.props('ariaLabel') === '忘记密码').vm.$emit('click');
    textButtons.find((component) => component.props('ariaLabel') === '用户注册').vm.$emit('click');
    expect(toForgetPage).toHaveBeenCalledTimes(1);
    expect(toRegisterPage).toHaveBeenCalledTimes(1);
  });

  it('uses distinct copy for voluntary login', async () => {
    peekInterceptIntent.mockReturnValue({
      action: 'open_mine',
      voluntary: true,
    });
    const wrapper = mountLogin();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('验证身份后返回「我的」');
  });

  it('shows only login methods enabled for this build', async () => {
    peekInterceptIntent.mockReturnValue(null);
    const wrapper = mountLogin();

    expect(wrapper.find('.phone-form').exists()).toBe(phoneCodeLoginEnabled);
    expect(wrapper.find('.password-form').exists()).toBe(!phoneCodeLoginEnabled);
    const tabLabels = wrapper.findAllComponents({ name: 'TDesignStub' })
      .map((component) => component.props('label'));
    expect(tabLabels.includes('手机验证码')).toBe(phoneCodeLoginEnabled);
    if (!phoneCodeLoginEnabled) {
      expect(wrapper.find('.login-tabs').exists()).toBe(false);
    }
    wrapper.vm.changeMode({ detail: { value: phoneCodeLoginEnabled ? 'password' : 'phone' } });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.password-form').exists()).toBe(true);
    expect(wrapper.find('.phone-form').exists()).toBe(false);
  });

  it('does not expose phone login as a mode when its build flag is off', async () => {
    if (phoneCodeLoginEnabled) return;
    peekInterceptIntent.mockReturnValue(null);
    const wrapper = mountLogin({ mode: 'phone', loginMode: 'phone' });

    wrapper.vm.changeMode({ detail: { value: 'phone' } });
    wrapper.vm.phone = '13800000000';
    wrapper.vm.code = '123456';
    await wrapper.vm.sendPhoneCode();
    await wrapper.vm.phoneLogin();

    expect(wrapper.vm.loginMode).toBe('password');
    expect(wrapper.find('.phone-form').exists()).toBe(false);
    expect(wrapper.find('.password-form').exists()).toBe(true);
    expect(requestPhoneCode).not.toHaveBeenCalled();
    expect(loginWithPhone).not.toHaveBeenCalled();
  });

  it('maps server field errors onto the matching field without a toast', async () => {
    if (!phoneCodeLoginEnabled) return;
    peekInterceptIntent.mockReturnValue(null);
    const wrapper = mountLogin();
    wrapper.vm.phone = '13800000000';
    wrapper.vm.code = '000000';
    loginWithPhone.mockRejectedValue({
      statusCode: 400,
      message: '请求参数校验失败',
      data: { code: { code: 'invalid', message: '验证码错误' } },
    });

    await wrapper.vm.phoneLogin();

    expect(wrapper.vm.errors.code).toBe('验证码错误');
    expect(wrapper.vm.errors.phone).toBe('');
    expect(uni.showToast).not.toHaveBeenCalled();
  });

  it('falls back to a single toast when the server error has no field', async () => {
    if (!phoneCodeLoginEnabled) return;
    peekInterceptIntent.mockReturnValue(null);
    const wrapper = mountLogin();
    wrapper.vm.phone = '13800000000';
    wrapper.vm.code = '000000';
    loginWithPhone.mockRejectedValue({ statusCode: 401, message: '手机号或验证码错误' });

    await wrapper.vm.phoneLogin();

    expect(uni.showToast).toHaveBeenCalledTimes(1);
    expect(uni.showToast).toHaveBeenCalledWith({ title: '手机号或验证码错误', icon: 'none' });
    expect(wrapper.vm.errors.phone).toBe('');
    expect(wrapper.vm.errors.code).toBe('');
  });
});
