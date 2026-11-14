import { flushPromises, mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import { playManaged, stopAudio, onExternalStop } from '@/utils/audio';
import { listAllDialects } from '@/services/guantou';
import { loadDialectSample, saveDialectProfile } from '@/services/dialectOnboarding';
import { resumeInterruptedPageAfterLogin } from '@/services/login';
import { toFollowRecommendations } from '@/routers/user';

vi.mock('@/services/guantou', () => ({
  listAllDialects: vi.fn(),
}));

vi.mock('@/services/dialectOnboarding', () => ({
  loadDialectSample: vi.fn(),
  normalizeOnboardingReason: vi.fn((reason) => reason || 'missing_dialect'),
  ONBOARDING_REASONS: {
    MISSING_DIALECT: 'missing_dialect',
    NEW_USER: 'new_user',
  },
  saveDialectProfile: vi.fn(),
}));

vi.mock('@/services/login', () => ({
  resumeInterruptedPageAfterLogin: vi.fn(() => false),
}));

vi.mock('@/services/user', () => ({
  clearUserInfo: vi.fn(),
}));

vi.mock('@/routers/user', () => ({
  toFollowRecommendations: vi.fn(),
}));

vi.mock('@/utils/audio', () => ({
  playManaged: vi.fn(),
  stopAudio: vi.fn(),
  onExternalStop: vi.fn(),
}));

globalThis.getApp = vi.fn(() => ({
  globalData: {
    userInfo: {
      id: 7, username: 'collector', nickname: '采集者', primary_dialect: null,
    },
  },
}));

const { default: DialectOnboardingPage } = await import('@/pages/users/onboarding.vue');

function mountPage() {
  return mount(DialectOnboardingPage, {
    global: {
      stubs: {
        PageShell: {
          template: '<main><slot /></main>',
        },
        'scroll-view': { template: '<div><slot /></div>' },
      },
    },
  });
}

describe('dialect onboarding page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onExternalStop.mockReturnValue(vi.fn());
    playManaged.mockImplementation(() => ({ destroy: vi.fn() }));
    globalThis.uni = {
      getStorageSync: vi.fn((key) => (key === 'id' ? 7 : '')),
      reLaunch: vi.fn(),
      showToast: vi.fn(),
    };
    listAllDialects.mockResolvedValue([
      {
        id: 3, name: '四川话', qualified_code: '西南官话.四川', depth: 1,
      },
    ]);
    loadDialectSample.mockResolvedValue({
      id: 8,
      audio_url: 'can.mp3',
      concept_text: '舒服',
      duration_ms: 3200,
    });
    saveDialectProfile.mockResolvedValue({
      id: 7,
      nickname: '采集者',
      primary_dialect: { id: 3 },
    });
  });

  it('requires a nickname and primary dialect before saving', async () => {
    const wrapper = mountPage();
    wrapper.vm.nickname = '';
    wrapper.vm.next();
    expect(wrapper.vm.error).toBe('请输入昵称');

    wrapper.vm.nickname = '采集者';
    wrapper.vm.next();
    expect(wrapper.vm.step).toBe(2);
    await wrapper.vm.finish();
    expect(wrapper.vm.error).toBe('请选择主方言');
    expect(saveDialectProfile).not.toHaveBeenCalled();
  });

  it('continues the four-step identity journey for new accounts', async () => {
    const wrapper = mountPage();
    wrapper.vm.reason = 'new_user';

    expect(wrapper.vm.journeyStep).toBe(3);
    expect(wrapper.vm.journeyTotal).toBe(4);
    expect(wrapper.vm.journeyStepLabel).toBe('设置称呼');

    wrapper.vm.next();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.journeyStep).toBe(4);
    expect(wrapper.vm.journeyStepLabel).toBe('选择主方言');
  });

  it('loads a real sample and preserves interrupted navigation for new users', async () => {
    resumeInterruptedPageAfterLogin.mockReturnValueOnce(true);
    const wrapper = mountPage();
    await wrapper.vm.$options.onLoad.call(wrapper.vm, { reason: 'new_user' });
    await flushPromises();
    wrapper.vm.next();
    await wrapper.vm.selectDialect(wrapper.vm.dialects[0]);
    await wrapper.vm.finish();

    expect(loadDialectSample).toHaveBeenCalledWith(3);
    expect(saveDialectProfile).toHaveBeenCalledWith(7, {
      nickname: '采集者',
      primaryDialectId: 3,
    });
    expect(resumeInterruptedPageAfterLogin).toHaveBeenCalledWith(7);
    expect(toFollowRecommendations).not.toHaveBeenCalled();
  });

  it('keeps the resume flow for existing users picking a missing dialect', async () => {
    const wrapper = mountPage();
    await wrapper.vm.$options.onLoad.call(wrapper.vm, { reason: 'missing_dialect' });
    await flushPromises();
    wrapper.vm.next();
    await wrapper.vm.selectDialect(wrapper.vm.dialects[0]);
    await wrapper.vm.finish();

    expect(saveDialectProfile).toHaveBeenCalledWith(7, {
      nickname: '采集者',
      primaryDialectId: 3,
    });
    expect(resumeInterruptedPageAfterLogin).toHaveBeenCalledWith(7);
    expect(toFollowRecommendations).toHaveBeenCalledWith(true);
  });

  it.each(['abandon', 'onHide', 'onUnload', 'beforeUnmount'])(
    'does not complete an old save after %s',
    async (action) => {
      let resolveSave;
      saveDialectProfile.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
      const wrapper = mountPage();
      wrapper.vm.selectedDialectId = 3;
      const saving = wrapper.vm.finish();
      if (action === 'abandon') wrapper.vm.abandon();
      else wrapper.vm.$options[action].call(wrapper.vm);
      // Returning must not make the abandoned continuation current again.
      wrapper.vm.$options.onShow.call(wrapper.vm);
      resolveSave({ id: 7 });
      await saving;
      expect(resumeInterruptedPageAfterLogin).not.toHaveBeenCalled();
      expect(toFollowRecommendations).not.toHaveBeenCalled();
      expect(uni.showToast).not.toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
      expect(wrapper.vm.saving).toBe(false);
      wrapper.unmount();
    },
  );

  it('ignores a service-cancelled save and prevents duplicate pending saves', async () => {
    let resolveSave;
    saveDialectProfile.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const wrapper = mountPage();
    wrapper.vm.selectedDialectId = 3;
    const saving = wrapper.vm.finish();
    await wrapper.vm.finish();
    expect(saveDialectProfile).toHaveBeenCalledOnce();
    resolveSave(null);
    await saving;
    expect(resumeInterruptedPageAfterLogin).not.toHaveBeenCalled();
    expect(toFollowRecommendations).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('shows the save failure in place and allows a successful retry', async () => {
    saveDialectProfile.mockRejectedValueOnce(new Error('网络暂时中断'));
    const wrapper = mountPage();
    wrapper.vm.step = 2;
    wrapper.vm.selectedDialectId = 3;
    await wrapper.vm.finish();
    expect(wrapper.vm.error).toBe('网络暂时中断');
    expect(wrapper.vm.saving).toBe(false);
    expect(toFollowRecommendations).not.toHaveBeenCalled();
    await wrapper.vm.finish();
    expect(wrapper.vm.error).toBe('');
    expect(toFollowRecommendations).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('does not show a late failure after leaving', async () => {
    let rejectSave;
    saveDialectProfile.mockReturnValueOnce(new Promise((resolve, reject) => {
      rejectSave = reject;
    }));
    const wrapper = mountPage();
    wrapper.vm.selectedDialectId = 3;
    const saving = wrapper.vm.finish();
    wrapper.vm.abandon();
    rejectSave(new Error('旧请求失败'));
    await saving;
    expect(wrapper.vm.error).toBe('');
    expect(toFollowRecommendations).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('offers a retry when the dialect tree fails to load', async () => {
    listAllDialects.mockRejectedValueOnce(new Error('network down'));
    const wrapper = mountPage();
    await wrapper.vm.$options.onLoad.call(wrapper.vm, {});
    await flushPromises();

    expect(wrapper.vm.dialectsError).toBe(true);

    wrapper.vm.step = 2;
    await flushPromises();
    expect(wrapper.text()).toContain('方言树加载失败');
    expect(wrapper.text()).not.toContain('西南官话.四川');

    await wrapper.vm.loadDialects();
    await flushPromises();

    expect(wrapper.vm.dialectsError).toBe(false);
    expect(wrapper.text()).toContain('逐级选择主方言');
    expect(wrapper.text()).not.toContain('西南官话.四川');
  });
});

describe('onboarding sample ownership', () => {
  let externalStop;
  let handles;
  let wrapper;
  beforeEach(() => {
    vi.clearAllMocks();
    handles = [];
    globalThis.uni = {
      getStorageSync: vi.fn(() => 7), showToast: vi.fn(), reLaunch: vi.fn(),
    };
    onExternalStop.mockImplementation((listener) => {
      externalStop = listener;
      return vi.fn();
    });
    playManaged.mockImplementation((src, callbacks) => {
      const handle = { src, callbacks, destroy: vi.fn() };
      handle.destroyOriginal = handle.destroy;
      handles.push(handle);
      return handle;
    });
    loadDialectSample.mockResolvedValue({ id: 2, audio_url: 'b.mp3' });
    saveDialectProfile.mockResolvedValue({ id: 7 });
    wrapper = mountPage();
    wrapper.vm.step = 2;
    wrapper.vm.selectedDialectId = 1;
    wrapper.vm.sample = { id: 1, audio_url: 'a.mp3' };
  });

  it('stops A immediately when selecting B, including failed sample loading', async () => {
    wrapper.vm.playSample();
    loadDialectSample.mockRejectedValueOnce(new Error('offline'));
    const pending = wrapper.vm.selectDialect({ id: 2 });
    expect(stopAudio).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.sample).toBeNull();
    await pending;
    expect(wrapper.vm.selectedDialectId).toBe(2);
    expect(wrapper.vm.sample).toBeNull();
  });

  it.each(['onHide', 'onUnload', 'beforeUnmount'])('releases owned audio on %s once', async (hook) => {
    wrapper.vm.playSample();
    wrapper.vm.$options[hook].call(wrapper.vm);
    if (hook === 'beforeUnmount') expect(onExternalStop.mock.results.at(-1).value).toHaveBeenCalledTimes(1);
    wrapper.vm.$options[hook].call(wrapper.vm);
    expect(stopAudio).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.samplePlayback).toBeNull();
    wrapper.vm.playSample();
    expect(playManaged).toHaveBeenCalledTimes(1);
  });

  it.each(['previous', 'finish', 'abandon'])('stops audio on %s', async (action) => {
    wrapper.vm.playSample();
    await wrapper.vm[action]();
    expect(stopAudio).toHaveBeenCalledTimes(1);
    if (action === 'previous') expect(wrapper.vm.step).toBe(1);
  });

  it('does not stop another page after external replacement or emit late failures', () => {
    wrapper.vm.playSample();
    externalStop(handles[0]);
    wrapper.vm.$options.onHide.call(wrapper.vm);
    handles[0].callbacks.onError(new Error('late'));
    expect(stopAudio).not.toHaveBeenCalled();
    expect(uni.showToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: '播放失败' }));
  });

  it('replaces repeated playback and ignores old terminal callbacks', () => {
    wrapper.vm.playSample();
    wrapper.vm.playSample();
    handles[0].callbacks.onEnded();
    handles[0].callbacks.onError(new Error('late'));
    expect(wrapper.vm.samplePlayback.handle).toBe(handles[1]);
    expect(stopAudio).toHaveBeenCalledTimes(1);
    handles[1].callbacks.onEnded();
    expect(wrapper.vm.samplePlayback).toBeNull();
    expect(handles[1].destroyOriginal).toHaveBeenCalledTimes(1);
    wrapper.vm.$options.onUnload.call(wrapper.vm);
    expect(stopAudio).toHaveBeenCalledTimes(1);
  });

  it('ignores pending samples after leaving and reloads on return', async () => {
    let resolve;
    loadDialectSample.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const pending = wrapper.vm.loadSample(1);
    wrapper.vm.$options.onHide.call(wrapper.vm);
    resolve({ id: 1, audio_url: 'late.mp3' });
    await pending;
    expect(wrapper.vm.sample).toBeNull();
    expect(wrapper.vm.loadingSample).toBe(false);
    wrapper.vm.$options.onShow.call(wrapper.vm);
    await flushPromises();
    expect(wrapper.vm.sample.audio_url).toBe('b.mp3');
  });

  it('keeps invalid, start and failure feedback and permits retry', () => {
    wrapper.vm.sample.audio_url = 'null';
    wrapper.vm.playSample();
    expect(uni.showToast).toHaveBeenCalledWith({ title: '不是一个可用文件', icon: 'error' });
    expect(playManaged).not.toHaveBeenCalled();
    wrapper.vm.sample.audio_url = 'a.mp3';
    wrapper.vm.playSample();
    expect(uni.showToast).toHaveBeenCalledWith({ title: '正在播放...', icon: 'none' });
    handles[0].callbacks.onError(new Error('failed'));
    expect(uni.showToast).toHaveBeenCalledWith({ title: '播放失败', icon: 'none' });
    expect(wrapper.vm.samplePlayback).toBeNull();
    wrapper.vm.playSample();
    expect(playManaged).toHaveBeenCalledTimes(2);
  });

  it('clears ownership after synchronous creation failure', () => {
    playManaged.mockImplementationOnce(() => { throw new Error('cannot start'); });
    wrapper.vm.playSample();
    expect(wrapper.vm.samplePlayback).toBeNull();
    expect(uni.showToast).toHaveBeenCalledWith({ title: '播放失败', icon: 'none' });
    wrapper.vm.playSample();
    expect(playManaged).toHaveBeenCalledTimes(2);
  });
});
