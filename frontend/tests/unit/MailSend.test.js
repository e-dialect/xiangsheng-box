import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  getUserInfo: vi.fn(),
  searchUsers: vi.fn(),
}));

vi.mock('@/services/mail', () => ({
  postMail: vi.fn(),
}));
vi.mock('@/services/user', () => ({
  getUserInfo: mocks.getUserInfo,
  searchUsers: mocks.searchUsers,
}));

const { default: MailSendPage } = await import('@/pages/mails/send.vue');

const recipient = {
  id: 9,
  username: 'lin-local',
  nickname: '阿林',
  avatar: '',
  primary_dialect: { id: 3, name: '莆仙话' },
};

function mountPage() {
  return mount(MailSendPage, {
    global: {
      stubs: {
        PageShell: { template: '<main><slot /></main>' },
        SectionBlock: {
          props: ['title'],
          template: '<section><h2>{{ title }}</h2><slot /></section>',
        },
        BaseForm: {
          name: 'BaseForm',
          props: ['data', 'rules'],
          template: '<div><slot /></div>',
          methods: { validate() { return Promise.resolve(true); } },
        },
        BaseField: true,
        BaseButton: true,
        BaseLoading: true,
        TCell: true,
        TSearch: true,
      },
    },
  });
}

describe('mail send recipient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserInfo.mockResolvedValue({ user: recipient });
    mocks.searchUsers.mockResolvedValue([recipient]);
  });

  it('opens an editable administrator draft for a public object without sending it', () => {
    const wrapper = mountPage();
    MailSendPage.onLoad.call(wrapper.vm, {
      id: '-1', object_type: 'entry', object_id: '64', content: 'untrusted', title: 'untrusted',
    });
    expect(wrapper.vm.recipientId).toBe('-1');
    expect(wrapper.vm.Notification.title).toBe('词条链接反馈');
    expect(wrapper.vm.Notification.content).toContain('对象：词条 64');
    expect(wrapper.vm.Notification.content).toContain(window.location.hostname);
    expect(wrapper.vm.Notification.content).not.toContain('untrusted');
  });

  it('does not leak route title parameters into the page shell', () => {
    expect(MailSendPage.inheritAttrs).toBe(false);
  });

  it('resolves a route recipient into a recognizable identity', async () => {
    const wrapper = mountPage();
    await wrapper.vm.applyRecipient(9);
    await wrapper.vm.$nextTick();

    expect(mocks.searchUsers).toHaveBeenCalledWith('9', 8);
    expect(mocks.getUserInfo).not.toHaveBeenCalled();
    expect(wrapper.vm.Notification.recipients).toEqual(['9']);
    expect(wrapper.vm.recipientLocked).toBe(true);
    expect(wrapper.vm.recipientLabel).toBe('阿林');
    expect(wrapper.vm.recipientHint).toBe('@lin-local · 用户 #9 · 莆仙话');
    expect(wrapper.text()).toContain('阿林');
  });

  it('ignores a malformed route recipient instead of exposing it as an editable ID', () => {
    const wrapper = mountPage();

    wrapper.vm.applyRecipient('not-an-id');

    expect(wrapper.vm.recipientLocked).toBe(false);
    expect(wrapper.vm.Notification.recipients).toEqual(['']);
    expect(mocks.getUserInfo).not.toHaveBeenCalled();
  });

  it.each(['self', 'inactive', 'administrator'])('rejects an ineligible %s deep link', async () => {
    mocks.searchUsers.mockResolvedValue([]);
    const wrapper = mountPage();
    await wrapper.vm.applyRecipient(9);
    expect(wrapper.vm.recipientLocked).toBe(false);
    expect(wrapper.vm.Notification.recipients).toEqual(['']);
    expect(wrapper.vm.recipientError).toContain('请重新搜索');
    expect(mocks.getUserInfo).not.toHaveBeenCalled();
  });

  it('does not substitute a numeric nickname match for the linked user', async () => {
    mocks.searchUsers.mockResolvedValue([{ ...recipient, id: 10, nickname: '9' }]);
    const wrapper = mountPage();
    await wrapper.vm.applyRecipient(9);
    expect(wrapper.vm.recipientLocked).toBe(false);
  });

  it('searches by public identity and selects a result', async () => {
    const wrapper = mountPage();
    wrapper.vm.recipientQuery = '阿林';

    await wrapper.vm.searchRecipients();

    expect(mocks.searchUsers).toHaveBeenCalledWith('阿林', 8);
    expect(wrapper.vm.recipientResults).toEqual([recipient]);
    expect(wrapper.vm.recipientSearchStatus).toBe('results');

    wrapper.vm.selectRecipient(recipient);
    expect(wrapper.vm.Notification.recipients).toEqual(['9']);
    expect(wrapper.vm.recipientLocked).toBe(true);
  });

  it('keeps fresh results when TDesign flushes the matching input change later', async () => {
    const wrapper = mountPage();

    const search = wrapper.vm.searchRecipients({ value: '阿林' });
    wrapper.vm.handleRecipientQueryChange({ value: '阿林' });
    await search;

    expect(wrapper.vm.recipientResults).toEqual([recipient]);
    expect(wrapper.vm.recipientSearchStatus).toBe('results');
  });

  it('selects the administrator without asking for the -1 transport value', () => {
    const wrapper = mountPage();

    wrapper.vm.selectAdministrator();

    expect(wrapper.vm.Notification.recipients).toEqual(['-1']);
    expect(wrapper.vm.payload().recipients).toEqual(['-1']);
    expect(wrapper.vm.recipientLabel).toBe('平台管理员');
    expect(wrapper.vm.recipientHint).toContain('服务咨询');
  });
});
