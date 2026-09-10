import { flushPromises, shallowMount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import BaseButton from '@/components/BaseButton.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import RecordingFeed from '@/components/home/RecordingFeed.vue';
import HomePage from '@/pages/index.vue';

vi.mock('@/services/entryRecording', () => ({
  createUsageAttestation: vi.fn(),
  listRecordings: vi.fn(),
  pageResults: vi.fn((response) => response?.results || response || []),
  primaryEntryLink: vi.fn((recording) => recording?.entry_links?.[0] || null),
}));

vi.mock('@/services/authGuard', () => ({
  isLoggedIn: vi.fn(() => false),
  requireAuth: vi.fn(() => true),
}));

vi.mock('@/services/capabilities', () => ({
  CAPABILITIES: { LISTEN_FEED: 'listen_feed' },
  ensureCapability: vi.fn(() => false),
  isCapabilityEnabled: vi.fn(() => false),
}));

vi.mock('@/services/listenFeed', () => ({
  LISTEN_FEED_TABS: [
    { key: 'today', label: '新近' },
    { key: 'dialect', label: '本地' },
    { key: 'phrase', label: '短语' },
    { key: 'recommended', label: '全部' },
  ],
  resolveDefaultListenTab: vi.fn(() => 'recommended'),
}));

vi.mock('@/services/feedback', () => ({ notifySuccess: vi.fn() }));

vi.mock('@/services/navigation', () => ({
  goRecordingDetail: vi.fn(),
  goRecordingDrafts: vi.fn(),
  goCircleList: vi.fn(),
  goEntryDetail: vi.fn(),
  goHome: vi.fn(),
  goMine: vi.fn(),
  goRecord: vi.fn(),
  goSearch: vi.fn(),
}));

vi.mock('@/services/productAnalytics', () => ({
  PRODUCT_EVENTS: { LISTEN_FEED_VIEW: 'listen_feed_view' },
  trackProductEvent: vi.fn(),
}));

vi.mock('@/services/theme', () => ({
  getAccentPreference: vi.fn(() => 'pine'),
  paintNativeChrome: vi.fn(),
  resolveTheme: vi.fn(() => 'light'),
}));

vi.mock('@/services/themeCenter', () => ({ hydrateOutfitStyle: vi.fn() }));
vi.mock('@/services/themeSchema', () => ({ getAppliedOutfitVars: vi.fn(() => ({})) }));
vi.mock('@/utils/audio', () => ({ stopAudio: vi.fn(), onExternalStop: vi.fn(() => vi.fn()) }));

const entryRecording = await import('@/services/entryRecording');
const { requireAuth } = await import('@/services/authGuard');
const { goRecord, goSearch } = await import('@/services/navigation');
const { getAppliedOutfitVars } = await import('@/services/themeSchema');

const scrollViewStub = {
  template: '<div><slot /></div>',
};

function mountFeed(tab = 'recommended') {
  return shallowMount(RecordingFeed, {
    props: { tab },
    global: {
      stubs: {
        PlatformScroll: scrollViewStub,
        'scroll-view': scrollViewStub,
      },
    },
  });
}

describe('listening feed visual states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { showToast: vi.fn() };
    globalThis.getApp = vi.fn(() => ({ globalData: { userInfo: {} } }));
  });

  it('keeps a stable skeleton stage while the first page is loading', async () => {
    entryRecording.listRecordings.mockReturnValue(new Promise(() => {}));

    const wrapper = mountFeed();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-feed-state="loading"]').exists()).toBe(true);
    expect(wrapper.findAll('.recording-feed__skeleton-button')).toHaveLength(2);
    expect(wrapper.text()).toContain('先听这一句');
    wrapper.unmount();
  });

  it('offers recording as the clear next step for an empty feed', async () => {
    entryRecording.listRecordings.mockResolvedValue({ results: [], next: null });

    const wrapper = mountFeed('dialect');
    await flushPromises();

    expect(wrapper.get('[data-feed-state="empty"]').text()).toContain('等你开声');
    expect(wrapper.text()).toContain('我的本地');
    wrapper.get('[data-feed-state="empty"]').getComponent(BaseButton).vm.$emit('click');
    await wrapper.vm.$nextTick();

    expect(requireAuth).toHaveBeenCalledWith('record_recording', { page: 'listen' });
    expect(goRecord).toHaveBeenCalledWith();
    wrapper.unmount();
  });

  it('keeps a visible retry path when loading fails', async () => {
    entryRecording.listRecordings.mockRejectedValue(new Error('offline'));

    const wrapper = mountFeed();
    await flushPromises();

    expect(wrapper.get('[data-feed-state="error"]').attributes('role')).toBe('alert');
    expect(wrapper.text()).toContain('录音加载失败，请稍后重试');
    wrapper.get('[data-feed-state="error"]').getComponent(BaseButton).vm.$emit('click');
    await flushPromises();

    expect(entryRecording.listRecordings).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it('labels the loaded recording as the current listening object', async () => {
    entryRecording.listRecordings.mockResolvedValue({
      results: [{ id: 11, entry_links: [] }],
      next: null,
    });

    const wrapper = mountFeed();
    await flushPromises();

    expect(wrapper.get('[data-feed-state="normal"]').text()).toContain('正在听');
    expect(wrapper.text()).toContain('已载入 1 段');
    expect(wrapper.findAllComponents(EntryRecordingCard)).toHaveLength(1);
    wrapper.unmount();
  });

  it('renders paginated recordings through the same themed card component', async () => {
    entryRecording.listRecordings
      .mockResolvedValueOnce({
        results: [{ id: 11, entry_links: [] }],
        next: '/recordings/?page=2',
      })
      .mockResolvedValueOnce({
        results: [{ id: 12, entry_links: [] }],
        next: null,
      });

    const wrapper = mountFeed();
    await flushPromises();
    await wrapper.vm.loadMore();
    await flushPromises();

    expect(wrapper.findAllComponents(EntryRecordingCard)).toHaveLength(2);
    expect(wrapper.vm.items.map((item) => item.id)).toEqual([11, 12]);
    wrapper.unmount();
  });

  it('turns off the looping skeleton animation for reduced motion', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/home/RecordingFeed.vue'),
      'utf8',
    );

    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source).toMatch(/recording-feed__skeleton-line,[\s\S]*animation: none/);
  });
});

describe('listening maintenance state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = {
      $off: vi.fn(),
      $on: vi.fn(),
      getStorageSync: vi.fn(() => ''),
    };
    globalThis.getApp = vi.fn(() => ({ globalData: { userInfo: {} } }));
  });

  it('keeps search available when the recording stream is disabled', async () => {
    const wrapper = shallowMount(HomePage);

    expect(wrapper.get('[data-feed-state="maintenance"]').text()).toContain('录音流正在维护');
    expect(wrapper.findComponent(RecordingFeed).exists()).toBe(false);
    wrapper.get('[data-feed-state="maintenance"]').getComponent(BaseButton).vm.$emit('click');
    await wrapper.vm.$nextTick();

    expect(goSearch).toHaveBeenCalledWith();
    wrapper.unmount();
  });

  it('updates outfit variables without rebuilding cached feeds', async () => {
    getAppliedOutfitVars.mockReturnValue({
      '--dress-card-background': 'var(--accent-subtle-color)',
    });
    const wrapper = shallowMount(HomePage);
    wrapper.vm.visitedTabs = ['today', 'recommended'];
    wrapper.vm.feedRevision = 3;

    wrapper.vm.handleThemeChange({ accent: 'tea' });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.feedRevision).toBe(3);
    expect(wrapper.vm.visitedTabs).toEqual(['today', 'recommended']);
    expect(wrapper.vm.outfitVars).toEqual({
      '--dress-card-background': 'var(--accent-subtle-color)',
    });
    wrapper.unmount();
  });
});
