import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Select the real H5 implementation, as uni's production compiler does.
vi.mock('@/utils/audio', async () => {
  const { readFileSync } = await import('node:fs');
  const { markRaw, toRaw } = await import('vue');
  const source = readFileSync(`${process.cwd()}/src/utils/audio.js`, 'utf8')
    .replace(/import .* from 'vue';/g, '')
    .replace(/\/\/ #ifndef H5[\s\S]*?\/\/ #endif/g, '')
    .replace(/export /g, '');
  return new Function('markRaw', 'toRaw', `${source}; return { playManaged, stopManagedAudio, stopAudio, onExternalStop, preload };`)(markRaw, toRaw);
});

vi.mock('@/services/entryRecording', async (original) => ({ ...await original(), listRecordings: vi.fn() }));
import { listRecordings } from '@/services/entryRecording';

import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import CircleDetails from '@/pages/circles/details.vue';
import CollectionDetails from '@/pages/collections/details.vue';
import EntryDetails from '@/pages/entries/details.vue';
import { preload, stopAudio } from '@/utils/audio';

let audio;
const wrappers = [];
const recording = (id) => ({ id, audio_url: `https://example.test/${id}.mp3`, entry_links: [] });
const stubs = {
  PageShell: { template: '<main><slot /></main>' },
  BaseButton: true, BaseLoading: true, EmptyState: true, AvatarFrame: true,
  DiscussionThread: true, CollectionPicker: true, DialectLabel: true,
};
function mounted(component, options = {}) {
  const wrapper = mount(component, { global: { stubs }, ...options });
  wrappers.push(wrapper);
  return wrapper;
}
function card(id) { return mounted(EntryRecordingCard, { props: { recording: recording(id) } }); }
function start(wrapper) {
  wrapper.vm.toggleAudio();
  expect(wrapper.vm.playing).toBe(true);
  return audio.at(-1);
}
beforeEach(() => {
  audio = [];
  globalThis.uni = { showToast: vi.fn(), navigateTo: vi.fn() };
  vi.stubGlobal('Audio', class {
    constructor(src) { this.src = src; this.pause = vi.fn(); audio.push(this); }
    play() { return Promise.resolve(); }
    addEventListener() {}
    removeEventListener() {}
  });
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  stopAudio();
  vi.unstubAllGlobals();
});

describe('owned recording playback', () => {
  it('stops and resets on hide, tolerates repeated cleanup, and can replay on return', () => {
    const source = card(1);
    const first = start(source);
    source.vm.stopPlayback();
    source.vm.stopPlayback();
    expect(first.pause).toHaveBeenCalledTimes(1);
    expect(source.vm.playing).toBe(false);
    expect(source.vm.playbackHandle).toBeNull();
    const replay = start(source);
    source.unmount();
    expect(replay.pause).toHaveBeenCalledTimes(1);
  });
  it('preserves destination audio and preload through stale source hide and unmount', () => {
    const source = card(1);
    start(source);
    const destination = card(2);
    const second = start(destination);
    preload('https://example.test/next.mp3');
    const next = audio.at(-1);
    source.vm.stopPlayback();
    source.unmount();
    expect(second.pause).not.toHaveBeenCalled();
    expect(next.src).toBe('https://example.test/next.mp3');
    expect(destination.vm.playing).toBe(true);
    expect(source.vm.playbackHandle).toBeNull();
  });
  it('preserves destination when stale source unmounts without an earlier hide', () => {
    const source = card(1);
    start(source);
    const destination = card(2);
    const second = start(destination);
    source.unmount();
    expect(second.pause).not.toHaveBeenCalled();
  });
});

const entry = { id: 7, display_writing: '词', summary: '说明' };
const cases = [
  ['circle', CircleDetails, { loadingCircle: false, circle: { id: 3, dialect: { id: 8 } }, recordings: [recording(1), recording(2)] }],
  ['entry', EntryDetails, { loading: false, entry, recordings: [recording(1), recording(2)] }],
  ['collection', CollectionDetails, {
    loading: false, expanded: { 1: true }, pendingOpen: true,
    pickingSection: { id: 1 }, recordings: [recording(3)],
    box: { sections: [{ id: 1, entry, recordings: [{ id: 1, recording: recording(1) }, { id: 4, recording: { ...recording(4), usage_dialect: { id: 8, name: '本地' } } }] }], pending: [{ id: 2, recording: recording(2) }] },
  }],
];
describe.each(cases)('%s detail lifecycle', (_name, component, data) => {
  it('stops every rendered card ref on page hide and unload', async () => {
    const page = mounted(component);
    await page.setData(data);
    const cards = page.findAllComponents(EntryRecordingCard);
    expect(cards.length).toBe(_name === 'collection' ? 4 : 2);
    for (const current of cards) {
      const playing = start(current);
      component.onHide.call(page.vm);
      expect(playing.pause).toHaveBeenCalledTimes(1);
      expect(current.vm.playing).toBe(false);
      component.onHide.call(page.vm);
      const replay = start(current);
      component.onUnload.call(page.vm);
      expect(replay.pause).toHaveBeenCalledTimes(1);
    }
  });
  it('does not stop a new destination during delayed page hide and unload', async () => {
    const page = mounted(component);
    await page.setData(data);
    start(page.findAllComponents(EntryRecordingCard)[0]);
    const destination = card(9);
    const playing = start(destination);
    component.onHide.call(page.vm);
    component.onUnload.call(page.vm);
    page.unmount();
    expect(playing.pause).not.toHaveBeenCalled();
    expect(destination.vm.playing).toBe(true);
  });
});

// Exercise both unload responsibilities together with real recording cards.
it.each([false, true])('invalidates pending pagination while cleaning owned audio, destination=%s', async (destinationPlaying) => {
  const page = mounted(EntryDetails);
  await page.setData({
    id: 7, loading: false, entry, recordings: [recording(1)], recordingPage: 1, hasMoreRecordings: true,
  });
  const ownAudio = start(page.findAllComponents(EntryRecordingCard)[0]);
  let resolvePage;
  listRecordings.mockImplementationOnce(() => new Promise((resolve) => { resolvePage = resolve; }));
  const pending = page.vm.loadMoreRecordings();
  let destination;
  if (destinationPlaying) destination = start(card(9));
  preload('https://example.test/preloaded.mp3');
  const preloaded = audio.at(-1);
  const version = page.vm.loadVersion;
  EntryDetails.onUnload.call(page.vm);
  expect(page.vm.loadVersion).toBe(version + 1);
  expect(ownAudio.pause).toHaveBeenCalledTimes(1);
  expect(page.findAllComponents(EntryRecordingCard)[0].vm.playing).toBe(false);
  resolvePage({ results: [recording(99)], next: null });
  await pending;
  expect(page.vm.recordings.map((r) => r.id)).toEqual([1]);
  expect(page.vm.recordingPage).toBe(1);
  if (destination) expect(destination.pause).not.toHaveBeenCalled();
  expect(preloaded.src).toBe('https://example.test/preloaded.mp3');
});
