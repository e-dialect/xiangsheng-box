import { mount } from '@vue/test-utils';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  registerUser: vi.fn(),
  normalLogin: vi.fn(),
  sendEmailCode: vi.fn(),
}));

vi.mock('@/services/user', () => ({ registerUser: mocks.registerUser }));
vi.mock('@/services/login', () => ({ normalLogin: mocks.normalLogin }));
vi.mock('@/services/verification', () => ({ sendEmailCode: mocks.sendEmailCode }));

const { default: RegisterPage } = await import('@/pages/login/register.vue');

function mountPage() {
  return mount(RegisterPage, {
    global: {
      stubs: {
        PageShell: { template: '<main><slot /></main>' },
      },
    },
  });
}

function fillValidForm(wrapper) {
  Object.assign(wrapper.vm, {
    username: 'collector',
    password: 'password123',
    passwordConfirmed: 'password123',
    email: 'collector@example.com',
    code: '123456',
  });
}

describe('register page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    globalThis.uni = {
      showToast: vi.fn(),
    };
    mocks.registerUser.mockResolvedValue({ id: 9 });
    mocks.normalLogin.mockResolvedValue({ id: 9 });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('registers then logs in with the new account by email', async () => {
    const wrapper = mountPage();
    fillValidForm(wrapper);

    await wrapper.vm.register();

    expect(mocks.registerUser).toHaveBeenCalledWith(
      'collector',
      'password123',
      'collector@example.com',
      '123456',
    );
    expect(mocks.normalLogin).toHaveBeenCalledWith('collector', 'password123', { isNew: true });
    expect(wrapper.vm.submitting).toBe(false);
  });

  it('blocks submission when client validation fails', async () => {
    const wrapper = mountPage();
    fillValidForm(wrapper);
    wrapper.vm.passwordConfirmed = 'different';

    await wrapper.vm.register();

    expect(mocks.registerUser).not.toHaveBeenCalled();
    expect(wrapper.vm.errors.passwordConfirmed).toBe('两次密码不相同');
  });

  it('keeps email verification behind valid account details', async () => {
    const wrapper = mountPage();

    expect(wrapper.vm.formStep).toBe(1);
    expect(wrapper.text()).not.toContain('邮箱只用于验证身份');
    wrapper.vm.continueToEmail();
    expect(wrapper.vm.errors.username).toBe('请输入用户名');
    expect(wrapper.vm.formStep).toBe(1);

    wrapper.vm.username = '  collector  ';
    wrapper.vm.password = 'password123';
    wrapper.vm.passwordConfirmed = 'password123';
    wrapper.vm.continueToEmail();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.username).toBe('collector');
    expect(wrapper.vm.formStep).toBe(2);
    expect(wrapper.text()).toContain('邮箱只用于验证身份');
  });

  it('returns to account details through a TDesign text action without losing email draft', async () => {
    const wrapper = mountPage();
    fillValidForm(wrapper);
    wrapper.vm.formStep = 2;
    await wrapper.vm.$nextTick();

    const backAction = wrapper.findAllComponents({ name: 'TDesignStub' })
      .find((component) => component.props('ariaLabel') === '返回修改账号信息');
    expect(backAction.props('variant')).toBe('text');
    backAction.vm.$emit('click');

    expect(wrapper.vm.formStep).toBe(1);
    expect(wrapper.vm.email).toBe('collector@example.com');
    expect(wrapper.vm.code).toBe('123456');
  });

  it('blocks repeat requests while sending and only cools down the destination email', async () => {
    const wrapper = mountPage();
    wrapper.vm.formStep = 2;
    wrapper.vm.email = 'collector@example.com';
    let resolveSend;
    mocks.sendEmailCode.mockReturnValue(new Promise((resolve) => { resolveSend = resolve; }));

    const sending = wrapper.vm.getCode();
    await wrapper.vm.getCode();
    expect(wrapper.text()).toContain('发送中…');
    expect(mocks.sendEmailCode).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmailCode).toHaveBeenCalledWith('collector@example.com', 'register', true);

    resolveSend({});
    await sending;
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '验证码已发送',
      icon: 'success',
    }));
    expect(wrapper.vm.sendCodeMsg).toBe('重新获取(30)');
    wrapper.vm.email = 'other@example.com';
    expect(wrapper.vm.sendCodeMsg).toBe('获取验证码');
    wrapper.vm.email = 'Collector@example.com';
    expect(wrapper.vm.sendCodeMsg).toBe('重新获取(30)');
    vi.advanceTimersByTime(30_000);
    expect(wrapper.vm.sendCodeMsg).toBe('获取验证码');
    wrapper.unmount();
  });

  it('maps server field errors onto the matching field without a toast', async () => {
    const wrapper = mountPage();
    fillValidForm(wrapper);
    mocks.registerUser.mockRejectedValue({
      statusCode: 409,
      message: '该邮箱已被绑定',
      data: { email: '该邮箱已被绑定' },
    });

    await wrapper.vm.register();

    expect(wrapper.vm.errors.email).toBe('该邮箱已被绑定');
    expect(wrapper.vm.errors.username).toBe('');
    expect(uni.showToast).not.toHaveBeenCalled();
    expect(wrapper.vm.submitting).toBe(false);
  });

  it('falls back to one status-aware toast for unfielded errors', async () => {
    const wrapper = mountPage();
    fillValidForm(wrapper);
    mocks.registerUser.mockRejectedValue({ statusCode: 401, message: '' });

    await wrapper.vm.register();

    expect(uni.showToast).toHaveBeenCalledTimes(1);
    expect(uni.showToast).toHaveBeenCalledWith({ title: '验证码错误', icon: 'none' });
  });

  it('recovers the message when empty-body conflicts only expose a reason phrase', async () => {
    const wrapper = mountPage();
    fillValidForm(wrapper);
    mocks.registerUser.mockRejectedValue({ statusCode: 409, message: 'Conflict' });

    await wrapper.vm.register();

    expect(uni.showToast).toHaveBeenCalledWith({ title: '用户名或邮箱已存在', icon: 'none' });
  });
});
