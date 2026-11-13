import { flushPromises, shallowMount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import Drafts from '@/pages/recordings/drafts.vue';

it('offers a retry when saved drafts cannot be read and leaves the storage intact', async () => {
  const saved = JSON.stringify([{
    id: 'draft-1', owner: 'user:7', form: { original_gloss: '保留这句话' },
  }]);
  const getStorageSync = vi.fn((key) => {
    if (key === 'id') return 7;
    if (key === 'recording_drafts:v2:user:7') throw new Error('storage temporarily unavailable');
    return '';
  });
  const setStorageSync = vi.fn();
  vi.stubGlobal('uni', { getStorageSync, getStorageInfoSync: () => ({ keys: [] }), setStorageSync });
  const wrapper = shallowMount(Drafts, { global: { renderStubDefaultSlot: true } });
  try {
    Drafts.onShow.call(wrapper.vm);
    await flushPromises();
    const recovery = wrapper.getComponent({ name: 'EmptyState' });
    expect(recovery.props('title')).toBe('暂时读不到草稿');
    expect(recovery.props('actionText')).toBe('重新读取草稿');
    expect(setStorageSync).not.toHaveBeenCalled();
    getStorageSync.mockImplementation((key) => {
      if (key === 'id') return 7;
      return key === 'recording_drafts:v2:user:7' ? saved : '';
    });
    recovery.vm.$emit('action');
    await flushPromises();
    expect(wrapper.text()).toContain('保留这句话');
    expect(wrapper.findComponent({ name: 'EmptyState' }).exists()).toBe(false);
    expect(setStorageSync).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    vi.unstubAllGlobals();
  }
});
