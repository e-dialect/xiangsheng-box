import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeShareSheet from '@/components/ThemeShareSheet.vue';
import { notifySuccess } from '@/services/feedback';
import { copyThemeShareLink, themeShareUrl } from '@/utils/themeShare';

vi.mock('@/services/feedback', () => ({ notify: vi.fn(), notifySuccess: vi.fn() }));
vi.mock('@/services/themeAnalytics', () => ({ trackThemeShare: vi.fn() }));

describe('theme share clipboard integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.uni = {
      $emit: vi.fn(), $on: vi.fn(), $off: vi.fn(),
      getStorageSync: vi.fn(() => ''), showToast: vi.fn(), setClipboardData: vi.fn(),
    };
  });
  describe.each(['theme', 'dress'])('%s target', (kind) => {
    const target = { kind, item: { id: 'paper', name: '素白纸本', group: 'avatar' } };
    it.each(['onCopy', 'onWechatH5'])('%s waits, fails without success and retries once', (method) => {
      let callbacks;
      uni.setClipboardData.mockImplementation((options) => { callbacks = options; });
      const wrapper = mount(ThemeShareSheet, { props: { target } });
      wrapper.vm[method]();
      expect(callbacks.data).toBe(themeShareUrl(kind, target.item));
      expect(notifySuccess).not.toHaveBeenCalled();
      expect(uni.showToast).not.toHaveBeenCalled();
      callbacks.fail();
      expect(notifySuccess).not.toHaveBeenCalled();
      expect(uni.showToast).toHaveBeenCalledTimes(1);
      expect(uni.showToast).toHaveBeenCalledWith({ title: '复制失败', icon: 'none' });
      wrapper.vm[method]();
      expect(notifySuccess).not.toHaveBeenCalled();
      callbacks.success();
      expect(notifySuccess).toHaveBeenCalledTimes(1);
      expect(notifySuccess).toHaveBeenCalledWith('链接已复制');
      expect(uni.showToast).toHaveBeenCalledTimes(1);
      wrapper.unmount();
    });
    it('retains immediate URL return without announcing pending success', () => {
      expect(copyThemeShareLink(kind, target.item)).toBe(themeShareUrl(kind, target.item));
      expect(uni.showToast).not.toHaveBeenCalled();
    });
  });
});
