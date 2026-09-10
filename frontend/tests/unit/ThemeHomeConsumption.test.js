import { mount, shallowMount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import AvatarFrame from '@/components/AvatarFrame.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';

vi.mock('@/services/entryRecording', () => ({
  dialectLabel: vi.fn((dialect) => dialect?.name || '未标方言点'),
  entryTitle: vi.fn((entry) => entry?.title || '待整理乡音'),
  primaryEntryLink: vi.fn(() => null),
}));

vi.mock('@/services/navigation', () => ({ goRecordingDetail: vi.fn() }));
vi.mock('@/utils/audio', () => ({
  onExternalStop: vi.fn(() => vi.fn()),
  playManaged: vi.fn(),
  stopAudio: vi.fn(),
}));

describe('home theme consumers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { showToast: vi.fn() };
  });

  it('renders image and fallback avatars inside the shared frame', async () => {
    const image = mount(AvatarFrame, {
      props: { src: '/avatar.png', name: '阿青', size: 48 },
    });
    expect(image.vm.frameStyle).toEqual({ width: '48rpx', height: '48rpx' });
    expect(image.get('image').attributes('src')).toBe('/avatar.png');
    expect(image.get('.avatar-frame').attributes('aria-label')).toBe('阿青的头像');

    await image.setProps({ src: '', name: '阿青' });
    expect(image.find('image').exists()).toBe(false);
    expect(image.get('.avatar-frame__fallback').text()).toBe('阿');
    image.unmount();
  });

  it('uses AvatarFrame for the recording author in the feed card', () => {
    const wrapper = shallowMount(EntryRecordingCard, {
      props: {
        recording: {
          id: 8,
          recorder: { nickname: '阿青', avatar: '/avatar.png' },
          usage_dialect: { name: '莆仙话' },
          entry_links: [],
        },
      },
    });

    expect(wrapper.getComponent(AvatarFrame).props()).toMatchObject({
      src: '/avatar.png',
      name: '阿青',
      size: 48,
    });
    expect(wrapper.get('.recording-card__dialect').text()).toBe('莆仙话');
    wrapper.unmount();
  });

  it('binds the card, texture, tag, and avatar-frame whitelist tokens', () => {
    const cardSource = readFileSync(
      resolve(process.cwd(), 'src/components/EntryRecordingCard.vue'),
      'utf8',
    );
    const avatarSource = readFileSync(
      resolve(process.cwd(), 'src/components/AvatarFrame.vue'),
      'utf8',
    );

    [
      '--dress-card-background',
      '--dress-card-border-radius',
      '--dress-card-shadow',
      '--dress-card-texture-image',
      '--dress-card-tag-background',
    ].forEach((token) => expect(cardSource).toContain(token));
    expect(avatarSource).toContain('--dress-avatar-frame-border-width');
    expect(avatarSource).toContain('--dress-avatar-frame-border-color');
  });
});
