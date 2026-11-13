import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';

vi.mock('@/utils/audio', () => ({
  onExternalStop: vi.fn(() => vi.fn()),
  playManaged: vi.fn(),
  stopAudio: vi.fn(),
}));

describe('recording review and visibility labels', () => {
  it.each([false, true])('shows public drafts as unreviewed (compact=%s)', (compact) => {
    const wrapper = mount(EntryRecordingCard, {
      props: { recording: { id: 1, status: 'draft', visibility: true }, compact },
    });
    expect(wrapper.text()).toContain('初稿·待核对');
    expect(wrapper.text()).not.toContain('未公开初稿');
    wrapper.unmount();
  });

  it('distinguishes a private draft and removes draft labels after publishing', async () => {
    const wrapper = mount(EntryRecordingCard, {
      props: { recording: { id: 1, status: 'draft', visibility: false } },
    });
    expect(wrapper.text()).toContain('未公开初稿');
    await wrapper.setProps({ recording: { id: 1, status: 'published', visibility: true } });
    expect(wrapper.text()).not.toContain('初稿');
    wrapper.unmount();
  });
});
