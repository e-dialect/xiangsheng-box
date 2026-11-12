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
