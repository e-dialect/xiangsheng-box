import { flushPromises, mount } from '@vue/test-utils';
import {
  afterEach, beforeEach, expect, it, vi,
} from 'vitest';
import Profile from '@/pages/users/details.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import { listRecordings } from '@/services/entryRecording';
import { stopAudio } from '@/utils/audio';

vi.mock('@/services/entryRecording', async (original) => ({
  ...(await original()), listRecordings: vi.fn(),
}));
vi.mock('@/services/shareMessages', () => ({ defaultMessage: () => ({}) }));

let wrapper;
let contexts;
let accountId;

beforeEach(() => {
  contexts = [];
  accountId = '';
  // Vitest does not preprocess uni-app platform directives. Stub the inactive
  // H5 branch as well, while asserting the native managed context and callbacks.
  vi.stubGlobal('Audio', vi.fn(() => ({
    play: vi.fn(), pause: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  vi.stubGlobal('uni', {
    getStorageSync: () => accountId,
    navigateTo: vi.fn(),
    createInnerAudioContext: () => {
      const callbacks = {};
      const context = {
        play: vi.fn(), destroy: vi.fn(),
        onTimeUpdate: (callback) => { callbacks.timeupdate = callback; },
        onEnded: (callback) => { callbacks.ended = callback; },
        onError: (callback) => { callbacks.error = callback; },
        callbacks,
      };
      contexts.push(context);
      return context;
    },
  });
  listRecordings.mockResolvedValue({ results: [{
    id: 1, original_gloss: '乡音', audio_url: '/sample.mp3',
  }], next: null });
});
afterEach(() => {
  wrapper?.unmount();
  stopAudio();
  vi.unstubAllGlobals();
});

async function open() {
  wrapper = mount(Profile, {
    global: {
      stubs: {
        PageShell: { template: '<div><slot /></div>' },
        AvatarFrame: true,
        BaseButton: { props: ['text'], template: '<button @click="$emit(\'click\')">{{ text }}<slot /></button>' },
        BaseLoading: true,
        EmptyState: true,
      },
    },
  });
  await wrapper.setData({ id: '9', loading: false, userInfo: { user: { id: 9 }, contribution: { recordings: 1 } } });
  await wrapper.vm.loadPublicRecordings();
  await flushPromises();
  return wrapper.getComponent(EntryRecordingCard);
}

it.each(['recording details', 'linked entry'])('stops hidden profile audio after opening %s and allows replay', async (destination) => {
  const card = await open();
  card.vm.toggleAudio();
  await flushPromises();
  expect(card.text()).toContain('停止');
  if (destination === 'recording details') card.vm.goRecordingDetail(1);
  else card.vm.$emit('open-entry', 2);
  expect(uni.navigateTo).toHaveBeenCalledTimes(1);
  // navigateTo hides the page without unmounting its cards.
  Profile.onHide?.call(wrapper.vm);
  await flushPromises();
  expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
  expect(wrapper.getComponent(EntryRecordingCard).vm).toBe(card.vm);
  expect(card.vm.playing).toBe(false);
  expect(card.vm.playbackHandle).toBeNull();
  expect(card.text()).toContain('听录音');
  card.vm.toggleAudio();
  await flushPromises();
  expect(contexts[1].play).toHaveBeenCalledTimes(1);
  // Late callbacks from the disposed context must not reset the new playback.
  contexts[0].callbacks.error();
  contexts[0].callbacks.ended();
  expect(card.vm.playing).toBe(true);
  expect(card.vm.playbackFailed).toBe(false);
  Profile.onHide?.call(wrapper.vm);
  await flushPromises();
  expect(contexts[1].destroy).toHaveBeenCalledTimes(1);
  expect(card.vm.playing).toBe(false);
});

it('stops on unload even without a preceding hide', async () => {
  const card = await open();
  card.vm.toggleAudio();
  Profile.onUnload?.call(wrapper.vm);
  expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
  expect(card.vm.playing).toBe(false);
});

it('does not leave an old card playing after account/profile replacement', async () => {
  const card = await open();
  card.vm.toggleAudio();
  accountId = '10';
  await wrapper.setData({ id: '10', loading: true });
  expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
  await wrapper.setData({ loading: false, userInfo: { user: { id: 10 }, contribution: { recordings: 0 } }, recordings: [] });
  expect(wrapper.findComponent(EntryRecordingCard).exists()).toBe(false);
});
