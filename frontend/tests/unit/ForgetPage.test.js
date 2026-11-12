import { mount } from '@vue/test-utils';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  getEmailByUsername: vi.fn(),
  requestPasswordResetCode: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('@/services/user', () => ({
  getEmailByUsername: mocks.getEmailByUsername,
  requestPasswordResetCode: mocks.requestPasswordResetCode,
  resetPassword: mocks.resetPassword,
}));

const { default: ForgetPage } = await import('@/pages/login/forget.vue');

function mountPage() {
  return mount(ForgetPage, {
    global: {
      stubs: {
        PageShell: { template: '<main><slot /></main>' },
      },
    },
  });
}

function fillResetForm(wrapper) {
  Object.assign(wrapper.vm, {
    password: 'password123',
    repeatedPassword: 'password123',
    code: '654321',
  });
}

describe('forget password page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    globalThis.uni = {
      showToast: vi.fn(),
      navigateBack: vi.fn(),
    };
    mocks.getEmailByUsername.mockResolvedValue({ email_masked: 'c***@example.com' });
    mocks.requestPasswordResetCode.mockResolvedValue({
      email_masked: 'c***@example.com',
      demo_code: '123456',
    });
    mocks.resetPassword.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('advances to the password step with the masked email', async () => {
    const wrapper = mountPage();
    wrapper.vm.username = 'collector';

    await wrapper.vm.next();

    expect(wrapper.vm.steps).toBe(1);
    expect(wrapper.vm.emailMasked).toBe('c***@example.com');
  });

  it('requires confirmation of the current username if it changes during lookup', async () => {
    const wrapper = mountPage();
    wrapper.vm.username = 'collector';
    const checking = wrapper.vm.next();
    wrapper.vm.username = 'another';
    await checking;

    expect(wrapper.vm.steps).toBe(0);
    expect(wrapper.vm.emailMasked).toBe('');
    expect(wrapper.vm.checking).toBe(false);
  });

  it('returns to username editing and clears sensitive reset drafts', async () => {
    const wrapper = mountPage();
    wrapper.vm.username = 'collector';
    wrapper.vm.steps = 1;
    fillResetForm(wrapper);
    wrapper.vm.errors.password = '密码错误';
    wrapper.vm.errors.repeatedPassword = '两次密码不一致';
    wrapper.vm.errors.code = '验证码错误';
    await wrapper.vm.$nextTick();

    const backAction = wrapper.findAllComponents({ name: 'TDesignStub' })
      .find((component) => component.props('ariaLabel') === '返回修改用户名');
    expect(backAction.props('variant')).toBe('text');
    backAction.vm.$emit('click');

    expect(wrapper.vm.steps).toBe(0);
    expect(wrapper.vm.username).toBe('collector');
    expect(wrapper.vm.password).toBe('');
    expect(wrapper.vm.repeatedPassword).toBe('');
    expect(wrapper.vm.code).toBe('');
    expect(wrapper.vm.errors).toMatchObject({
      password: '',
      repeatedPassword: '',
      code: '',
    });
  });

  it('offers a friendly message when the username is unknown', async () => {
    const wrapper = mountPage();
    wrapper.vm.username = 'ghost';
    mocks.getEmailByUsername.mockRejectedValue({ statusCode: 404, message: 'Not Found' });

    await wrapper.vm.next();

    expect(wrapper.vm.steps).toBe(0);
    expect(uni.showToast).toHaveBeenCalledWith({ title: '没有找到该账号', icon: 'none' });
  });

  it('requests a reset code without exposing a demo code', async () => {
    const wrapper = mountPage();
    wrapper.vm.username = 'collector';
    wrapper.vm.steps = 1;

    await wrapper.vm.getCode();

    expect(mocks.requestPasswordResetCode).toHaveBeenCalledWith('collector');
    expect(wrapper.vm.emailMasked).toBe('c***@example.com');
    expect(wrapper.text()).not.toContain('123456');
    expect(wrapper.vm.sendCodeMsg).toBe('重新获取(30)');
    wrapper.unmount();
  });

  it('keeps a late code response and its cooldown with the original account', async () => {
    const wrapper = mountPage();
    wrapper.vm.username = 'collector';
    await wrapper.vm.next();
    let resolveSend;
    mocks.requestPasswordResetCode.mockReturnValueOnce(new Promise((resolve) => {
      resolveSend = resolve;
    }));

    const sending = wrapper.vm.getCode();
    await wrapper.vm.getCode();
    expect(wrapper.vm.sendCodeMsg).toBe('发送中…');
    expect(mocks.requestPasswordResetCode).toHaveBeenCalledTimes(1);
    expect(mocks.requestPasswordResetCode).toHaveBeenCalledWith('collector');

    wrapper.vm.returnToAccountStep();
    wrapper.vm.username = 'another';
    mocks.getEmailByUsername.mockResolvedValueOnce({ email_masked: 'a***@example.com' });
    await wrapper.vm.next();
    resolveSend({ email_masked: 'c***@example.com' });
    await sending;

    expect(wrapper.vm.emailMasked).toBe('a***@example.com');
    expect(wrapper.vm.sendCodeMsg).toBe('获取验证码');
    expect(uni.showToast).not.toHaveBeenCalled();
    wrapper.vm.returnToAccountStep();
    wrapper.vm.username = 'collector';
    await wrapper.vm.next();
    expect(wrapper.vm.sendCodeMsg).toBe('重新获取(30)');
    wrapper.unmount();
  });

  it('maps reset-code field errors without duplicating a toast', async () => {
    const wrapper = mountPage();
    wrapper.vm.username = 'collector';
    wrapper.vm.steps = 1;
    mocks.requestPasswordResetCode.mockRejectedValue({
      statusCode: 400,
      data: { username: '账号不可用' },
    });

    await wrapper.vm.getCode();

    expect(wrapper.vm.errors.username).toBe('账号不可用');
    expect(wrapper.vm.sendCodeMsg).toBe('获取验证码');
    expect(uni.showToast).not.toHaveBeenCalled();
  });

  it('does not let step-one errors block the password reset', async () => {
    const wrapper = mountPage();
    wrapper.vm.username = 'collector';
    fillResetForm(wrapper);
    wrapper.vm.errors.username = '请输入用户名';

    await wrapper.vm.reset();

    expect(mocks.resetPassword).toHaveBeenCalledWith('collector', 'password123', '654321');
    expect(uni.navigateBack).toHaveBeenCalled();
  });

  it('maps the server verification-code error onto the code field', async () => {
    const wrapper = mountPage();
    fillResetForm(wrapper);
    mocks.resetPassword.mockRejectedValue({
      statusCode: 400,
      message: '验证码错误',
      data: { code: '验证码错误' },
    });

    await wrapper.vm.reset();

    expect(wrapper.vm.errors.code).toBe('验证码错误');
    expect(uni.showToast).not.toHaveBeenCalled();
    expect(wrapper.vm.submitting).toBe(false);
  });

  it('validates password length and match before submitting', async () => {
    const wrapper = mountPage();
    wrapper.vm.password = '12345';
    wrapper.vm.repeatedPassword = '12345';
    wrapper.vm.code = '654321';

    await wrapper.vm.reset();

    expect(wrapper.vm.errors.password).toBe('密码长度 6 - 32 位');
    expect(mocks.resetPassword).not.toHaveBeenCalled();

    wrapper.vm.password = 'password123';
    await wrapper.vm.reset();

    expect(wrapper.vm.errors.repeatedPassword).toBe('两次密码不一致');
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });
});
