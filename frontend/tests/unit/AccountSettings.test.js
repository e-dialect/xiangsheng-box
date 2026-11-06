import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/navigation', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    goBack: vi.fn(),
    goCircleList: vi.fn(),
    goContributionHistory: vi.fn(),
    goEntryBookmarks: vi.fn(),
    goHome: vi.fn(),
    goLogin: vi.fn(),
    goMailSend: vi.fn(),
    goSearch: vi.fn(),
    goThemeCenter: vi.fn(),
    goUserEmail: vi.fn(),
    goUserInformation: vi.fn(),
  };
});

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(async () => ({
      user: {
        id: 7,
        nickname: '采集者',
        username: 'collector',
        wechat: false,
        follower_count: 0,
        following_count: 0,
        followed_dialects: [],
      },
      contribution: { recordings_total: 0, entries_total: 0, senses_total: 0 },
      notification: { statistics: { unread: 0 } },
    })),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/user', () => ({
  getUserInfo: vi.fn(async () => ({
    user: {
      id: 7,
      nickname: '采集者',
      username: 'collector',
      email: '',
      wechat: false,
    },
    contribution: { recordings_total: 0, entries_total: 0, senses_total: 0 },
    notification: { statistics: { unread: 0 } },
  })),
  changeUserInfo: vi.fn(async () => ({ token: 'token', user: { nickname: '新昵称' } })),
  changeUserPassword: vi.fn(),
  changeUserEmail: vi.fn(),
  clearUserInfo: vi.fn(),
  bindingWechat: vi.fn(),
  cancelBindingWechat: vi.fn(),
}));

vi.mock('@/services/authJourney', () => ({
  openLoginFromMine: vi.fn(),
}));

vi.mock('@/services/file', () => ({
  uploadFile: vi.fn(),
}));

vi.mock('@/services/guantou', () => ({
  listAllDialects: vi.fn(async () => []),
}));

vi.mock('@/services/entryRecording', async (importOriginal) => ({
  ...(await importOriginal()),
  listPublicCreatorEntries: vi.fn(async () => ({ results: [] })),
  listRecordings: vi.fn(async () => ({ results: [] })),
  getCurationSummary: vi.fn(async () => {
    throw Object.assign(new Error('forbidden'), { statusCode: 403 });
  }),
}));

vi.mock('@/services/following', () => ({
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}));

vi.mock('@/services/shareMessages', () => ({
  defaultMessage: vi.fn(() => ({})),
}));

vi.mock('@/services/feedback', () => ({
  notify: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('@/services/theme', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    applyTheme: vi.fn(() => ({
      preference: 'light',
      resolved: 'light',
      accent: 'pine',
      buttonStyle: 'fill',
      primaryLook: 'fill',
      ghostLook: 'line',
      effect: 'none',
      pack: 'pine',
    })),
    getThemePreference: vi.fn(() => 'light'),
    getAccentPreference: vi.fn(() => 'pine'),
  };
});

vi.mock('@/components/ConfirmDialog', () => ({
  default: vi.fn(async () => true),
}));

import {
  goBack,
  goCircleList,
  goContributionHistory,
  goEntryBookmarks,
  goHome,
  goLogin,
  goMailSend,
  goSearch,
  goThemeCenter,
  goUserEmail,
  goUserInformation,
} from '@/services/navigation';
import { notify, notifySuccess } from '@/services/feedback';
import * as themeCenter from '@/services/themeCenter';
import { bindingWechat, cancelBindingWechat, clearUserInfo, changeUserInfo, getUserInfo } from '@/services/user';
import request from '@/utils/request';
import confirmDialog from '@/components/ConfirmDialog';

const app = {
  globalData: {
    id: 7,
    userInfo: {
      id: 7,
      nickname: '采集者',
      username: 'collector',
      telephone: '13900000001',
    },
  },
};
globalThis.getApp = vi.fn(() => app);

const accountPages = [
  'src/pages/users/me.vue',
  'src/pages/users/details.vue',
  'src/pages/users/settings/information.vue',
  'src/pages/users/settings/username.vue',
  'src/pages/users/settings/nickname.vue',
  'src/pages/users/settings/email.vue',
  'src/pages/users/settings/password.vue',
  'src/pages/users/settings/telephone.vue',
  'src/pages/users/settings/components/AccountSettingPanel.vue',
  'src/pages/users/recommend-follow.vue',
  'src/pages/users/theme-center.vue',
  'src/pages/users/theme-dress.vue',
  'src/pages/users/theme-acquire.vue',
  'src/pages/users/theme-member.vue',
  'src/pages/users/theme-event.vue',
  'src/components/ThemeShareSheet.vue',
  'src/components/ThemeLivePreview.vue',
  'src/components/ThemeJourneyIntro.vue',
];

const { default: NicknamePage } = await import('@/pages/users/settings/nickname.vue');
const { default: PasswordPage } = await import('@/pages/users/settings/password.vue');
const { default: UserDetailsPage } = await import('@/pages/users/details.vue');
const { default: MePage } = await import('@/pages/users/me.vue');

function mountForm(Page) {
  return mount(Page, {
    global: {
      stubs: {
        PageShell: { template: '<main><slot /></main>' },
        AppShell: { template: '<main><slot /></main>' },
        TCell: {
          name: 'TCell',
          props: [
            'title', 'description', 'note', 'arrow', 'hover', 'bordered',
            'customStyle', 'ariaLabel',
          ],
          emits: ['click'],
          template: '<button class="t-cell-stub" @click="$emit(\'click\')">{{ title }} {{ note }}</button>',
        },
        SectionBlock: { template: '<section><slot /></section>' },
        BaseForm: {
          name: 'BaseForm',
          props: ['data', 'rules'],
          template: '<div><slot /></div>',
          methods: { validate() { return Promise.resolve(true); } },
        },
        ThemeSwitcher: true,
      },
    },
  });
}

describe('account UI tokens', () => {
  it('does not introduce hardcoded hex colors in account pages', () => {
    const hex = /#[0-9a-fA-F]{3,8}\b/;
    accountPages.forEach((relativePath) => {
      const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
      expect(source, relativePath).not.toMatch(hex);
    });
  });

  it('uses the V2 account and contribution terms', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/users/me.vue'),
      'utf8',
    );
    expect(source).toContain('class="account-page"');
    expect(source).not.toContain('class="page"');
    expect(source).toContain('编辑资料');
    expect(source).toContain('乡声号');
    expect(source).toContain('录乡音');
    expect(source).toContain('录音与授权');
    expect(source).toContain('贡献履历');
    expect(source).toContain('查看贡献履历');
    expect(source).not.toContain('作品');
    expect(source).not.toContain('短视频');
    expect(source).not.toContain('titleLabel');
  });

  it('keeps account utilities in domain-neutral V2 terms', () => {
    const mine = readFileSync(
      resolve(process.cwd(), 'src/pages/users/me.vue'),
      'utf8',
    );
    const details = readFileSync(
      resolve(process.cwd(), 'src/pages/users/details.vue'),
      'utf8',
    );
    expect(mine).toContain('收藏');
    expect(mine).toContain('词条收藏');
    expect(mine).toContain('关注的方言');
    expect(mine).toContain('AccountSettingsMenu');
    expect(mine).toContain('申请成为整理员');
    expect(mine).toContain('管理与审核');
    expect(mine).toContain('主题中心');
    expect(mine).toContain('邮箱');
    expect(mine).not.toContain('网页演示绑定微信');
    expect(details).toContain('私信');
    expect(details).toContain("requireAuth('dm'");
    expect(mine).toContain('pressable');
    expect(details).toContain('prefers-reduced-motion');
    expect(details).not.toContain('短视频');
    expect(mine).not.toContain('微博');
    expect(details).not.toContain('微博');
  });

  it('keeps the guest login hook used by H5 e2e', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/users/me.vue'),
      'utf8',
    );
    expect(source).toContain('login-button');
    expect(source).toContain('还没有登录');
  });

  it('keeps private account fields from being labeled public', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/users/settings/information.vue'),
      'utf8',
    );
    expect(source).toContain('公开档案');
    expect(source).toContain('仅自己可见');
    expect(source).toContain('goLogin');
    expect(source).toContain('overflow-wrap: anywhere');
    expect(source).toContain('从相册选择');
    expect(source).toContain('chooseAvatar');
    expect(source).toContain('chooseMessageFile');
    expect(source).not.toContain('type="nickname"');
    expect(source).not.toContain('微信头像和聊天记录需要在小程序里使用');
    expect(source).not.toContain('将会默认公开');
  });

  it('keeps the identity journey and account settings on one visual language', () => {
    const compactSettingPages = [
      'src/pages/users/settings/username.vue',
      'src/pages/users/settings/nickname.vue',
      'src/pages/users/settings/email.vue',
      'src/pages/users/settings/password.vue',
      'src/pages/users/settings/telephone.vue',
    ];
    compactSettingPages.forEach((relativePath) => {
      const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
      expect(source, relativePath).toContain('AccountSettingPanel');
    });

    const recommendations = readFileSync(
      resolve(process.cwd(), 'src/pages/users/recommend-follow.vue'),
      'utf8',
    );
    const information = readFileSync(
      resolve(process.cwd(), 'src/pages/users/settings/information.vue'),
      'utf8',
    );
    expect(recommendations).toContain('AuthJourney');
    expect(recommendations).toContain('creator-avatar--fallback');
    expect(information).toContain('hero-avatar--fallback');
  });
});

describe('nickname settings form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    app.globalData.id = 7;
    globalThis.uni = {
      getStorageSync: vi.fn((key) => (key === 'id' ? 7 : '')),
      setStorageSync: vi.fn(),
      showToast: vi.fn(),
    };
    request.put.mockResolvedValue({ token: 'token', user: { nickname: '新昵称' } });
    changeUserInfo.mockResolvedValue({ token: 'token', user: { nickname: '新昵称' } });
  });

  it('keeps WeChat nickname fill on the nickname page for mini-program builds', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/pages/users/settings/nickname.vue'),
      'utf8',
    );
    expect(source).toContain('type="nickname"');
    expect(source).toContain('MP-WEIXIN');
  });

  it('blocks empty nickname and maps field errors from data.nickname', async () => {
    const wrapper = mountForm(NicknamePage);
    wrapper.vm.$options.onShow.call(wrapper.vm);
    wrapper.vm.form.nickname = '   ';
    await wrapper.vm.saveNickname();
    expect(wrapper.vm.error).toBe('请输入昵称');
    expect(changeUserInfo).not.toHaveBeenCalled();

    wrapper.vm.form.nickname = '新昵称';
    changeUserInfo.mockRejectedValueOnce({
      message: '请求参数校验失败',
      data: { nickname: { code: 'invalid', message: '昵称过长' } },
    });
    await wrapper.vm.saveNickname();
    await flushPromises();
    expect(wrapper.vm.error).toBe('昵称过长');
    expect(notify).toHaveBeenCalledWith({ title: '昵称过长' });
    expect(goBack).not.toHaveBeenCalled();
  });

  it('keeps a generic error off the field helper and uses it as form fallback', async () => {
    const wrapper = mountForm(NicknamePage);
    wrapper.vm.$options.onShow.call(wrapper.vm);
    wrapper.vm.form.nickname = '新昵称';
    changeUserInfo.mockRejectedValueOnce({ message: '请求参数校验失败' });
    await wrapper.vm.saveNickname();
    await flushPromises();
    expect(wrapper.vm.error).toBe('请求参数校验失败');
  });

  it('does not kick a stored session to login before App hydrates globalData', () => {
    app.globalData.id = null;
    globalThis.uni.getStorageSync = vi.fn((key) => {
      if (key === 'token') return 'token';
      if (key === 'id') return 7;
      return '';
    });
    const wrapper = mountForm(NicknamePage);
    wrapper.vm.$options.onShow.call(wrapper.vm);
    expect(goLogin).not.toHaveBeenCalled();
    expect(app.globalData.id).toBe(7);
    expect(wrapper.vm.form.nickname).toBe('采集者');
    app.globalData.id = 7;
  });

  it('saves and returns after success', async () => {
    const wrapper = mountForm(NicknamePage);
    wrapper.vm.$options.onShow.call(wrapper.vm);
    wrapper.vm.form.nickname = '新昵称';
    await wrapper.vm.saveNickname();
    await flushPromises();
    expect(changeUserInfo).toHaveBeenCalled();
    expect(goBack).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith('修改成功');
  });

  it('fills a WeChat nickname into the form without saving until confirm', async () => {
    const wrapper = mountForm(NicknamePage);
    wrapper.vm.$options.onShow.call(wrapper.vm);
    wrapper.vm.onWechatNickname({ detail: { value: ' 微信昵称 ' } });
    expect(wrapper.vm.form.nickname).toBe('微信昵称');
    expect(changeUserInfo).not.toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith('已填入微信昵称，确认后点保存');
  });
});

describe('password settings form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {
      showToast: vi.fn(),
    };
    request.put.mockResolvedValue({});
  });

  it('requires all fields and matching confirmation before submit', async () => {
    const wrapper = mountForm(PasswordPage);
    await wrapper.vm.savePassword();
    expect(wrapper.vm.oldError).toBe('请输入原密码');
    expect(request.put).not.toHaveBeenCalled();

    wrapper.vm.oldPassword = 'old-pass';
    wrapper.vm.newPassword = 'new-pass';
    wrapper.vm.confirmPassword = 'other-pass';
    await wrapper.vm.savePassword();
    expect(wrapper.vm.confirmError).toBe('两次密码不一样');
    expect(request.put).not.toHaveBeenCalled();
  });
});

describe('user details page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      reLaunch: vi.fn(),
    };
  });

  it('renders inside PageShell', () => {
    const wrapper = mountForm(UserDetailsPage);
    expect(wrapper.findComponent({ name: 'BaseLoading' }).props('text'))
      .toBe('正在读取用户档案…');
  });

  it('uses a readable avatar fallback and keyboard-selectable contribution tabs', () => {
    const wrapper = mountForm(UserDetailsPage);
    wrapper.vm.userInfo.user.nickname = '采集者';

    expect(wrapper.vm.profileInitial).toBe('采');
    wrapper.vm.selectWorksTab('entries');
    expect(wrapper.vm.worksTab).toBe('entries');
  });

  it('switches works tabs and treats a non-zero public count as a filled panel', () => {
    const wrapper = mountForm(UserDetailsPage);
    wrapper.vm.id = 9;
    wrapper.vm.userInfo.contribution = { recordings: 4, senses: 0, entries: 0 };
    wrapper.vm.worksTab = 'recordings';
    expect(wrapper.vm.worksPanelTitle).toBe('留下 4 段录音');
    wrapper.vm.worksTab = 'entries';
    expect(wrapper.vm.worksPanelTitle).toBe('还没有公开词条贡献');
  });

  it('hides uploaded contribution totals from visitors', () => {
    const wrapper = mountForm(UserDetailsPage);
    wrapper.vm.id = 9;
    wrapper.vm.userInfo.contribution = {
      recordings: 1,
      senses: 0,
      entries: 0,
      recordings_total: 4,
    };
    expect(wrapper.vm.worksPanelTitle).toBe('留下 1 段录音');
  });

  it('shows uploaded contribution totals on the owner profile', () => {
    globalThis.uni.getStorageSync = vi.fn((key) => (key === 'id' ? 9 : ''));
    const wrapper = mountForm(UserDetailsPage);
    wrapper.vm.id = 9;
    wrapper.vm.userInfo.contribution = {
      recordings: 1,
      senses: 0,
      entries: 0,
      recordings_total: 4,
    };
    expect(wrapper.vm.worksPanelTitle).toBe('留下 4 段录音');
  });

  it('gives visitors a next step when the public recording list is empty', () => {
    const wrapper = mountForm(UserDetailsPage);
    wrapper.vm.id = 9;
    wrapper.vm.userInfo.contribution = { recordings: 0, senses: 0, entries: 0 };
    wrapper.vm.worksTab = 'recordings';
    expect(wrapper.vm.worksPanelCopy).toContain('TA 还没有公开录音');
  });

  it('asks guests to login before sending a private mail', () => {
    const wrapper = mountForm(UserDetailsPage);
    wrapper.vm.id = 9;
    wrapper.vm.openMail();
    expect(goMailSend).not.toHaveBeenCalled();
    expect(goLogin).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({ title: '请先登录' });
  });

  it('opens mail send with the profile user id when logged in', () => {
    globalThis.uni.getStorageSync = vi.fn((key) => (key === 'token' ? 'token' : ''));
    const wrapper = mountForm(UserDetailsPage);
    wrapper.vm.id = 9;
    wrapper.vm.openMail();
    expect(goMailSend).toHaveBeenCalledWith(9);
    expect(goLogin).not.toHaveBeenCalled();
  });
});

describe('mine page logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    app.globalData.id = 7;
    globalThis.uni = {
      getStorageSync: vi.fn((key) => {
        if (key === 'token') return 'token';
        if (key === 'id') return 7;
        return '';
      }),
      showToast: vi.fn(),
      $on: vi.fn(),
      $off: vi.fn(),
      $emit: vi.fn(),
    };
  });

  it('refreshes the current theme summary when returning to the account page', async () => {
    const wrapper = mountForm(MePage);
    await flushPromises();
    const activeTheme = vi.spyOn(themeCenter, 'getActiveTheme').mockReturnValue({ name: '夜色' });
    try {
      wrapper.vm.$options.onShow.call(wrapper.vm);
      await flushPromises();
      const theme = wrapper.get('.account-settings').findAllComponents({ name: 'TCell' })[0];
      expect(theme.props('description')).toBe('当前主题：夜色');
    } finally {
      activeTheme.mockRestore();
    }
  });

  it('uses three TDesign cells for the guest destinations', async () => {
    app.globalData.id = null;
    globalThis.uni.getStorageSync = vi.fn(() => '');
    const wrapper = mountForm(MePage);
    await flushPromises();

    expect(wrapper.find('.guest-profile').exists()).toBe(true);
    const shortcuts = wrapper.get('.guest-shortcuts').findAllComponents({ name: 'TCell' });
    expect(shortcuts).toHaveLength(2);
    expect(shortcuts[0].props()).toMatchObject({
      title: '听乡音',
      description: '先逛逛',
      ariaLabel: '先去听乡音',
    });
    expect(shortcuts[1].props()).toMatchObject({
      title: '查词条',
      description: '找一找',
      ariaLabel: '先去查词条',
    });
    const theme = wrapper.get('.guest-theme').getComponent({ name: 'TCell' });
    expect(theme.props()).toMatchObject({
      title: '主题中心',
      note: '默认方言主题',
      ariaLabel: '打开主题中心，当前 默认方言主题',
    });

    await shortcuts[0].trigger('click');
    await shortcuts[1].trigger('click');
    await theme.trigger('click');
    expect(goHome).toHaveBeenCalledTimes(1);
    expect(goSearch).toHaveBeenCalledTimes(1);
    expect(goThemeCenter).toHaveBeenCalledTimes(1);
    app.globalData.id = 7;
  });

  it('uses a stable avatar fallback and keeps both avatar branches editable', async () => {
    getUserInfo.mockResolvedValueOnce({
      user: {
        id: 7,
        avatar: '',
        nickname: '采集者',
        username: 'collector',
        email: '',
        wechat: false,
      },
      contribution: { recordings_total: 0, entries_total: 0, senses_total: 0 },
      notification: { statistics: { unread: 0 } },
    });
    const wrapper = mountForm(MePage);
    await flushPromises();

    expect(wrapper.find('.avatar--fallback').text()).toBe('采');
    expect(wrapper.find('.avatar--image').exists()).toBe(false);
    await wrapper.find('.avatar--fallback').trigger('tap');
    expect(goUserInformation).toHaveBeenCalledTimes(1);

    wrapper.vm.nickname = '  ';
    wrapper.vm.username = 'collector';
    expect(wrapper.vm.avatarFallback).toBe('c');
    wrapper.vm.username = '  ';
    expect(wrapper.vm.avatarFallback).toBe('乡');

    wrapper.vm.avatar = '/avatar.png';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.avatar--fallback').exists()).toBe(false);
    expect(wrapper.find('.avatar--image').attributes('src')).toBe('/avatar.png');
    expect(wrapper.find('.avatar--image').attributes('mode')).toBe('aspectFill');
    await wrapper.find('.avatar--image').trigger('tap');
    expect(goUserInformation).toHaveBeenCalledTimes(2);
  });

  it('confirms before leaving the account', async () => {
    const wrapper = mountForm(MePage);
    await wrapper.vm.exit();
    expect(confirmDialog).toHaveBeenCalled();
    expect(clearUserInfo).toHaveBeenCalled();
    expect(goHome).toHaveBeenCalledWith(true);
  });

  it('hides WeChat bind on H5 when the account is not bound', async () => {
    const wrapper = mountForm(MePage);
    await flushPromises();
    expect(wrapper.vm.canUseWechatAuth).toBe(false);
    expect(wrapper.vm.showWechatMenu).toBe(false);
    expect(wrapper.get('.account-settings').text()).not.toContain('绑定微信');
    expect(bindingWechat).not.toHaveBeenCalled();
  });

  it('asks before binding WeChat when mini-program auth is available', async () => {
    const wrapper = mountForm(MePage);
    await flushPromises();
    wrapper.vm.canUseWechatAuth = true;
    wrapper.vm.wechatBound = false;
    await wrapper.vm.onWechatMenuTap();
    expect(confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: '绑定当前微信？',
    }));
    expect(bindingWechat).toHaveBeenCalledWith(7, false);
    expect(goUserInformation).toHaveBeenCalled();
  });

  it('disables the WeChat action while the binding request is in progress', async () => {
    const wrapper = mountForm(MePage);
    await flushPromises();
    await wrapper.setData({ canUseWechatAuth: true, isBinding: true });
    const action = wrapper.get('.account-settings').findAllComponents({ name: 'BaseButton' })
      .find((button) => button.props('text') === '绑定微信');

    expect(action.props()).toMatchObject({ disabled: true, loading: true });
    await action.trigger('click');
    expect(bindingWechat).not.toHaveBeenCalled();
    expect(confirmDialog).not.toHaveBeenCalled();
  });

  it('lets H5 unbind an already bound WeChat account', async () => {
    getUserInfo.mockResolvedValue({
      user: {
        id: 7,
        nickname: '采集者',
        username: 'collector',
        email: 'c@example.com',
        wechat: true,
      },
      contribution: { recordings_total: 0, senses_total: 0, entries_total: 0 },
      notification: { statistics: { unread: 0 } },
    });
    const wrapper = mountForm(MePage);
    await wrapper.vm.getInfo();
    expect(wrapper.vm.showWechatMenu).toBe(true);
    await wrapper.vm.onWechatMenuTap();
    expect(confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: '解绑微信？',
    }));
    expect(cancelBindingWechat).toHaveBeenCalledWith(7);
    expect(bindingWechat).not.toHaveBeenCalled();
  });

  it('sends users without email to bind email instead of unbinding WeChat', async () => {
    getUserInfo.mockResolvedValue({
      user: {
        id: 7,
        nickname: '采集者',
        username: 'collector',
        email: '',
        wechat: true,
      },
      contribution: { recordings_total: 0, entries_total: 0, senses_total: 0 },
      notification: { statistics: { unread: 0 } },
    });
    const wrapper = mountForm(MePage);
    await wrapper.vm.getInfo();
    await wrapper.vm.onWechatMenuTap();
    expect(confirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: '还不能解绑',
    }));
    expect(goUserEmail).toHaveBeenCalled();
    expect(cancelBindingWechat).not.toHaveBeenCalled();
  });

  it('does not treat a non-zero recording count as an empty works tab', async () => {
    const wrapper = mountForm(MePage);
    await flushPromises();
    wrapper.vm.recordingsCount = 3;
    expect(wrapper.vm.contributionMetrics[0]).toEqual({ label: '录音', value: 3 });
  });

  it('keeps profile stats read-only and one contribution entry surface', async () => {
    getUserInfo.mockResolvedValueOnce({
      user: {
        id: 7,
        avatar: '',
        nickname: '采集者',
        username: 'collector',
        email: '',
        wechat: false,
        followed_dialects: [{ id: 3, name: '莆仙方言' }],
      },
      contribution: {
        recordings_total: 12,
        entries_total: 5,
        senses_total: 8,
        evidence: 7,
      },
      notification: { statistics: { unread: 0 } },
    });
    const wrapper = mountForm(MePage);
    await flushPromises();

    expect(wrapper.findAll('.social-stat')).toHaveLength(3);
    expect(wrapper.find('.social-stat.pressable').exists()).toBe(false);
    expect(wrapper.find('.tool-grid').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('既有录音');
    expect(wrapper.text()).not.toContain('查看完整贡献履历');
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
    expect(wrapper.vm.contributionMetrics).toEqual([
      { label: '录音', value: 12 }, { label: '词条', value: 5 }, { label: '义项', value: 8 },
    ]);

    const archiveCells = wrapper.get('.archive-menu').findAllComponents({ name: 'TCell' });
    expect(archiveCells).toHaveLength(4);
    expect(archiveCells.slice(0, 2).map((cell) => cell.props('title'))).toEqual(['我的集盒', '录音草稿']);
    expect(archiveCells[2].props()).toMatchObject({
      title: '词条收藏',
      note: '仅自己可见',
    });
    expect(archiveCells[3].props()).toMatchObject({
      title: '关注方言',
      note: '1 个',
    });
    await archiveCells[2].trigger('click');
    await archiveCells[3].trigger('click');
    expect(goEntryBookmarks).toHaveBeenCalledTimes(1);
    expect(goCircleList).toHaveBeenCalledTimes(1);

    wrapper.vm.toContributionHistory();
    expect(goContributionHistory).toHaveBeenCalledTimes(1);
  });

  it('loads the archive from a stored id before App hydrates globalData', async () => {
    app.globalData.id = null;
    const wrapper = mountForm(MePage);
    await flushPromises();
    expect(getUserInfo).toHaveBeenCalledWith(7, true);
    expect(wrapper.vm.loading).toBe(false);
    app.globalData.id = 7;
  });

  it('clears loading when a token exists without a stored user id', async () => {
    app.globalData.id = null;
    globalThis.uni.getStorageSync = vi.fn((key) => (key === 'token' ? 'token' : ''));
    const wrapper = mountForm(MePage);
    await wrapper.vm.getInfo();
    expect(wrapper.vm.loading).toBe(false);
    expect(request.get).not.toHaveBeenCalled();
    app.globalData.id = 7;
  });
});
