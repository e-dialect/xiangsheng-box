import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/recordingSocial', () => ({ listComments: vi.fn() }));

import DiscussionSummary from '@/components/DiscussionSummary.vue';
import { listComments } from '@/services/recordingSocial';

function comment(id, body = `留言${id}`) {
  return {
    id,
    body,
    author_name: `作者${id}`,
    like_count: 0,
    reply_count: 0,
  };
}

function mountSummary(props = {}) {
  return mount(DiscussionSummary, {
    props: { targetId: 5, ...props },
    global: { stubs: { BaseLoading: true, EmptyState: true } },
  });
}

describe('DiscussionSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listComments.mockResolvedValue({ results: [], count: 0, next: null });
    globalThis.uni = { getStorageSync: vi.fn(() => '') };
  });

  it('asks for the newest few comments of the target', async () => {
    mountSummary({ targetId: 9, targetType: 'entry', limit: 3 });
    await flushPromises();

    expect(listComments).toHaveBeenCalledWith(9, 1, 'entry', null, 3);
  });

  it('renders only the preview and points at the full discussion', async () => {
    listComments.mockResolvedValue({
      results: [comment(1), comment(2)],
      count: 12,
      next: 'next',
    });
    const wrapper = mountSummary();
    await flushPromises();

    expect(wrapper.findAll('.box-recording')).toHaveLength(2);
    expect(wrapper.text()).toContain('查看全部 12 条讨论');
  });

  it('invites the first comment when the thread is empty', async () => {
    const wrapper = mountSummary();
    await flushPromises();

    expect(wrapper.text()).toContain('还没有留言');
    expect(wrapper.text()).toContain('写下第一条留言');
  });

  it('emits open when the reader asks for the full discussion', async () => {
    const wrapper = mountSummary();
    await flushPromises();

    wrapper.vm.$emit('open');
    expect(wrapper.emitted('open')).toHaveLength(1);
  });

  it('offers a retry once the summary fails to load', async () => {
    listComments.mockRejectedValueOnce(new Error('offline'));
    const wrapper = mountSummary();
    await flushPromises();

    expect(wrapper.vm.error).toBe('留言暂时无法读取');
    expect(wrapper.emitted('count-change')).toBeUndefined();

    listComments.mockResolvedValue({ results: [comment(3)], count: 1, next: null });
    await wrapper.vm.reload();
    expect(wrapper.vm.items).toHaveLength(1);
  });
});
