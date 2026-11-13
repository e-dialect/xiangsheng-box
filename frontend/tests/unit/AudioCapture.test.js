import { mount } from '@vue/test-utils';
import {
  afterEach, beforeEach, describe, expect, it, vi,
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

const wrappers = [];

function mountCapture(audio = {}) {
  const wrapper = mount(AudioCapture, {
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
  wrappers.push(wrapper);
  return wrapper;
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function mockMicrophone(getUserMedia) {
  const recorders = [];
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', vi.fn(function Recorder(stream) {
    this.stream = stream;
    this.start = vi.fn();
    this.stop = vi.fn();
    this.mimeType = 'audio/webm';
    recorders.push(this);
  }));
  vi.stubGlobal('URL', class extends globalThis.URL {
    static createObjectURL = vi.fn(() => 'blob:recording');
  });
  return recorders;
}

function microphoneStream() {
  const stop = vi.fn();
  return { getTracks: () => [{ stop }], stop };
}

describe('AudioCapture', () => {
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => { if (wrapper.exists()) wrapper.unmount(); });
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not request a second microphone while authorization is pending', async () => {
    const permission = deferred();
    const getUserMedia = vi.fn(() => permission.promise);
    const recorders = mockMicrophone(getUserMedia);
    const wrapper = mountCapture();
    const first = wrapper.vm.startRecord();
    const second = wrapper.vm.startRecord();
    permission.resolve(microphoneStream());
    await Promise.all([first, second]);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(recorders).toHaveLength(1);
    expect(wrapper.vm.recording).toBe(true);
  });

  it('releases a microphone granted after leaving without starting or emitting', async () => {
    const permission = deferred();
    const recorders = mockMicrophone(vi.fn(() => permission.promise));
    const stream = microphoneStream();
    const wrapper = mountCapture();
    const start = wrapper.vm.startRecord();
    wrapper.unmount();
    permission.resolve(stream);
    await start;
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(recorders).toHaveLength(0);
    expect(wrapper.emitted('change')).toBeUndefined();
    expect(wrapper.vm.stopTimer).toBeNull();
  });

  it('cancels pending microphone authorization when choosing an existing recording', async () => {
    const permission = deferred();
    const recorders = mockMicrophone(vi.fn(() => permission.promise));
    const stream = microphoneStream();
    chooseAudioFile.mockResolvedValue({ path: '/voice.m4a' });
    const wrapper = mountCapture();
    const start = wrapper.vm.startRecord();
    await wrapper.vm.chooseFile();
    permission.resolve(stream);
    await start;
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(recorders).toHaveLength(0);
    expect(wrapper.vm.recording).toBe(false);
    expect(wrapper.emitted('change')).toHaveLength(1);
    expect(wrapper.emitted('change')[0][0].path).toBe('/voice.m4a');
  });

  it('keeps a stale stop callback from reading or stopping the next microphone', async () => {
    vi.useFakeTimers();
    const firstStream = microphoneStream();
    const secondStream = microphoneStream();
    const recorders = mockMicrophone(vi.fn()
      .mockResolvedValueOnce(firstStream).mockResolvedValueOnce(secondStream));
    const wrapper = mountCapture();
    await wrapper.vm.startRecord();
    vi.advanceTimersByTime(1500);
    wrapper.vm.stopRecord();
    await wrapper.vm.startRecord();
    recorders[0].ondataavailable({ data: new Blob(['old']) });
    recorders[0].onstop();
    expect(firstStream.stop).toHaveBeenCalledTimes(1);
    expect(secondStream.stop).not.toHaveBeenCalled();
    expect(wrapper.vm.recording).toBe(true);
    expect(wrapper.emitted('change')).toBeUndefined();
    vi.advanceTimersByTime(1500);
    recorders[1].ondataavailable({ data: new Blob(['new']) });
    wrapper.vm.stopRecord();
    recorders[1].onstop();
    expect(wrapper.emitted('change')).toHaveLength(1);
    expect(wrapper.emitted('change')[0][0].blob.size).toBe(3);
    expect(secondStream.stop).toHaveBeenCalledTimes(1);
  });

  it('ignores stop callbacks after unmount and releases an active stream only once', async () => {
    const stream = microphoneStream();
    const recorders = mockMicrophone(vi.fn().mockResolvedValue(stream));
    const wrapper = mountCapture();
    await wrapper.vm.startRecord();
    wrapper.unmount();
    recorders[0].ondataavailable({ data: new Blob(['late']) });
    recorders[0].onstop();
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.stream).toBeNull();
    expect(wrapper.emitted('change')).toBeUndefined();
    expect(wrapper.emitted('error')).toBeUndefined();
  });

  it('releases the microphone if constructing the browser recorder fails', async () => {
    const stream = microphoneStream();
    mockMicrophone(vi.fn().mockResolvedValue(stream));
    MediaRecorder.mockImplementation(() => { throw new Error('unsupported recorder'); });
    const wrapper = mountCapture();
    await wrapper.vm.startRecord();
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.recording).toBe(false);
    expect(wrapper.emitted('error')).toHaveLength(1);
  });

  it('releases the microphone if starting the browser recorder fails', async () => {
    const stream = microphoneStream();
    const recorders = mockMicrophone(vi.fn().mockResolvedValue(stream));
    const wrapper = mountCapture();
    const prepare = wrapper.vm.prepareH5Recorder;
    vi.spyOn(wrapper.vm, 'prepareH5Recorder').mockImplementation(async (...args) => {
      const ready = await prepare(...args);
      recorders[0].start.mockImplementation(() => { throw new Error('start failed'); });
      return ready;
    });
    await wrapper.vm.startRecord();
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.stopTimer).toBeNull();
    expect(wrapper.emitted('error')).toHaveLength(1);
  });

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
