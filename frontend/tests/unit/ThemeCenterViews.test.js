import { mount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import ThemeCenterDiscoveryView from '@/components/theme-center/ThemeCenterDiscoveryView.vue';
import ThemeCenterFavoritesView from '@/components/theme-center/ThemeCenterFavoritesView.vue';
import ThemeCenterFilterSheet from '@/components/theme-center/ThemeCenterFilterSheet.vue';
import ThemeCenterGlobalView from '@/components/theme-center/ThemeCenterGlobalView.vue';
import ThemeCenterLocalView from '@/components/theme-center/ThemeCenterLocalView.vue';
import ThemeCenterMergeSheet from '@/components/theme-center/ThemeCenterMergeSheet.vue';
import ThemeCenterMineView from '@/components/theme-center/ThemeCenterMineView.vue';
import ThemeCenterOutfitSheet from '@/components/theme-center/ThemeCenterOutfitSheet.vue';
import ThemeCenterRecentView from '@/components/theme-center/ThemeCenterRecentView.vue';
import ThemeCenterThemeDetail from '@/components/theme-center/ThemeCenterThemeDetail.vue';

const BaseButton = {
  props: ['ariaLabel', 'disabled', 'shape', 'size', 'variant'],
  emits: ['click'],
  template: '<button class="base-button" :aria-label="ariaLabel" :data-shape="shape" :data-size="size" :disabled="disabled" @click="onClick"><slot /></button>',
  methods: {
    onClick() {
      if (!this.disabled) this.$emit('click');
    },
  },
};
const BaseField = {
  props: ['modelValue'],
  emits: ['confirm', 'update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keyup.enter="$emit(\'confirm\')">',
};
const BaseForm = { template: '<form><slot /></form>' };
const BaseLoading = {
  props: ['text'],
  template: '<div class="base-loading">{{ text }}</div>',
};
const ThemeStatusPane = {
  props: ['compact', 'scene'],
  emits: ['action'],
  template: '<button class="status-pane" :data-compact="compact" :data-scene="scene" @click="$emit(\'action\')">{{ scene }}</button>',
};
const TSwitch = {
  props: ['value'],
  emits: ['change'],
  template: '<button class="theme-switch" @click="$emit(\'change\', !value)">{{ value }}</button>',
};

function mountView(component, props = {}) {
  return mount(component, {
    props: { ...viewDefaults.get(component), ...props },
    global: {
      stubs: {
        BaseButton,
        BaseField,
        BaseForm,
        BaseLoading,
        ThemeStatusPane,
        TSwitch,
        'scroll-view': { template: '<div class="scroll-view"><slot /></div>' },
        'movable-area': { template: '<div><slot /></div>' },
        'movable-view': { template: '<div><slot /></div>' },
      },
    },
  });
}

const theme = {
  id: 'paper',
  name: '纸页主题',
  description: '温润纸张',
  blurb: '保留乡音的温度',
  preview: 'paper',
  available: true,
};

const noop = () => false;
const emptyText = () => '';
const emptyList = () => [];
const emptyObject = () => ({});
const primary = () => 'primary';
const enable = () => '启用';
const viewDefaults = new Map([
  [ThemeCenterDiscoveryView, {
    catalogFail: false,
    catalogLoading: false,
    catalogStale: false,
    filterSummary: '',
    hotKeywords: [],
    isGreyEntry: noop,
    memberSyncing: false,
    resultTab: 'all',
    searchActionDisabled: noop,
    searchActionLabel: enable,
    searchActionVariant: primary,
    searchForm: { keyword: '' },
    searching: false,
    searchRows: [],
    searchTabs: [],
    showFilterBar: false,
    tab: 'global',
    tagClass: emptyText,
    themePreviewShotClass: emptyList,
    themePreviewVars: emptyObject,
  }],
  [ThemeCenterRecentView, {
    recentTagClass: emptyText,
    rows: [],
    themeCoverSrc: emptyText,
    themePreviewShotClass: emptyList,
    themePreviewVars: emptyObject,
    visible: false,
  }],
  [ThemeCenterGlobalView, {
    activeTheme: theme,
    appearance: 'system',
    appearanceOptions: [],
    catalogBadge: emptyText,
    emptyScene: 'catalog',
    footerLines: [],
    isGreyTheme: noop,
    isItemFav: noop,
    statsOf: () => ({ likes: 0 }),
    themeActionDisabled: noop,
    themeActionLabel: enable,
    themeActionVariant: primary,
    themeCoverSrc: emptyText,
    themePreviewShotClass: emptyList,
    themePreviewVars: emptyObject,
    themeTags: emptyList,
    themes: [],
    visible: false,
  }],
  [ThemeCenterLocalView, {
    dressItems: [],
    groups: [],
    isGreyEntry: noop,
    searchActionDisabled: noop,
    searchActionLabel: enable,
    searchActionVariant: primary,
    showDressItems: false,
    tagClass: emptyText,
    visible: false,
  }],
  [ThemeCenterFavoritesView, {
    actionDisabled: noop,
    actionLabel: enable,
    actionVariant: primary,
    entries: [],
    filter: 'all',
    filters: [],
    statsOf: () => ({ favorites: 0, likes: 0 }),
    tagClass: emptyText,
    visible: false,
  }],
  [ThemeCenterMineView, {
    accountSyncNote: '',
    acquireOffers: { themes: [], dresses: [] },
    activeTheme: theme,
    appliedDress: [],
    dressActionDisabled: noop,
    dressActionVariant: primary,
    dressStatus: emptyText,
    dressTags: emptyList,
    hasAppliedDress: false,
    outfitPreviewShotClass: emptyList,
    outfitPreviewVars: emptyObject,
    outfitSummary: emptyText,
    outfitThemePreview: () => 'paper',
    overlay: false,
    ownedUnused: { themes: [], dresses: [] },
    previewShotClass: [],
    savedOutfits: [],
    tagClass: emptyText,
    themeActionDisabled: noop,
    themeActionVariant: primary,
    themePreviewShotClass: emptyList,
    themePreviewVars: emptyObject,
    themeTags: emptyList,
    visible: false,
  }],
  [ThemeCenterThemeDetail, {
    canLivePreviewItem: noop,
    catalogBadge: emptyText,
    isItemFav: noop,
    isMiniProgram: false,
    statsOf: () => ({ favorites: 0, liked: false, likes: 0 }),
    theme: null,
    themeAccess: emptyObject,
    themeActionDisabled: noop,
    themeActionLabel: enable,
    themeActionVariant: primary,
    themeDetailSrc: emptyText,
    themeFeatures: [],
    themePreviewShotClass: emptyList,
    themePreviewVars: emptyObject,
    themeTags: emptyList,
    zoomHint: '',
    zoomOpen: false,
  }],
  [ThemeCenterFilterSheet, {
    accessFilters: [],
    categories: [],
    context: 'global',
    dialectRegions: [],
    draft: {
      access: 'all', category: 'all', dressCategory: 'all', regions: [], status: 'all', sort: 'newest',
    },
    dressCategories: [],
    isDraftRegionOn: noop,
    open: false,
    sortOptions: [],
    statusFilters: [],
  }],
  [ThemeCenterOutfitSheet, {
    error: '',
    form: { name: '' },
    mode: 'save',
    open: false,
    rules: {},
  }],
  [ThemeCenterMergeSheet, { open: false }],
]);

beforeEach(() => {
  global.uni = {
    getStorageSync: vi.fn(() => ''),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  };
});

describe('theme center independent views', () => {
  it('renders discovery loading, error, search-empty, and normal states', async () => {
    const wrapper = mountView(ThemeCenterDiscoveryView, {
      searchForm: { keyword: '' },
      catalogFail: true,
    });
    expect(wrapper.find('[data-scene="catalog_fail"]').exists()).toBe(true);

    await wrapper.setProps({ catalogFail: false, catalogLoading: true });
    expect(wrapper.find('.base-loading').text()).toContain('装扮目录加载中');

    await wrapper.setProps({ catalogLoading: false, searching: true, searchRows: [] });
    expect(wrapper.find('[data-scene="search"]').exists()).toBe(true);

    await wrapper.setProps({
      filterSummary: '最新上架',
      hotKeywords: ['家乡'],
      searching: false,
      showFilterBar: true,
      tab: 'global',
    });
    expect(wrapper.text()).toContain('家乡');
    expect(wrapper.text()).toContain('筛选与排序');
    expect(wrapper.text()).toContain('最新上架');
    const filterCell = wrapper.getComponent({ name: 'TDesignStub' });
    expect(filterCell.props('ariaLabel')).toBe('筛选与排序，当前最新上架');
    filterCell.vm.$emit('click');
    expect(wrapper.emitted('open-filter')).toHaveLength(1);
    await wrapper.find('input').setValue('纸页');
    expect(wrapper.emitted('update-keyword')?.[0]).toEqual(['纸页']);
  });

  it('keeps recent empty and disabled rows independently testable', async () => {
    const wrapper = mountView(ThemeCenterRecentView, { visible: true, rows: [] });
    const status = wrapper.find('[data-scene="recent"]');
    expect(status.exists()).toBe(true);
    expect(status.attributes()).toHaveProperty('data-compact');

    await wrapper.setProps({
      rows: [{
        id: 'retired',
        kind: 'theme',
        item: theme,
        name: '已下架主题',
        label: '已下架',
        preview: 'paper',
        disabled: true,
      }],
    });
    expect(wrapper.find('.recent-card').classes()).toContain('disabled');
    expect(wrapper.find('.base-button').attributes('disabled')).toBeDefined();
    await wrapper.find('.recent-card').trigger('tap');
    expect(wrapper.emitted('open')?.[0][0].id).toBe('retired');
  });

  it('renders global catalog empty and normal states without the page controller', async () => {
    const wrapper = mountView(ThemeCenterGlobalView, {
      visible: true,
      activeTheme: theme,
      themes: [],
      emptyScene: 'filter',
    });
    expect(wrapper.find('[data-scene="filter"]').exists()).toBe(true);

    await wrapper.setProps({ themes: [theme], footerLines: ['说明边界'] });
    expect(wrapper.text()).toContain('纸页主题');
    expect(wrapper.text()).toContain('说明边界');
    const favorite = wrapper.get('[aria-label="收藏主题：纸页主题"]');
    const share = wrapper.get('[aria-label="分享主题：纸页主题"]');
    expect(favorite.attributes('data-shape')).toBe('circle');
    expect(favorite.attributes('data-size')).toBe('extra-small');
    await favorite.trigger('click');
    await share.trigger('click');
    expect(wrapper.emitted('toggle-favorite')?.[0]).toEqual(['theme', theme]);
    expect(wrapper.emitted('share')?.[0]).toEqual(['theme', theme]);
    await wrapper.find('.theme-card').trigger('tap');
    expect(wrapper.emitted('preview')?.[0]).toEqual([theme]);
    await wrapper.find('.theme-name').trigger('tap');
    expect(wrapper.emitted('open-detail')?.[0]).toEqual([theme]);

    const upcoming = { ...theme, id: 'soon', name: '待上线主题', available: false };
    await wrapper.setProps({ themes: [upcoming] });
    expect(wrapper.get('[aria-label="收藏主题：待上线主题"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[aria-label="分享主题：待上线主题"]').attributes('disabled')).toBeDefined();
  });

  it('renders local catalog empty, filtered, and available group states', async () => {
    const wrapper = mountView(ThemeCenterLocalView, {
      visible: true,
      groups: [],
    });
    expect(wrapper.find('[data-scene="dress_coming"]').exists()).toBe(true);

    await wrapper.setProps({ showDressItems: true, dressItems: [] });
    expect(wrapper.find('[data-scene="filter"]').exists()).toBe(true);

    const group = {
      id: 'cards', name: '录音卡片', hint: '替换卡片外观', preview: 'paper', hasLive: true,
    };
    await wrapper.setProps({ groups: [group] });
    expect(wrapper.text()).toContain('录音卡片');
    await wrapper.findAll('.dress-card').at(-1).trigger('tap');
    expect(wrapper.emitted('open-dress')?.[0]).toEqual([group]);
  });

  it('keeps catalog filters in one context-aware sheet', async () => {
    const global = mountView(ThemeCenterGlobalView, {
      visible: true,
      themes: [theme],
    });
    const local = mountView(ThemeCenterLocalView, {
      visible: true,
      groups: [{
        id: 'cards',
        name: '录音卡片',
        hint: '',
        preview: 'paper',
        hasLive: true,
      }],
    });
    expect(global.find('.filter-scroll').exists()).toBe(false);
    expect(local.find('.filter-scroll').exists()).toBe(false);

    const filter = mountView(ThemeCenterFilterSheet, {
      open: true,
      context: 'global',
      categories: [{ value: 'dialect', label: '地域方言风' }],
      dialectRegions: [{ value: 'chuankiang', label: '川渝' }],
      dressCategories: [{ value: 'cards', label: '录音卡片' }],
    });
    expect(filter.text()).toContain('全局主题筛选');
    expect(filter.text()).toContain('风格分类');
    expect(filter.text()).toContain('地域方言标签');
    expect(filter.text()).not.toContain('装扮组件');

    await filter.setProps({ context: 'local' });
    expect(filter.text()).toContain('局部装扮筛选');
    expect(filter.text()).toContain('装扮组件');
    expect(filter.text()).not.toContain('风格分类');
    expect(filter.text()).not.toContain('地域方言标签');

    await filter.setProps({ context: 'search' });
    expect(filter.text()).toContain('搜索筛选与排序');
    expect(filter.text()).toContain('风格分类');
    expect(filter.text()).toContain('地域方言标签');
    expect(filter.text()).toContain('装扮组件');
  });

  it('renders favorites empty and normal states with filter events', async () => {
    const wrapper = mountView(ThemeCenterFavoritesView, {
      visible: true,
      filters: [{ value: 'all', label: '全部' }, { value: 'theme', label: '主题' }],
      entries: [],
    });
    expect(wrapper.find('[data-scene="favorites"]').exists()).toBe(true);

    await wrapper.findAll('.chip').at(1).trigger('tap');
    expect(wrapper.emitted('update-filter')?.[0]).toEqual(['theme']);
    await wrapper.setProps({ entries: [{ kind: 'theme', item: theme }] });
    expect(wrapper.text()).toContain('纸页主题');
    await wrapper.get('[aria-label="取消收藏主题：纸页主题"]').trigger('click');
    await wrapper.get('[aria-label="分享主题：纸页主题"]').trigger('click');
    expect(wrapper.emitted('toggle-favorite')?.[0]).toEqual(['theme', theme]);
    expect(wrapper.emitted('share')?.[0]).toEqual(['theme', theme]);

    const retired = { ...theme, id: 'retired', name: '已下架主题', available: false };
    await wrapper.setProps({ entries: [{ kind: 'theme', item: retired }] });
    expect(wrapper.get('[aria-label="取消收藏主题：已下架主题"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[aria-label="分享主题：已下架主题"]').attributes('disabled')).toBeDefined();
  });

  it('renders mine empty and populated outfit states with explicit commands', async () => {
    const wrapper = mountView(ThemeCenterMineView, {
      visible: true,
      activeTheme: theme,
      ownedUnused: { themes: [], dresses: [] },
      acquireOffers: { themes: [], dresses: [] },
    });
    expect(wrapper.find('[data-scene="dress_applied"]').exists()).toBe(true);
    expect(wrapper.find('[data-scene="mix"]').exists()).toBe(true);

    await wrapper.setProps({
      hasAppliedDress: true,
      appliedDress: [{
        group: { id: 'cards', name: '录音卡片' },
        item: { id: 'paper-card', name: '纸页卡片', preview: 'paper' },
        effective: true,
      }],
      savedOutfits: [{ id: 'mix-1', name: '家乡搭配' }],
    });
    expect(wrapper.text()).toContain('纸页卡片');
    expect(wrapper.text()).toContain('家乡搭配');
    await wrapper.find('.theme-switch').trigger('click');
    expect(wrapper.emitted('overlay-change')?.[0]).toEqual([true]);
  });

  it('keeps detail and zoom lifecycle independent from the catalog list', async () => {
    const wrapper = mountView(ThemeCenterThemeDetail, {
      theme,
      themeFeatures: ['导航栏'],
      themeActionLabel: () => '立即启用',
      canLivePreviewItem: () => true,
      statsOf: () => ({ likes: 3, favorites: 2, liked: false }),
    });
    expect(wrapper.text()).toContain('保留乡音的温度');
    expect(wrapper.text()).toContain('导航栏');
    const favorite = wrapper.get('.sheet-tools [aria-label="收藏主题：纸页主题"]');
    const share = wrapper.get('.sheet-tools [aria-label="分享主题：纸页主题"]');
    await favorite.trigger('click');
    await share.trigger('click');
    expect(wrapper.emitted('toggle-favorite')?.[0]).toEqual(['theme', theme]);
    expect(wrapper.emitted('share')?.[0]).toEqual(['theme', theme]);
    await wrapper.find('.shot-lg').trigger('tap');
    expect(wrapper.emitted('open-zoom')).toHaveLength(1);

    const upcoming = { ...theme, available: false };
    await wrapper.setProps({ theme: upcoming });
    expect(wrapper.get('.sheet-tools [aria-label="收藏主题：纸页主题"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('.sheet-tools [aria-label="分享主题：纸页主题"]').attributes('disabled')).toBeDefined();

    await wrapper.setProps({ theme, zoomOpen: true });
    expect(wrapper.find('.zoom-mask').exists()).toBe(true);
    const closeZoom = wrapper.get('[aria-label="关闭主题大图"]');
    expect(closeZoom.attributes()).toMatchObject({
      'data-size': 'small',
    });
    await closeZoom.trigger('click');
    expect(wrapper.emitted('close-zoom')).toHaveLength(1);
  });

  it('exposes filter, outfit, and login-merge sheet decisions as events', async () => {
    const filter = mountView(ThemeCenterFilterSheet, {
      open: true,
      draft: {
        access: 'all', category: 'all', dressCategory: 'all', regions: [], status: 'all', sort: 'newest',
      },
      accessFilters: [{ value: 'owned', label: '已拥有' }],
      isDraftRegionOn: () => false,
    });
    await filter.find('.chip').trigger('tap');
    expect(filter.emitted('update-draft')?.[0]).toEqual([{ field: 'access', value: 'owned' }]);

    const outfit = mountView(ThemeCenterOutfitSheet, {
      open: true,
      form: { name: '' },
    });
    await outfit.find('input').setValue('乡音搭配');
    expect(outfit.emitted('update-name')?.[0]).toEqual(['乡音搭配']);

    const merge = mountView(ThemeCenterMergeSheet, { open: true });
    await merge.findAll('.base-button').at(2).trigger('click');
    expect(merge.emitted('choose')?.[0]).toEqual(['merge']);
  });
});
