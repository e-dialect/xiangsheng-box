import { flushPromises, mount } from '@vue/test-utils';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('@/routers', () => ({ toIndexPage: vi.fn() }));

vi.mock('@/services/productProfile', async (importOriginal) => ({
  ...await importOriginal(),
  currentProductName: () => '兴化语记',
  loadProductProfile: vi.fn(),
}));

const { loadProductProfile } = await import('@/services/productProfile');
const { toIndexPage } = await import('@/routers');
const { default: NotFoundPage } = await import('@/pages/error/not-found.vue');

function mountPage() {
  return mount(NotFoundPage, {
    global: {
      stubs: {
        PageShell: { template: '<main><slot /></main>' },
        BaseButton: {
          emits: ['click'],
          props: ['text', 'ariaLabel'],
          template: '<button :aria-label="ariaLabel" @click="$emit(\'click\')">{{ text }}</button>',
        },
      },
    },
  });
}

describe('not-found recovery page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/pages/error/not-found');
  });

  it('shows a long attempted path without exposing its query string', async () => {
    const wrapper = mountPage();
    const attemptedPath = '/shared/dialect/entry/a-very-long-and-unavailable-route';

    wrapper.vm.$options.onLoad.call(wrapper.vm, {
      path: encodeURIComponent(`${attemptedPath}?token=private-value#evidence`),
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain(attemptedPath);
    expect(wrapper.text()).not.toContain('private-value');
    expect(wrapper.text()).toContain('这条路没有找到页面');
  });

  it.each([
    ['/articles/175', {}, '暂未接入旧版文章'],
    ['/pages/articles/details', {}, '暂未接入旧版文章'],
    ['/music', {}, '暂未接入旧版音乐'],
    ['/search', { legacySearchNeedsInput: '1' }, '关键词需要重新选择'],
  ])('offers a search or home action for the legacy PXM path %s', async (path, query, message) => {
    loadProductProfile.mockResolvedValue({ key: 'pxm' });
    const wrapper = mountPage();
    wrapper.vm.$options.onLoad.call(wrapper.vm, { path, ...query });
    await flushPromises();
    expect(wrapper.text()).toContain(message);
    expect(wrapper.findAll('button').map((button) => button.text())).toEqual(['查找词条', '回到首页']);
  });

  it('keeps the general site recovery page for the same historical path', async () => {
    loadProductProfile.mockResolvedValue({ key: 'box' });
    const wrapper = mountPage();
    wrapper.vm.$options.onLoad.call(wrapper.vm, { path: '/articles/175' });
    await flushPromises();
    expect(wrapper.text()).toContain('这条路没有找到页面');
    expect(wrapper.findAll('button')).toHaveLength(1);
  });

  it('uses only an unreplaced H5 history path as the attempted route', () => {
    const wrapper = mountPage();
    window.history.replaceState({
      back: '/shared/missing-entry?token=private-value',
      replaced: false,
    }, '', '/pages/error/not-found');

    expect(wrapper.vm.resolveRequestedPath()).toBe('/shared/missing-entry');

    window.history.replaceState({
      back: '/pages/search',
      replaced: true,
    }, '', '/pages/error/not-found');
    expect(wrapper.vm.resolveRequestedPath()).toBe('');
  });

  it('keeps one accessible recovery action that returns home', async () => {
    const wrapper = mountPage();

    const actions = wrapper.findAll('button');
    expect(actions).toHaveLength(1);
    expect(actions[0].attributes('aria-label')).toBe('返回首页');

    await actions[0].trigger('click');
    expect(toIndexPage).toHaveBeenCalledOnce();
  });
});
