import { flushPromises, mount } from '@vue/test-utils';
import {
  afterEach, beforeEach, expect, it, vi,
} from 'vitest';
import RecordingDetails from '@/pages/recordings/details.vue';
import RecordingContributorButton from '@/components/RecordingContributorButton.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import { getRecording } from '@/services/entryRecording';
import { stopAudio } from '@/utils/audio';

vi.mock('@/services/entryRecording', async (original) => ({
  ...(await original()), getRecording: vi.fn(),
}));
vi.mock('@/services/pageShare', () => ({
  canUseSystemShare: () => false, hasShareTarget: () => false, sharePage: vi.fn(), WECHAT_SHARE_IMAGE: '',
}));

let wrapper;
let contexts;

beforeEach(() => {
  contexts = [];
  // Vitest does not preprocess uni-app platform directives. Stub the inactive
  // H5 branch as well, while asserting the native managed context and callbacks.
  vi.stubGlobal('Audio', vi.fn(() => ({
    play: vi.fn(), pause: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  vi.stubGlobal('uni', {
    getStorageSync: () => '',
    navigateTo: vi.fn(),
    createInnerAudioContext: () => {
      const callbacks = {};
      const context = {
        play: vi.fn(),
        destroy: vi.fn(),
        onTimeUpdate: (callback) => { callbacks.timeupdate = callback; },
        onEnded: (callback) => { callbacks.ended = callback; },
        onError: (callback) => { callbacks.error = callback; },
        callbacks,
      };
      contexts.push(context);
      return context;
    },
  });
});
afterEach(() => {
  wrapper?.unmount();
  stopAudio();
  vi.unstubAllGlobals();
});

async function open(withEntry = false) {
  getRecording.mockResolvedValue({
    id: 1,
    original_gloss: '乡音',
    audio_url: '/sample.mp3',
    visibility: true,
    recorder: { id: 9, nickname: '乡友' },
    entry_links: withEntry ? [{ id: 2, role: 'primary', entry: { id: 2, written_form: '乡音' } }] : [],
  });
  wrapper = mount(RecordingDetails, {
    global: {
      stubs: {
        PageShell: { template: '<div><slot /></div>' },
        AvatarFrame: true,
        BaseButton: { props: ['text'], template: '<button @click="$emit(\'click\')">{{ text }}<slot /></button>' },
        BaseLoading: true,
        EmptyState: true,
        CollectionPicker: true,
        DiscussionThread: true,
      },
    },
  });
  RecordingDetails.onLoad.call(wrapper.vm, { id: 1 });
  await wrapper.vm.load();
  await flushPromises();
  return wrapper.getComponent(EntryRecordingCard);
}

it.each([
  ['contributor without a linked entry', false],
  ['contributor with a linked entry', true],
  ['linked entry', true],
])('stops detail audio after opening %s and allows replay', async (destination, withEntry) => {
  const card = await open(withEntry);
  card.vm.toggleAudio();
  await flushPromises();
  expect(card.text()).toContain('停止');
  if (destination.startsWith('contributor')) {
    await wrapper.getComponent(RecordingContributorButton).get('button').trigger('click');
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/users/details?id=9' });
  } else {
    card.vm.$emit('open-entry', 2);
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/entries/details?id=2' });
  }
  // navigateTo retains the detail page and its card in the page stack.
  RecordingDetails.onHide?.call(wrapper.vm);
  await flushPromises();
  expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
  expect(wrapper.getComponent(EntryRecordingCard).vm).toBe(card.vm);
  expect(card.vm.playing).toBe(false);
  expect(card.vm.playbackHandle).toBeNull();
  expect(card.text()).toContain('听录音');
  card.vm.toggleAudio();
  await flushPromises();
  expect(contexts[1].play).toHaveBeenCalledTimes(1);
  contexts[0].callbacks.error();
  contexts[0].callbacks.ended();
  expect(card.vm.playing).toBe(true);
  expect(card.vm.playbackFailed).toBe(false);
  RecordingDetails.onHide?.call(wrapper.vm);
  await flushPromises();
  expect(contexts[1].destroy).toHaveBeenCalledTimes(1);
  expect(card.vm.playing).toBe(false);
});

it('stops on unload even without a preceding hide', async () => {
  const card = await open();
  card.vm.toggleAudio();
  RecordingDetails.onUnload?.call(wrapper.vm);
  expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
  expect(card.vm.playing).toBe(false);
});

it('safely cleans up repeated hide and unload events', async () => {
  const card = await open();
  card.vm.toggleAudio();
  RecordingDetails.onHide?.call(wrapper.vm);
  RecordingDetails.onHide?.call(wrapper.vm);
  RecordingDetails.onUnload?.call(wrapper.vm);
  expect(contexts[0].destroy).toHaveBeenCalledTimes(1);
  expect(card.vm.playbackHandle).toBeNull();
});
