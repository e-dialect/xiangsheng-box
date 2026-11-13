import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import BaseButton from '@/components/BaseButton.vue';
import ThemeShareSheet from '@/components/ThemeShareSheet.vue';
import { notifySuccess } from '@/services/feedback';
import { goMailSend } from '@/services/navigation';
import { trackThemeShare } from '@/services/themeAnalytics';
import { copyThemeShareLink } from '@/utils/themeShare';

vi.mock('@/services/feedback', () => ({
  notify: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('@/services/navigation', () => ({
  goMailSend: vi.fn(),
}));

vi.mock('@/services/themeAnalytics', () => ({
  trackThemeShare: vi.fn(),
}));

vi.mock('@/utils/themeShare', () => ({
  copyThemeShareLink: vi.fn((kind, item, success) => success()),
  saveThemePoster: vi.fn(async () => ({ ok: true })),
  themeShareCopy: vi.fn((item) => `分享 ${item.name}`),
}));

const target = {
  kind: 'theme',
  item: {
    id: 'snownook',
    name: '小雪窗格',
    preview: 'season',
  },
};

function buttonByName(wrapper, name) {
  return wrapper.findAllComponents(BaseButton)
    .find((button) => button.props('ariaLabel') === name);
}

describe('ThemeShareSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.uni = {
      $emit: vi.fn(),
      $on: vi.fn(),
      $off: vi.fn(),
      getStorageSync: vi.fn(() => ''),
    };
  });

  it('renders H5 share channels as one named BaseButton group', async () => {
    const wrapper = mount(ThemeShareSheet, {
      props: { target, isMiniProgram: false },
    });
    const channelNames = ['分享给好友', '分享到微信', '复制链接', '生成分享图片'];

    channelNames.forEach((name) => {
      expect(buttonByName(wrapper, name)?.props()).toMatchObject({
        block: true,
        shape: 'rectangle',
        size: 'medium',
        variant: 'ghost',
      });
    });
    expect(wrapper.find('.share-native').exists()).toBe(false);

    buttonByName(wrapper, '分享给好友').vm.$emit('click');
    expect(trackThemeShare).toHaveBeenCalledWith('theme', target.item, 'friend');
    expect(goMailSend).toHaveBeenCalledWith('', {
      title: '分享主题：小雪窗格',
      content: '分享 小雪窗格',
    });

    buttonByName(wrapper, '分享到微信').vm.$emit('click');
    buttonByName(wrapper, '复制链接').vm.$emit('click');
    expect(copyThemeShareLink).toHaveBeenNthCalledWith(1, 'theme', target.item, expect.any(Function));
    expect(copyThemeShareLink).toHaveBeenNthCalledWith(2, 'theme', target.item, expect.any(Function));
    expect(trackThemeShare).toHaveBeenCalledWith('theme', target.item, 'wechat');
    expect(trackThemeShare).toHaveBeenCalledWith('theme', target.item, 'copy_link');
    expect(notifySuccess).toHaveBeenCalledTimes(2);

    buttonByName(wrapper, '生成分享图片').vm.$emit('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.poster').exists()).toBe(true);
    expect(wrapper.text()).toContain('保存到相册');
  });

  it.each(['onCopy', 'onWechatH5'])('waits for clipboard success in %s', (method) => {
    let complete;
    copyThemeShareLink.mockImplementationOnce((kind, item, success) => { complete = success; });
    const wrapper = mount(ThemeShareSheet, { props: { target } });
    wrapper.vm[method]();
    expect(notifySuccess).not.toHaveBeenCalled();
    complete();
    expect(notifySuccess).toHaveBeenCalledOnce();
  });

  it('keeps the mini program share capability on the named design-system button', () => {
    const wrapper = mount(ThemeShareSheet, {
      props: { target, isMiniProgram: true },
    });
    const wechat = buttonByName(wrapper, '分享到微信');

    expect(buttonByName(wrapper, '复制链接')).toBeUndefined();
    expect(wechat.getComponent({ name: 'TDesignStub' }).props('openType')).toBe('share');
    expect(wechat.props()).toMatchObject({
      block: true,
      shape: 'rectangle',
      size: 'medium',
      variant: 'ghost',
    });
    wechat.vm.$emit('click');
    expect(trackThemeShare).toHaveBeenCalledWith('theme', target.item, 'mp_share');
  });

  it('resets poster state for a new target and keeps cancel explicit', async () => {
    const wrapper = mount(ThemeShareSheet, {
      props: { target, isMiniProgram: false },
    });
    buttonByName(wrapper, '生成分享图片').vm.$emit('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.poster').exists()).toBe(true);

    await wrapper.setProps({
      target: { ...target, item: { ...target.item, id: 'paper', name: '素白纸本' } },
    });
    expect(wrapper.find('.poster').exists()).toBe(false);
    wrapper.findAllComponents(BaseButton).at(-1).vm.$emit('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
