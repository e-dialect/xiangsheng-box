import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

vi.mock('@/services/feedback', () => ({ notify: vi.fn() }));
import { notify } from '@/services/feedback';
import AudioCapture from '@/components/AudioCapture.vue';
import { chooseAudioFile } from '@/services/file';
import { playAudio, playManaged, stopAudio } from '@/utils/audio';

vi.mock('@/services/file', () => ({
  chooseAudioFile: vi.fn(),
  supportsAudioFileSelection: vi.fn(() => true),
}));
vi.mock('@/utils/audio', () => ({
  playAudio: vi.fn(),
  playManaged: vi.fn(),
  stopAudio: vi.fn(),
}));

function mountCapture(audio = {}) {
  return mount(AudioCapture, {
    props: {
      audio: {
        path: '',
        name: '',
        durationMs: 0,
        origin: '',
        ...audio,
      },
    },
  });
}

describe('AudioCapture', () => {
  it('allows recording again after H5 microphone authorization fails', async () => {
    const wrapper = mountCapture();
    wrapper.vm.supported = true;
    wrapper.vm.recordingSupported = true;
    const recorder = { start: vi.fn(), stop: vi.fn() };
    vi.spyOn(wrapper.vm, 'prepareH5Recorder')
      .mockRejectedValueOnce(new Error('Permission denied'))
      .mockImplementationOnce(async () => { wrapper.vm.recorder = recorder; return true; });

    await wrapper.vm.startRecord();
    expect(wrapper.emitted('error')).toHaveLength(1);
    expect(wrapper.vm.recording).toBe(false);
    expect(wrapper.vm.stopTimer).toBeNull();
    await wrapper.vm.startRecord();
    expect(wrapper.vm.recording).toBe(true);
    // Vitest retains both uni-app platform branches; production builds select one.
    expect(recorder.start).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('recovers after a mini-program recorder error and accepts the next recording', async () => {
    let onStop;
    let onError;
    const recorder = {
      start: vi.fn(), stop: vi.fn(),
      onStop: vi.fn((callback) => { onStop = callback; }),
      onError: vi.fn((callback) => { onError = callback; }),
    };
    uni.getRecorderManager = () => recorder;
    const wrapper = mountCapture();
    wrapper.vm.recordingSupported = true;
    await wrapper.vm.startRecord();
    onError({ errMsg: 'auth deny' });
    expect(wrapper.vm.recording).toBe(false);
    expect(wrapper.vm.stopTimer).toBeNull();
    expect(wrapper.emitted('error')).toHaveLength(1);

    await wrapper.vm.startRecord();
    onStop({ tempFilePath: 'wxfile://record.mp3', duration: 2000 });
    expect(wrapper.emitted('change')[0][0]).toMatchObject({
      path: 'wxfile://record.mp3', durationMs: 2000, invalid: false, available: true,
    });
    wrapper.unmount();
  });


  it('blocks replacement controls and ignores a file selection opened before locking', async () => {
    let resolve;
    chooseAudioFile.mockReturnValue(new Promise((done) => { resolve = done; }));
    const wrapper = mountCapture({ path: 'blob:A' });
    const pending = wrapper.vm.chooseFile();
    await wrapper.setProps({ disabled: true });
    wrapper.vm.clearAudio();
    wrapper.vm.restartRecording();
    await wrapper.vm.chooseFile();
    expect(chooseAudioFile).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('clear')).toBeUndefined();
    await wrapper.setProps({ disabled: false });
    resolve({ path: 'blob:B' });
    await pending;
    expect(wrapper.emitted('change')).toBeUndefined();
    wrapper.unmount();
  });


  it('suppresses stale file selection errors after submission invalidates the picker', async () => {
    let reject;
    chooseAudioFile.mockReturnValue(new Promise((resolve, fail) => { reject = fail; }));
    const wrapper = mountCapture({ path: 'blob:A' });
    const pending = wrapper.vm.chooseFile();
    await wrapper.setProps({ disabled: true });
    await wrapper.setProps({ disabled: false });
    reject(new Error('stale picker'));
    await pending;
    expect(notify).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    playManaged.mockReturnValue({ destroy: vi.fn() });
    globalThis.uni = { showToast: vi.fn() };
  });

  it('rejects recordings shorter than one second', () => {
    const wrapper = mountCapture();

    wrapper.vm.onRecordStop('blob:short', 999);

    expect(wrapper.emitted('change')).toBeUndefined();
    expect(notify).toHaveBeenCalledWith({
      title: '录音太短了，再试一次吧',
      icon: 'none',
    });
  });

  it('automatically stops at fifteen seconds', async () => {
    vi.useFakeTimers();
    const wrapper = mountCapture();
    const recorder = { start: vi.fn(), stop: vi.fn() };
    wrapper.vm.recorderManager = recorder;
    wrapper.vm.recordingSupported = true;

    await wrapper.vm.startRecord();
    vi.advanceTimersByTime(15000);

    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({
      title: '已自动截取前15秒',
      icon: 'none',
    });
    vi.useRealTimers();
  });

  it('previews, clears, and replaces a local audio file', async () => {
    chooseAudioFile.mockResolvedValue({
      path: '/tmp/voice.m4a',
      name: 'voice.m4a',
    });
    const wrapper = mountCapture({ path: '/tmp/old.mp3', name: 'old.mp3' });

    wrapper.vm.previewAudio();
    wrapper.vm.clearAudio();
    await wrapper.vm.chooseFile();

    expect(playAudio).toHaveBeenCalledWith('/tmp/old.mp3');
    expect(wrapper.emitted('clear')).toHaveLength(1);
    expect(wrapper.emitted('change')[0][0]).toMatchObject({
      path: '/tmp/voice.m4a',
      name: 'voice.m4a',
      origin: 'upload',
    });
  });

  it('plays and pauses a completed recording', () => {
    const wrapper = mountCapture({
      path: '/tmp/voice.mp3',
      name: 'voice.mp3',
      durationMs: 3200,
    });

    wrapper.vm.togglePlayback();

    expect(playManaged).toHaveBeenCalledWith(
      '/tmp/voice.mp3',
      expect.objectContaining({
        onEnded: expect.any(Function),
        onTimeUpdate: expect.any(Function),
      }),
    );
    expect(wrapper.vm.playing).toBe(true);

    wrapper.vm.togglePlayback();

    expect(stopAudio).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.playing).toBe(false);
  });

  it('offers playback and starts a fresh recording from the ready state', async () => {
    const wrapper = mountCapture({
      path: '/tmp/voice.mp3',
      name: 'voice.mp3',
      durationMs: 3200,
    });
    wrapper.vm.startRecord = vi.fn();

    expect(wrapper.text()).toContain('重新录制');
    expect(wrapper.text()).toContain('播放录音');

    wrapper.vm.restartRecording();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('clear')).toHaveLength(1);
    expect(wrapper.vm.startRecord).toHaveBeenCalledTimes(1);
  });
});
