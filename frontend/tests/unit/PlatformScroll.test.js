import { mount } from '@vue/test-utils';
import {
  describe, expect, it, vi,
} from 'vitest';

import PlatformScroll from '@/components/PlatformScroll.vue';

describe('PlatformScroll', () => {
  it('maps shell variants to stable semantic classes', () => {
    const wrapper = mount(PlatformScroll, {
      props: { variant: 'app-shell', containerClass: 'custom-scroll' },
      global: {
        stubs: { 'scroll-view': { template: '<div><slot /></div>' } },
      },
    });

    expect(wrapper.vm.resolvedClasses).toEqual([
      'platform-scroll--app-shell',
      'app-shell__scroll',
      'custom-scroll',
    ]);
    wrapper.unmount();
  });

  it('normalizes native scroll events', () => {
    const wrapper = mount(PlatformScroll, {
      global: {
        stubs: { 'scroll-view': { template: '<div><slot /></div>' } },
      },
    });

    wrapper.vm.onNativeScroll({ detail: { scrollTop: 42 } });

    expect(wrapper.emitted('scroll')).toEqual([[{ scrollTop: 42 }]]);
    wrapper.unmount();
  });

  it('emits the H5 lower boundary once until the user scrolls away', () => {
    const wrapper = mount(PlatformScroll, {
      global: {
        stubs: { 'scroll-view': { template: '<div><slot /></div>' } },
      },
    });
    const atBottom = {
      currentTarget: {
        scrollTop: 180,
        scrollHeight: 680,
        clientHeight: 500,
      },
    };

    wrapper.vm.onH5Scroll(atBottom);
    wrapper.vm.onH5Scroll(atBottom);
    expect(wrapper.emitted('scrolltolower')).toHaveLength(1);

    wrapper.vm.onH5Scroll({
      currentTarget: {
        scrollTop: 100,
        scrollHeight: 680,
        clientHeight: 500,
      },
    });
    wrapper.vm.onH5Scroll(atBottom);
    expect(wrapper.emitted('scrolltolower')).toHaveLength(2);
    wrapper.unmount();
  });

  it('preserves the native scrolltolower event contract', () => {
    const wrapper = mount(PlatformScroll, {
      global: {
        stubs: { 'scroll-view': { template: '<div><slot /></div>' } },
      },
    });

    wrapper.vm.onNativeScrollToLower();

    expect(wrapper.emitted('scrolltolower')).toHaveLength(1);
    wrapper.unmount();
  });
});

it('scrolls only its H5 container to the requested descendant', async () => {
  const target = { getBoundingClientRect: () => ({ top: 310 }) };
  const container = {
    querySelector: vi.fn(() => target),
    getBoundingClientRect: () => ({ top: 60 }),
    scrollTop: 800,
    scrollTo: vi.fn(),
  };
  const context = {
    scrollIntoView: 'record-required-audio',
    $refs: { h5Scroll: container },
    $nextTick: vi.fn(async () => {}),
  };
  await PlatformScroll.methods.scrollToTarget.call(context);
  expect(container.querySelector).toHaveBeenCalledWith('#record-required-audio');
  expect(container.scrollTo).toHaveBeenCalledWith({ top: 1050, behavior: 'auto' });
  context.scrollIntoView = '';
  await PlatformScroll.methods.scrollToTarget.call(context);
  expect(container.scrollTo).toHaveBeenCalledTimes(1);
});

it('passes the anchor to the native scroll-view', () => {
  const wrapper = mount(PlatformScroll, {
    props: { scrollIntoView: 'record-required-dialect' },
    global: { stubs: { 'scroll-view': { template: '<div data-native-scroll><slot /></div>' } } },
  });
  expect(wrapper.find('[data-native-scroll]').attributes('scroll-into-view')).toBe('record-required-dialect');
  wrapper.unmount();
});

it('keeps a requested section below the current sticky toolbar height', async () => {
  let toolbarHeight = 94;
  const toolbar = { getBoundingClientRect: () => ({ height: toolbarHeight }) };
  const target = { getBoundingClientRect: () => ({ top: 310 }) };
  const container = {
    querySelector: vi.fn((selector) => (selector === '[data-scroll-offset]' ? toolbar : target)),
    getBoundingClientRect: () => ({ top: 60 }),
    scrollTop: 800,
    scrollTo: vi.fn(),
  };
  const context = {
    scrollIntoView: 'record-required-audio',
    $refs: { h5Scroll: container },
    $nextTick: vi.fn(async () => {}),
  };
  await PlatformScroll.methods.scrollToTarget.call(context);
  expect(container.scrollTo).toHaveBeenLastCalledWith({ top: 956, behavior: 'auto' });

  // Wrapping after a viewport or text-size change must not reuse an old inset.
  toolbarHeight = 146;
  context.scrollIntoView = 'record-required-dialect';
  await PlatformScroll.methods.scrollToTarget.call(context);
  expect(container.scrollTo).toHaveBeenLastCalledWith({ top: 904, behavior: 'auto' });

  // The first section can already be close to the start of the container.
  container.scrollTop = 0;
  toolbarHeight = 300;
  await PlatformScroll.methods.scrollToTarget.call(context);
  expect(container.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' });
});

it('refreshes once only after a deliberate downward gesture at the top', async () => {
  const wrapper = mount(PlatformScroll, { props: { refreshable: true } });
  const touch = (x, y, top = 0) => ({ touches: [{ clientX: x, clientY: y }], currentTarget: { scrollTop: top } });
  wrapper.vm.onPullStart(touch(20, 20));
  wrapper.vm.onPullMove(touch(20, 100));
  wrapper.vm.onPullEnd();
  expect(wrapper.emitted('refresh')).toBeUndefined();
  wrapper.vm.onPullStart(touch(20, 20));
  wrapper.vm.onPullMove(touch(20, 160));
  wrapper.vm.onPullEnd();
  wrapper.vm.requestRefresh();
  expect(wrapper.emitted('refresh')).toHaveLength(1);
  await wrapper.setProps({ refreshing: true });
  wrapper.vm.requestRefresh();
  expect(wrapper.emitted('refresh')).toHaveLength(1);
  await wrapper.setProps({ refreshing: false });
  wrapper.vm.requestRefresh();
  expect(wrapper.emitted('refresh')).toHaveLength(2);
  wrapper.unmount();
});

it('does not hijack ordinary, horizontal, multi-touch, or cancelled scrolling', () => {
  const wrapper = mount(PlatformScroll, { props: { refreshable: true } });
  const touch = (x, y, top = 0) => ({ touches: [{ clientX: x, clientY: y }], currentTarget: { scrollTop: top } });
  wrapper.vm.onPullStart(touch(0, 0, 50));
  wrapper.vm.onPullMove(touch(0, 200));
  wrapper.vm.onPullEnd();
  wrapper.vm.onPullStart(touch(0, 0));
  wrapper.vm.onPullMove(touch(200, 100));
  wrapper.vm.onPullEnd();
  wrapper.vm.onPullStart(touch(0, 0));
  wrapper.vm.onPullMove({ touches: [{}, {}] });
  wrapper.vm.onPullEnd();
  wrapper.vm.onPullStart(touch(0, 0));
  wrapper.vm.onPullMove(touch(0, 200));
  wrapper.vm.resetPull();
  wrapper.vm.onPullEnd();
  expect(wrapper.emitted('refresh')).toBeUndefined();
  wrapper.unmount();
});

it('keeps refresh opt-in and wires the native refresher state', async () => {
  const wrapper = mount(PlatformScroll, { global: { stubs: { 'scroll-view': { template: '<div data-native-scroll><slot /></div>' } } } });
  wrapper.vm.requestRefresh();
  expect(wrapper.emitted('refresh')).toBeUndefined();
  await wrapper.setProps({ refreshable: true, refreshing: true });
  expect(wrapper.get('[data-native-scroll]').attributes('refresher-enabled')).toBe('true');
  expect(wrapper.get('[data-native-scroll]').attributes('refresher-triggered')).toBe('true');
  wrapper.unmount();
});
