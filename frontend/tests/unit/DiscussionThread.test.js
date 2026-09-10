import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/recordingSocial', () => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  likeComment: vi.fn(),
  commentRequestId: vi.fn(() => 'request-1'),
}));
vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));
vi.mock('@/services/feedback', () => ({ notify: vi.fn(), confirm: vi.fn(async () => true) }));

import DiscussionThread from '@/components/DiscussionThread.vue';
import {
  listComments, createComment, commentRequestId,
} from '@/services/recordingSocial';

function mountThread(props = {}) {
  return mount(DiscussionThread, {
    props: { targetId: 5, ...props },
    global: {
      stubs: {
        BaseForm: { template: '<form class="form-stub"><slot /></form>' },
        BaseField: { template: '<label class="field-stub" />' },
        BaseLoading: true,
        EmptyState: true,
      },
    },
  });
}

describe('DiscussionThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listComments.mockResolvedValue({ results: [], count: 0, next: null });
    createComment.mockResolvedValue({ id: 1 });
  });

  it('lists top level comments by default', async () => {
    mountThread();
    await flushPromises();

    expect(listComments).toHaveBeenCalledWith(5, 1, 'recording', null, 0);
  });

  it('lists the replies of one root when rootId is set', async () => {
    mountThread({ rootId: 8, pageSize: 20 });
    await flushPromises();

    expect(listComments).toHaveBeenCalledWith(5, 1, 'recording', 8, 20);
  });

  it('reports the total so the panel can show counts', async () => {
    listComments.mockResolvedValue({ results: [], count: 4, next: null });
    const wrapper = mountThread();
    await flushPromises();

    expect(wrapper.emitted('count-change')[0][0]).toEqual({ total: 4, rootId: null });
  });

  it('renders the composer slot instead of the built in form', async () => {
    const wrapper = mountThread({ externalComposer: true });
    await flushPromises();

    expect(wrapper.find('.form-stub').exists()).toBe(false);
    const slot = mount(DiscussionThread, {
      props: { targetId: 5, externalComposer: true },
      slots: { composer: '<div class="slot-composer">slot</div>' },
      global: { stubs: { BaseLoading: true, EmptyState: true } },
    });
    await flushPromises();
    expect(slot.find('.slot-composer').exists()).toBe(true);

    const inline = mountThread();
    await flushPromises();
    expect(inline.find('.form-stub').exists()).toBe(true);
  });

  it('keeps one request id across retries and reports the failure', async () => {
    createComment.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 2 });
    const wrapper = mountThread({ externalComposer: true });
    await flushPromises();

    const failed = await wrapper.vm.submitExternal('乡音', { parentId: 3, replyToId: 4 });
    expect(failed).toBe(false);
    const sent = await wrapper.vm.submitExternal('乡音', { parentId: 3, replyToId: 4 });
    expect(sent).toBe(true);
    expect(createComment.mock.calls[0][0]).toEqual(expect.objectContaining({
      recording_id: 5,
      parent_id: 3,
      reply_to_id: 4,
      body: '乡音',
      client_id: 'request-1',
    }));
    expect(createComment.mock.calls[1][0].client_id).toBe(createComment.mock.calls[0][0].client_id);
    expect(commentRequestId).toHaveBeenCalledTimes(1);
  });

  it('refuses an empty body without calling the api', async () => {
    const wrapper = mountThread({ externalComposer: true });
    await flushPromises();

    expect(await wrapper.vm.submitExternal('   ')).toBe(false);
    expect(createComment).not.toHaveBeenCalled();
  });

  it('highlights the anchored comment once the page loads', async () => {
    listComments.mockResolvedValue({
      results: [{ id: 7, body: '顶楼', author_name: '甲', like_count: 0 }],
      count: 1,
      next: null,
    });
    const wrapper = mountThread({ externalComposer: true, initialCommentId: 7 });
    await flushPromises();

    expect(wrapper.vm.highlightId).toBe(7);
    expect(wrapper.vm.scrollTarget).toBe('comment-7');
  });

  it('keeps a deleted root readable without its actions', async () => {
    listComments.mockResolvedValue({
      results: [{
        id: 3, body: '', author_name: '', deleted: true, reply_count: 2, like_count: 0,
      }],
      count: 1,
      next: null,
    });
    const wrapper = mountThread({ externalComposer: true });
    await flushPromises();

    expect(wrapper.text()).toContain('该留言已删除');
    expect(wrapper.text()).not.toContain('删除留言');
    expect(wrapper.text()).toContain('查看全部回复 2');
  });
});
