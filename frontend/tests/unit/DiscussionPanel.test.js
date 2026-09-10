import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/lockPageScroll', () => ({ default: vi.fn(() => vi.fn()) }));

import DiscussionPanel from '@/components/DiscussionPanel.vue';
import DiscussionComposer from '@/components/DiscussionComposer.vue';
import BaseButton from '@/components/BaseButton.vue';
import lockPageScroll from '@/utils/lockPageScroll';

const threadProps = [];
const SCOPES = [
  { type: 'entry', id: 21, label: '词条讨论' },
  { type: 'recording', id: 11, label: '月娘', subtitle: '莆仙方言' },
];

function mountPanel(props = {}) {
  return mount(DiscussionPanel, {
    props: { scopes: SCOPES, ...props },
    global: {
      stubs: {
        DiscussionThread: {
          name: 'DiscussionThread',
          props: ['targetType', 'targetId', 'rootId', 'initialCommentId', 'externalComposer', 'authContext', 'heading', 'showHeading', 'pageSize'],
          emits: ['open-thread', 'sent'],
          template: '<div class="thread-stub">'
            + '<slot name="composer" :reply-target="null" :sending="false" '
            + ':submit="submit" :cancel-reply="cancelReply" />'
            + '</div>',
          methods: {
            submit: vi.fn(() => Promise.resolve(true)),
            cancelReply: vi.fn(),
          },
          created() { threadProps.push(this); },
        },
      },
    },
  });
}

describe('DiscussionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    threadProps.length = 0;
    globalThis.uni = { getStorageSync: vi.fn(() => '') };
    globalThis.window = globalThis.window || {};
  });

  it('locks page scroll while the panel is open and releases it on close', () => {
    const release = vi.fn();
    lockPageScroll.mockReturnValueOnce(release);
    const wrapper = mountPanel();

    expect(lockPageScroll).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('hides the scope switcher for a single target', () => {
    const wrapper = mountPanel({ scopes: [SCOPES[0]] });

    expect(wrapper.find('.discussion-panel__scope').exists()).toBe(false);
  });

  it('remounts the thread when the scope changes so responses cannot cross', async () => {
    const wrapper = mountPanel();
    expect(threadProps).toHaveLength(1);
    expect(threadProps[0].targetId).toBe(21);

    await wrapper.findAll('.discussion-panel__scope')[1].trigger('tap');

    expect(threadProps).toHaveLength(2);
    expect(threadProps[1].targetType).toBe('recording');
    expect(threadProps[1].targetId).toBe(11);
    expect(wrapper.vm.threadKey).toBe('recording:11');
    expect(wrapper.vm.stage).toBe('list');
  });

  it('keeps the draft but drops the reply target when switching scope', async () => {
    const wrapper = mountPanel();
    wrapper.vm.draft = '还没发出去的字';

    await wrapper.findAll('.discussion-panel__scope')[1].trigger('tap');

    expect(wrapper.vm.draft).toBe('还没发出去的字');
    expect(wrapper.vm.rootId).toBeNull();
  });

  it('opens one reply thread from a root comment and returns to the list', async () => {
    const wrapper = mountPanel();

    wrapper.vm.pushThread({ id: 8, reply_count: 3 });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.stage).toBe('thread');
    expect(wrapper.vm.threadKey).toBe('entry:21#8');
    expect(wrapper.find('.discussion-panel__title').text()).toBe('全部回复');

    const back = wrapper.findAllComponents(BaseButton)
      .find((item) => item.props('text') === '返回');
    back.vm.$emit('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.stage).toBe('list');
    expect(wrapper.vm.threadKey).toBe('entry:21');
  });

  it('starts on the anchored thread for a notification deep link', () => {
    const wrapper = mountPanel({ initialRoot: 8, initialComment: 9 });

    expect(wrapper.vm.stage).toBe('thread');
    expect(wrapper.vm.rootId).toBe(8);
    expect(threadProps[0].rootId).toBe(8);
    expect(threadProps[0].initialCommentId).toBe(9);
    expect(threadProps[0].authContext).toEqual({ commentId: 9, rootId: 8 });
  });

  it('clears the anchor after the first load so later remounts stay put', async () => {
    const wrapper = mountPanel({ initialRoot: 8, initialComment: 9 });

    wrapper.vm.onLoaded();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.anchorComment).toBeNull();
  });

  it('closes a deleted thread to new replies', async () => {
    const wrapper = mountPanel();
    wrapper.vm.pushThread({ id: 8, deleted: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent(DiscussionComposer).exists()).toBe(false);
    expect(wrapper.text()).toContain('回复不再开放');
  });

  it('snaps between half and full and closes on a long pull down', async () => {
    const wrapper = mountPanel();
    const grab = wrapper.find('.discussion-panel__grab');
    const drag = async (from, to) => {
      await grab.trigger('touchstart', { touches: [{ clientY: from }] });
      await grab.trigger('touchmove', { touches: [{ clientY: to }] });
      await grab.trigger('touchend', {});
    };

    await drag(400, 300);
    expect(wrapper.vm.mode).toBe('full');

    await drag(300, 400);
    expect(wrapper.vm.mode).toBe('half');

    await drag(300, 500);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('clears the draft only after the thread accepts the comment', async () => {
    const wrapper = mountPanel();
    wrapper.vm.draft = '一句乡音';
    await wrapper.vm.$nextTick();

    await wrapper.findComponent(DiscussionComposer).vm.submit();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.draft).toBe('');
  });
});
