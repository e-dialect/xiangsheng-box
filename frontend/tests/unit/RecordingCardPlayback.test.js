import { shallowMount } from '@vue/test-utils';
import {
  beforeEach, expect, it, vi,
} from 'vitest';
import BaseButton from '@/components/BaseButton.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import { playManaged } from '@/utils/audio';

vi.mock('@/utils/audio', () => ({
  onExternalStop: vi.fn(() => vi.fn()),
  playManaged: vi.fn(),
  stopAudio: vi.fn(),
}));

function mountCard(audioUrl) {
  return shallowMount(EntryRecordingCard, {
    props: {
      recording: { id: 1, audio_url: audioUrl, original_gloss: '示例乡音' },
      detailLink: false,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

it('keeps playback failure next to the recording and clears it when retrying', async () => {
  playManaged.mockReturnValue({ src: '/sample.mp3' });
  const card = mountCard('/sample.mp3');
  const button = card.getComponent(BaseButton);
  button.vm.$emit('click');
  await card.vm.$nextTick();
  playManaged.mock.calls[0][1].onError();
  await card.vm.$nextTick();
  expect(card.get('[role="status"]').text()).toContain('再点「听录音」重试');
  expect(button.props('text')).toBe('听录音');

  button.vm.$emit('click');
  await card.vm.$nextTick();
  expect(playManaged).toHaveBeenCalledTimes(2);
  expect(card.get('[role="status"]').text()).toBe('');
  card.unmount();
});

it('explains missing audio and does not offer a working playback action', () => {
  const card = mountCard('');
  const button = card.getComponent(BaseButton);
  expect(button.props('disabled')).toBe(true);
  expect(card.get('[role="status"]').text()).toContain('暂无可播放的音频');
  button.vm.$emit('click');
  expect(playManaged).not.toHaveBeenCalled();
  card.unmount();
});
