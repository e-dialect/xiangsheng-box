import { mount } from '@vue/test-utils';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { notify } from '@/services/feedback';
import AudioCapture from '@/components/AudioCapture.vue';
import { chooseAudioFile } from '@/services/file';
import { playAudio, playManaged, stopAudio } from '@/utils/audio';

vi.mock('@/services/feedback', () => ({ notify: vi.fn() }));

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

function mountNativeCapture() {
  let stopped;
  let failed;
  const recorder = {
    start: vi.fn(),
    stop: vi.fn(),
    onStop: vi.fn((callback) => { stopped = callback; }),
    onError: vi.fn((callback) => { failed = callback; }),
  };
  uni.getRecorderManager = () => recorder;
  const wrapper = mountCapture();
  wrapper.vm.recordingSupported = true;
  return {
    wrapper,
    recorder,
    stop: () => stopped({ tempFilePath: 'wxfile://record.mp3', duration: 2000 }),
    fail: () => failed({ errMsg: 'recording interrupted' }),
  };
}

describe('AudioCapture', () => {
  it('waits for native stop before accepting a fresh recording and ignores duplicate stop', async () => {
    const { wrapper, recorder, stop } = mountNativeCapture();
    await wrapper.vm.startRecord();
    wrapper.vm.stopRecord();
    wrapper.vm.stopRecord();
    await wrapper.vm.startRecord();
    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    stop();
    stop();
    expect(wrapper.emitted('change')).toHaveLength(1);
    await wrapper.vm.startRecord();
    expect(recorder.start).toHaveBeenCalledTimes(2);
    stop();
    expect(wrapper.emitted('change')).toHaveLength(2);
    expect(wrapper.vm.recording).toBe(false);
    expect(wrapper.vm.stopTimer).toBeNull();
  });

  it('discards pending native stop even when file selection is cancelled', async () => {
    const { wrapper, recorder, stop } = mountNativeCapture();
    chooseAudioFile.mockResolvedValue(null);
    await wrapper.vm.startRecord();
    wrapper.vm.stopRecord();
    await wrapper.vm.chooseFile();
    stop();
    expect(wrapper.emitted('change')).toBeUndefined();
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    await wrapper.vm.startRecord();
    stop();
    expect(wrapper.emitted('change')).toHaveLength(1);
  });

  it('blocks recording and duplicate selection until the native file chooser settles', async () => {
    const { wrapper, recorder, stop } = mountNativeCapture();
    const selection = deferred();
    chooseAudioFile.mockReturnValue(selection.promise);
    await wrapper.vm.startRecord();
    const pending = wrapper.vm.chooseFile();
    stop();
    await wrapper.vm.chooseFile();
    await wrapper.vm.startRecord();
    expect(chooseAudioFile).toHaveBeenCalledTimes(1);
    expect(recorder.start).toHaveBeenCalledTimes(1);
    selection.resolve({ path: 'wxfile://chosen.mp3' });
    await pending;
    expect(wrapper.emitted('change')).toHaveLength(1);
    expect(wrapper.vm.selectingFile).toBe(false);
  });

  it('does not accept a late native recording or selected file after disposal', async () => {
    const { wrapper, recorder, stop } = mountNativeCapture();
    const selection = deferred();
    chooseAudioFile.mockReturnValue(selection.promise);
    await wrapper.vm.startRecord();
    const pending = wrapper.vm.chooseFile();
    wrapper.unmount();
    stop();
    selection.resolve({ path: 'wxfile://chosen.mp3' });
    await pending;
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('discards synchronous native cancellation and clears errors without overwriting selection', async () => {
    const {
      wrapper, recorder, stop, fail,
    } = mountNativeCapture();
    recorder.stop.mockImplementationOnce(stop);
    chooseAudioFile.mockResolvedValue({ path: 'wxfile://chosen.mp3' });
    await wrapper.vm.startRecord();
    await wrapper.vm.chooseFile();
    expect(wrapper.emitted('change')).toHaveLength(1);
    await wrapper.vm.startRecord();
    await wrapper.vm.chooseFile();
    fail();
    expect(wrapper.emitted('error')).toBeUndefined();
    await wrapper.vm.startRecord();
    stop();
    expect(wrapper.emitted('change')).toHaveLength(3);
  });

  it('recovers after native start throws or file selection fails', async () => {
    const { wrapper, recorder, stop } = mountNativeCapture();
    recorder.start.mockImplementationOnce(() => { throw new Error('start failed'); });
    await wrapper.vm.startRecord();
    expect(wrapper.vm.nativeSession).toBeNull();
    expect(wrapper.vm.recording).toBe(false);
    await wrapper.vm.startRecord();
    chooseAudioFile.mockRejectedValue(new Error('selection failed'));
    await wrapper.vm.chooseFile();
    stop();
    expect(wrapper.vm.selectingFile).toBe(false);
    expect(wrapper.emitted('change')).toBeUndefined();
    await wrapper.vm.startRecord();
    stop();
    expect(wrapper.emitted('change')).toHaveLength(1);
  });

  it('does not clear chosen audio when rerecord is attempted before cancelled native stop', async () => {
    const { wrapper, recorder, stop } = mountNativeCapture();
    chooseAudioFile.mockResolvedValue({ path: 'wxfile://chosen.mp3' });
    await wrapper.vm.startRecord();
    await wrapper.vm.chooseFile();
    wrapper.vm.restartRecording();
    expect(wrapper.emitted('clear')).toBeUndefined();
    expect(recorder.start).toHaveBeenCalledTimes(1);
    stop();
    wrapper.vm.restartRecording();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('clear')).toHaveLength(1);
    expect(recorder.start).toHaveBeenCalledTimes(2);
  });

  it.each(['stop', 'error'])('waits for disposed native session %s before a remounted component starts', async (event) => {
    const callbacks = { stop: [], error: [] };
    const recorder = {
      start: vi.fn(),
      stop: vi.fn(),
      onStop: vi.fn((callback) => { callbacks.stop.push(callback); }),
      onError: vi.fn((callback) => { callbacks.error.push(callback); }),
    };
    uni.getRecorderManager = () => recorder;
    const first = mountCapture();
    first.vm.recordingSupported = true;
    await first.vm.startRecord();
    first.unmount();
    const second = mountCapture();
    second.vm.recordingSupported = true;
    await second.vm.startRecord();
    expect(recorder.start).toHaveBeenCalledTimes(1);
    callbacks[event].forEach((callback) => callback({
      tempFilePath: 'wxfile://cancelled.mp3', duration: 2000, errMsg: 'interrupted',
    }));
    expect(first.emitted('change')).toBeUndefined();
    expect(second.emitted('change')).toBeUndefined();
    await second.vm.startRecord();
    expect(recorder.start).toHaveBeenCalledTimes(2);
    callbacks.stop.forEach((callback) => callback({
      tempFilePath: 'wxfile://fresh.mp3', duration: 2000,
    }));
    expect(first.emitted('change')).toBeUndefined();
    expect(second.emitted('change')[0][0].path).toBe('wxfile://fresh.mp3');
  });

  it('retains native ownership after stop throws and permits an explicit safe retry', async () => {
    const { wrapper, recorder, stop } = mountNativeCapture();
    recorder.stop.mockImplementationOnce(() => { throw new Error('stop failed'); });
    await wrapper.vm.startRecord();
    wrapper.vm.stopRecord();
    expect(wrapper.vm.recording).toBe(true);
    expect(wrapper.vm.nativeStopFailed).toBe(true);
    expect(wrapper.vm.primaryLabel).toBe('重试停止');
    expect(wrapper.emitted('error')).toHaveLength(1);
    await wrapper.vm.handlePrimaryAction();
    expect(recorder.stop).toHaveBeenCalledTimes(2);
    expect(wrapper.vm.nativeBusy).toBe(true);
    expect(wrapper.vm.nativeStopFailed).toBe(false);
    await wrapper.vm.startRecord();
    expect(recorder.start).toHaveBeenCalledTimes(1);
    stop();
    await wrapper.vm.startRecord();
    expect(recorder.start).toHaveBeenCalledTimes(2);
  });

  it('preserves a selected file while retrying a failed disposed manager stop', async () => {
    const stops = [];
    const recorder = {
      start: vi.fn(),
      stop: vi.fn().mockImplementationOnce(() => { throw new Error('stop failed'); }),
      onStop: vi.fn((callback) => { stops.push(callback); }),
      onError: vi.fn(),
    };
    uni.getRecorderManager = () => recorder;
    const first = mountCapture();
    first.vm.recordingSupported = true;
    await first.vm.startRecord();
    first.unmount();
    const second = mountCapture({ path: 'wxfile://chosen.mp3' });
    second.vm.recordingSupported = true;
    expect(second.vm.nativeStopFailed).toBe(true);
    expect(second.vm.titleText).toBe('录音尚未结束');
    second.vm.restartRecording();
    expect(second.emitted('clear')).toBeUndefined();
    expect(recorder.stop).toHaveBeenCalledTimes(2);
    expect(recorder.start).toHaveBeenCalledTimes(1);
    second.vm.restartRecording();
    expect(second.emitted('clear')).toBeUndefined();
    stops.forEach((callback) => callback({ tempFilePath: 'wxfile://old.mp3', duration: 2000 }));
    expect(second.emitted('change')).toBeUndefined();
    expect(second.vm.nativeBusy).toBe(false);
    second.vm.restartRecording();
    await second.vm.$nextTick();
    expect(second.emitted('clear')).toHaveLength(1);
    expect(recorder.start).toHaveBeenCalledTimes(2);
  });

  it('does not clear selected audio on remount while another native stop is pending', async () => {
    const { wrapper: first, recorder } = mountNativeCapture();
    const firstStop = recorder.onStop.mock.calls[0][0];
    await first.vm.startRecord();
    first.unmount();
    const second = mountCapture({ path: 'wxfile://chosen.mp3' });
    second.vm.restartRecording();
    expect(second.vm.nativeBusy).toBe(true);
    expect(second.emitted('clear')).toBeUndefined();
    expect(recorder.start).toHaveBeenCalledTimes(1);
    firstStop({ tempFilePath: 'wxfile://old.mp3', duration: 2000 });
    expect(second.vm.nativeBusy).toBe(false);
  });

  it('stops native recording on disposal and ignores completion', async () => {
    const { wrapper, recorder, stop } = mountNativeCapture();
    await wrapper.vm.startRecord();
    wrapper.unmount();
    stop();
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('discards native recording completion after choosing an existing file', async () => {
    let onStop;
    const recorder = {
      start: vi.fn(),
      stop: vi.fn(),
      onStop: vi.fn((callback) => { onStop = callback; }),
      onError: vi.fn(),
    };
    uni.getRecorderManager = () => recorder;
    const wrapper = mountCapture();
    wrapper.vm.recordingSupported = true;
    chooseAudioFile.mockResolvedValue({ path: 'wxfile://chosen.mp3' });

    await wrapper.vm.startRecord();
    await wrapper.vm.chooseFile();
    onStop({ tempFilePath: 'wxfile://cancelled.mp3', duration: 2000 });

    expect(wrapper.emitted('change')).toHaveLength(1);
    expect(wrapper.emitted('change')[0][0].path).toBe('wxfile://chosen.mp3');
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.recording).toBe(false);
    expect(wrapper.vm.stopTimer).toBeNull();
  });

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
      start: vi.fn(),
      stop: vi.fn(),
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

  it('keeps native callback ownership while submission invalidates a pending picker', async () => {
    const { wrapper, recorder, stop } = mountNativeCapture();
    const selection = deferred();
    chooseAudioFile.mockReturnValue(selection.promise);
    await wrapper.vm.startRecord();
    const pending = wrapper.vm.chooseFile();
    await wrapper.setProps({ disabled: true });
    wrapper.vm.clearAudio();
    wrapper.vm.restartRecording();
    await wrapper.vm.startRecord();
    await wrapper.vm.chooseFile();
    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(chooseAudioFile).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('clear')).toBeUndefined();

    await wrapper.setProps({ disabled: false });
    selection.resolve({ path: 'wxfile://stale-choice.mp3' });
    await pending;
    expect(wrapper.vm.selectingFile).toBe(false);
    await wrapper.vm.startRecord();
    expect(recorder.start).toHaveBeenCalledTimes(1);
    stop();
    expect(wrapper.emitted('change')).toBeUndefined();
    await wrapper.vm.startRecord();
    stop();
    expect(wrapper.emitted('change')).toHaveLength(1);
  });

  it('preserves native stop recovery without clearing submitted audio while locked', async () => {
    const { wrapper, recorder, stop } = mountNativeCapture();
    await wrapper.vm.startRecord();
    recorder.stop.mockImplementationOnce(() => { throw new Error('stop failed'); });
    chooseAudioFile.mockResolvedValue({ path: 'wxfile://chosen.mp3' });
    await wrapper.vm.chooseFile();
    await wrapper.setProps({ audio: { path: 'wxfile://chosen.mp3' }, disabled: true });
    expect(wrapper.vm.nativeStopFailed).toBe(true);
    expect(wrapper.findComponent({ name: 'BaseButton' }).props('disabled')).toBe(true);
    wrapper.vm.restartRecording();
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('clear')).toBeUndefined();

    await wrapper.setProps({ disabled: false });
    wrapper.vm.restartRecording();
    expect(recorder.stop).toHaveBeenCalledTimes(2);
    stop();
    expect(wrapper.vm.nativeBusy).toBe(false);
    expect(wrapper.emitted('change')).toHaveLength(1);
    expect(wrapper.emitted('clear')).toBeUndefined();
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
