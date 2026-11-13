import { runInNewContext } from 'node:vm';
import { markRaw, reactive, toRaw } from 'vue';
import {
  describe, expect, it, vi,
} from 'vitest';
// Vite loads the unprocessed source so each uni-app platform branch can be isolated.
// eslint-disable-next-line import/no-unresolved, import/extensions
import source from '@/utils/audio.js?raw';

// Exercise the actual platform branch, rather than executing H5 and native code together.

function setup(platform) {
  const contexts = [];
  const uni = {
    showToast: vi.fn(),
    createInnerAudioContext: vi.fn(() => {
      const events = {};
      const context = {
        events,
        play: vi.fn(),
        stop: vi.fn(),
        destroy: vi.fn(),
        onError: (callback) => { events.error = callback; },
        onEnded: (callback) => { events.ended = callback; },
        onTimeUpdate: (callback) => { events.timeupdate = callback; },
      };
      contexts.push(context);
      return context;
    }),
  };
  function Audio(src) {
    this.src = src;
    this.events = {};
    this.play = vi.fn(() => Promise.resolve());
    this.pause = vi.fn();
    this.addEventListener = (name, callback) => { this.events[name] = callback; };
    this.removeEventListener = (name) => { delete this.events[name]; };
    contexts.push(this);
  }
  let active = true;
  const compiled = source.split('\n').filter((line) => {
    if (line.includes('// #ifdef H5')) { active = platform === 'H5'; return false; }
    if (line.includes('// #ifndef H5')) { active = platform !== 'H5'; return false; }
    if (line.includes('// #endif')) { active = true; return false; }
    return active;
  }).join('\n').replace(/import .* from 'vue';/g, '')
    .replaceAll('export function ', 'function ');
  const api = runInNewContext(`${compiled}\n({ playAudio, playManaged, stopAudio, onExternalStop });`, {
    uni, Audio, URL, markRaw, toRaw, window: { location: { href: 'https://example.test/', origin: 'https://example.test' } },
  });
  return { api, contexts, uni };
}

describe('native legacy playback ownership', () => {
  it('ignores an error from a replaced recording', () => {
    const { api, contexts, uni } = setup('APP');
    api.playAudio('/old.mp3');
    const oldError = contexts[0].events.error;
    api.playAudio('/new.mp3');
    uni.showToast.mockClear();
    oldError();
    expect(contexts[1].stop).not.toHaveBeenCalled();
    expect(contexts[1].destroy).not.toHaveBeenCalled();
    expect(uni.showToast).not.toHaveBeenCalled();
    api.stopAudio();
  });

  it('does not let an old legacy error stop a new managed player', () => {
    const { api, contexts, uni } = setup('APP');
    api.playAudio('/old.mp3');
    const oldError = contexts[0].events.error;
    const onError = vi.fn();
    api.playManaged('/new.mp3', { onError });
    oldError();
    expect(contexts[1].destroy).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(uni.showToast).not.toHaveBeenCalledWith({ title: '播放失败', icon: 'none' });
    api.stopAudio();
  });

  it('releases an ended recording once and ignores its later errors', () => {
    const { api, contexts, uni } = setup('APP');
    api.playAudio('/old.mp3');
    contexts[0].events.ended();
    expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
    uni.showToast.mockClear();
    contexts[0].events.error();
    api.stopAudio();
    expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
    expect(uni.showToast).not.toHaveBeenCalled();
  });

  it('detaches ownership before stopping a context that emits a synchronous error', () => {
    const { api, contexts, uni } = setup('APP');
    api.playAudio('/old.mp3');
    contexts[0].stop.mockImplementationOnce(() => contexts[0].events.error());
    uni.showToast.mockClear();
    api.stopAudio();
    expect(contexts[0].stop).toHaveBeenCalledTimes(1);
    expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
    expect(uni.showToast).not.toHaveBeenCalled();
  });

  it('still reports and releases the currently failing recording', () => {
    const { api, contexts, uni } = setup('APP');
    api.playAudio('/broken.mp3');
    uni.showToast.mockClear();
    contexts[0].events.error();
    expect(uni.showToast).toHaveBeenCalledWith({ title: '播放失败', icon: 'none' });
    expect(contexts[0].stop).toHaveBeenCalledTimes(1);
    expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
    api.stopAudio();
    expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
  });
});

describe.each(['H5', 'APP'])('%s managed playback cleanup', (platform) => {
  it('preserves handle identity when a Vue component stores it in reactive state', () => {
    const { api } = setup(platform);
    const state = reactive({ handle: null });
    api.onExternalStop((handle) => {
      if (handle === state.handle) state.handle = null;
    });
    state.handle = api.playManaged('/old.mp3');
    api.playManaged('/new.mp3');
    expect(state.handle).toBeNull();
    api.stopAudio();
  });

  it('preserves external-stop notification when another recording replaces it', () => {
    const { api, contexts } = setup(platform);
    const onEnded = vi.fn();
    const onError = vi.fn();
    const onExternalStop = vi.fn();
    api.onExternalStop(onExternalStop);
    const oldHandle = api.playManaged('/old.mp3', { onEnded, onError });
    const lateEnd = contexts[0].events.ended;
    const lateError = contexts[0].events.error;
    api.playManaged('/new.mp3');
    lateEnd();
    lateError();
    expect(onExternalStop).toHaveBeenCalledTimes(1);
    expect(onExternalStop).toHaveBeenCalledWith(oldHandle);
    expect(onEnded).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    api.stopAudio();
  });

  it.each(['ended', 'error'])('releases the %s context without stopping a replacement', (event) => {
    const { api, contexts } = setup(platform);
    const next = () => api.playManaged('/new.mp3');
    const onEnded = vi.fn(next);
    const onError = vi.fn(next);
    const onExternalStop = vi.fn();
    api.onExternalStop(onExternalStop);
    api.playManaged('/old.mp3', { onEnded, onError });
    const lateError = contexts[0].events.error;
    contexts[0].events[event]();
    if (platform === 'H5') {
      expect(contexts[0].src).toBe('');
      expect(contexts[0].pause).toHaveBeenCalledTimes(1);
      expect(contexts[0].events).toEqual({});
      expect(contexts[1].pause).not.toHaveBeenCalled();
    } else {
      expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
      expect(contexts[1].destroy).not.toHaveBeenCalled();
    }
    lateError();
    expect(onEnded).toHaveBeenCalledTimes(event === 'ended' ? 1 : 0);
    expect(onError).toHaveBeenCalledTimes(event === 'error' ? 1 : 0);
    expect(onExternalStop).not.toHaveBeenCalled();
    api.stopAudio();
  });
});
