import { readFileSync } from 'node:fs';
import { markRaw, reactive, toRaw } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

function loadAudio(platform) {
  const source = readFileSync(`${process.cwd()}/src/utils/audio.js`, 'utf8')
    .replace(/import .* from 'vue';/g, '')
    .replace(platform === 'H5' ? /\/\/ #ifndef H5[\s\S]*?\/\/ #endif/g : /\/\/ #ifdef H5[\s\S]*?\/\/ #endif/g, '')
    .replace(/export /g, '');
  return new Function('markRaw', 'toRaw', `${source}; return { playManaged, stopManagedAudio, stopAudio, preload };`)(markRaw, toRaw);
}
afterEach(() => vi.unstubAllGlobals());
describe.each(['H5', 'native'])('%s managed ownership', (platform) => {
  it('accepts a reactive handle but ignores missing and stale handles without touching preload', () => {
    const contexts = [];
    function context() {
      const result = { play: vi.fn(), pause: vi.fn(), stop: vi.fn(), destroy: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        onTimeUpdate: vi.fn(), onEnded: vi.fn(), onError: vi.fn() };
      contexts.push(result);
      return result;
    }
    vi.stubGlobal('Audio', function Audio() { return context(); });
    vi.stubGlobal('uni', { createInnerAudioContext: context });
    const api = loadAudio(platform);
    const first = reactive({ handle: api.playManaged('first.mp3') });
    const second = reactive({ handle: api.playManaged('second.mp3') });
    const destination = contexts.at(-1);
    api.preload('next.mp3');
    const preloaded = contexts.at(-1);
    api.stopManagedAudio();
    api.stopManagedAudio(first.handle);
    expect(destination.pause).not.toHaveBeenCalled();
    expect(destination.destroy).not.toHaveBeenCalled();
    expect(preloaded.src).toBe('next.mp3');
    api.stopManagedAudio(second.handle);
    api.stopManagedAudio(second.handle);
    expect(platform === 'H5' ? destination.pause : destination.destroy).toHaveBeenCalledTimes(1);
    expect(preloaded.src).toBe('next.mp3');
    expect(preloaded.destroy).not.toHaveBeenCalled();
    api.stopAudio();
    if (platform === 'H5') expect(preloaded.src).toBe('');
    else expect(preloaded.destroy).toHaveBeenCalledTimes(1);
  });
});
