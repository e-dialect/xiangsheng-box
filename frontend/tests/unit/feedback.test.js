import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { mount } from '@vue/test-utils';

import FeedbackHost from '@/components/FeedbackHost.vue';

const feedback = await import('@/services/feedback');

describe('feedback service', () => {
  beforeEach(() => {
    feedback.resetLoading();
    global.uni = {
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      showToast: vi.fn(),
    };
  });

  it('centralizes loading presentation', () => {
    feedback.showLoading('上传中……');
    feedback.hideLoading();

    expect(uni.showLoading).toHaveBeenCalledWith({
      title: '上传中……',
      mask: false,
    });
    expect(uni.hideLoading).toHaveBeenCalled();
  });

  it('keeps one loading overlay until all concurrent work finishes', () => {
    feedback.showLoading('加载甲');
    feedback.showLoading('加载乙');
    feedback.hideLoading();

    expect(uni.showLoading).toHaveBeenCalledTimes(1);
    expect(uni.hideLoading).not.toHaveBeenCalled();

    feedback.hideLoading();
    expect(uni.hideLoading).toHaveBeenCalledTimes(1);
  });

  it('defers a native toast until the last loading overlay has closed', async () => {
    let finishClosing;
    uni.hideLoading.mockReturnValue(new Promise((resolve) => {
      finishClosing = resolve;
    }));

    feedback.showLoading('加载甲');
    feedback.showLoading('加载乙');
    feedback.hideLoading();
    feedback.notifyError({ message: '加载甲失败' });

    expect(uni.showToast).not.toHaveBeenCalled();
    feedback.hideLoading();
    expect(uni.hideLoading).toHaveBeenCalledTimes(1);
    expect(uni.showToast).not.toHaveBeenCalled();

    finishClosing();
    await Promise.resolve();
    expect(uni.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '加载甲失败',
      icon: 'error',
    }));
  });

  it('waits for overlapping close operations before flushing a native toast', async () => {
    const finishClosing = [];
    uni.hideLoading.mockImplementation(() => new Promise((resolve) => {
      finishClosing.push(resolve);
    }));

    feedback.showLoading('第一轮');
    feedback.hideLoading();
    feedback.showLoading('第二轮');
    feedback.hideLoading();
    feedback.notifyError({ message: '第二轮失败' });

    finishClosing[0]();
    await Promise.resolve();
    expect(uni.showToast).not.toHaveBeenCalled();

    finishClosing[1]();
    await Promise.resolve();
    expect(uni.showToast).toHaveBeenCalledTimes(1);
  });

  it('maps API errors to user-facing messages', () => {
    feedback.notifyError({ statusCode: 403 });

    expect(uni.showToast).toHaveBeenCalledWith({
      title: '没有权限！',
      icon: 'error',
      duration: 2000,
      mask: false,
    });
  });

  it('keeps long toast text inside platform limits', () => {
    feedback.notify({ title: '这是一段非常非常非常非常非常非常长的错误信息' });

    expect(uni.showToast.mock.calls[0][0].title.length).toBeLessThanOrEqual(32);
  });

  it('uses an active TDesign host before native fallbacks', async () => {
    const host = {
      confirm: vi.fn(() => Promise.resolve(true)),
      showToast: vi.fn(() => true),
    };
    feedback.registerFeedbackHost(host);

    feedback.notifySuccess('保存成功');
    await expect(feedback.confirm({ title: '继续吗？' })).resolves.toBe(true);

    expect(host.showToast).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success',
      title: '保存成功',
    }));
    expect(host.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '继续吗？' }));
    expect(uni.showToast).not.toHaveBeenCalled();
    feedback.unregisterFeedbackHost(host);
  });

  it('drives TDesign toast, message and dialog instances from the shared host', async () => {
    const wrapper = mount(FeedbackHost);
    wrapper.vm.$refs.toast.show = vi.fn();
    wrapper.vm.$refs.message.setMessage = vi.fn();

    expect(wrapper.vm.showToast({ title: '保存成功', icon: 'success' })).toBe(true);
    expect(wrapper.vm.showMessage({ content: '已同步', theme: 'info' })).toBe(true);
    expect(wrapper.vm.$refs.toast.show).toHaveBeenCalledWith(expect.objectContaining({
      message: '保存成功',
      theme: 'success',
    }));
    expect(wrapper.vm.$refs.message.setMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: '已同步',
    }), 'info');

    const confirmation = wrapper.vm.confirm({
      title: '删除？',
      content: '删除后无法恢复',
      confirmText: '删除',
      cancelText: '取消',
      danger: true,
    });
    wrapper.vm.resolveDialog(true);
    await expect(confirmation).resolves.toBe(true);
    wrapper.unmount();
  });

  it('cancels an owned confirmation and removes its sensitive text on session cleanup', async () => {
    const wrapper = mount(FeedbackHost);
    const owner = {};
    const pending = feedback.confirm({ owner, title: '范围修正', content: '仅供 A 读取的依据及理由' });
    expect(wrapper.vm.dialog.visible).toBe(true);
    feedback.cancelConfirmation(owner);
    await expect(pending).resolves.toBe(false);
    expect(wrapper.vm.dialog.visible).toBe(false);
    expect(wrapper.vm.dialog.content).toBe('');
    expect(wrapper.vm.dialog.title).toBe('');
    wrapper.unmount();
  });

  it('does not fall back to an uncancellable native modal for a sensitive owned confirmation', async () => {
    await expect(feedback.confirm({ owner: {}, content: '私有依据' })).resolves.toBe(false);
  });
});
