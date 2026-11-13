import { mount } from '@vue/test-utils';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('@/services/entryRecording', () => ({
  dialectLabel: (dialect) => dialect?.name || '',
  entryTitle: (entry) => entry?.display_writing || '待整理词条',
  getMyContributionHistory: vi.fn(),
  listEntryBookmarks: vi.fn(),
  pageResults: (response) => response?.results || response || [],
  unbookmarkEntry: vi.fn(),
}));
vi.mock('@/services/feedback', () => ({ notify: vi.fn(), notifySuccess: vi.fn() }));
vi.mock('@/services/navigation', async (importOriginal) => ({
  ...(await importOriginal()),
  goEntryDetail: vi.fn(),
  goRecordingDetail: vi.fn(),
  goRecord: vi.fn(),
  goSearch: vi.fn(),
}));

const archive = await import('@/services/entryRecording');
const { notify, notifySuccess } = await import('@/services/feedback');
const { goEntryDetail, goRecordingDetail } = await import('@/services/navigation');
const { default: BookmarksPage } = await import('@/pages/users/bookmarks.vue');
const { default: ContributionsPage } = await import('@/pages/users/contributions.vue');

const entry = {
  id: 21,
  display_writing: '雨势突然变大、来得又急又密的一种很长的方言说法',
  summary: '形容阵雨忽然变得猛烈。',
  usage_dialect: { id: 3, name: '莆仙方言' },
  status: 'published',
  recording_count: 3,
  evidence_count: 2,
};

const stubs = {
  PageShell: { template: '<main><slot /></main>' },
  BaseButton: {
    props: ['text', 'disabled', 'loading'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ text }}</button>',
  },
  BaseLoading: true,
  DialectLabel: { props: ['dialect'], template: '<span>{{ dialect.name }}</span>' },
  EmptyState: true,
};

function mountPage(component) {
  return mount(component, { global: { stubs } });
}

describe('personal contribution and bookmark archives', () => {
  it('opens a contributed recording even when it has no linked entry', async () => {
    const wrapper = mountPage(ContributionsPage);
    wrapper.vm.history = {
      summary: {},
      recent_activity: [{
        kind: 'recording', target_id: 55, label: '尚待整理的乡音', created_at: '2026-09-06',
      }],
    };
    wrapper.vm.loading = false;
    await wrapper.vm.$nextTick();
    await wrapper.get('.activity-row button').trigger('click');
    expect(goRecordingDetail).toHaveBeenCalledWith(55);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    archive.getMyContributionHistory.mockResolvedValue({
      summary: {
        recordings: 12,
        evidence: 7,
        revisions: 4,
        dialects: 2,
      },
      dialect_footprint: [{
        dialect: { id: 3, name: '莆仙方言' },
        contribution_count: 14,
      }],
      recent_activity: [{
        kind: 'recording',
        target_id: 11,
        label: '表示雨忽然下得很大、来得很急的一个很长的说法',
        created_at: '2026-09-04T10:00:00Z',
      }],
    });
    archive.listEntryBookmarks.mockResolvedValue({ results: [entry] });
    archive.unbookmarkEntry.mockResolvedValue({ bookmarked: false });
  });

  it('keeps contribution counts secondary to a readable activity archive', async () => {
    const wrapper = mountPage(ContributionsPage);

    await wrapper.vm.load();

    expect(wrapper.vm.metrics.map((item) => item.label)).toEqual([
      '录音', '补证', '修订', '地区足迹',
    ]);
    expect(wrapper.text()).toContain('你参与记录过的乡音');
    expect(wrapper.text()).toContain('表示雨忽然下得很大、来得很急的一个很长的说法');
    expect(wrapper.text()).not.toContain('积分');
    expect(wrapper.text()).not.toContain('权威等级');
  });

  it('clears stale contribution data when the archive request fails', async () => {
    archive.getMyContributionHistory.mockRejectedValueOnce(new Error('履历服务不可用'));
    const wrapper = mountPage(ContributionsPage);
    wrapper.vm.history = { recent_activity: [{ target_id: 99 }] };

    await wrapper.vm.load();

    expect(wrapper.vm.error).toBe('履历服务不可用');
    expect(wrapper.vm.history).toEqual({});
  });

  it('shows bookmark metadata without squeezing a long entry title into the actions', async () => {
    const wrapper = mountPage(BookmarksPage);

    await wrapper.vm.load();

    expect(wrapper.findAll('.bookmark-card')).toHaveLength(1);
    expect(wrapper.text()).toContain(entry.display_writing);
    expect(wrapper.text()).toContain('3 段录音');
    expect(wrapper.text()).toContain('2 份依据');
    wrapper.vm.goEntryDetail(entry.id);
    expect(goEntryDetail).toHaveBeenCalledWith(21);
  });

  it('removes a bookmark only after the request succeeds', async () => {
    const wrapper = mountPage(BookmarksPage);
    await wrapper.vm.load();

    await wrapper.vm.remove(entry.id);

    expect(archive.unbookmarkEntry).toHaveBeenCalledWith(21);
    expect(wrapper.vm.entries).toEqual([]);
    expect(notifySuccess).toHaveBeenCalledWith('已移出收藏');
    expect(wrapper.vm.removingId).toBeNull();
  });

  it('keeps the bookmark visible and explains a removal failure', async () => {
    archive.unbookmarkEntry.mockRejectedValueOnce(new Error('网络中断'));
    const wrapper = mountPage(BookmarksPage);
    await wrapper.vm.load();

    await wrapper.vm.remove(entry.id);

    expect(wrapper.vm.entries).toEqual([entry]);
    expect(notify).toHaveBeenCalledWith({ title: '网络中断' });
    expect(wrapper.vm.removingId).toBeNull();
  });

  it('restarts pagination after removing a bookmark from a partial list', async () => {
    const remaining = { ...entry, id: 22 };
    archive.listEntryBookmarks
      .mockResolvedValueOnce({ count: 2, results: [entry], next: '/entries/bookmarks/?page=2' })
      .mockResolvedValueOnce({ count: 1, results: [remaining], next: null });
    const wrapper = mountPage(BookmarksPage);
    await wrapper.vm.load();

    await wrapper.vm.remove(entry.id);

    expect(archive.listEntryBookmarks.mock.calls).toEqual([[{ page: 1 }], [{ page: 1 }]]);
    expect(wrapper.vm.entries).toEqual([remaining]);
    expect(wrapper.vm.total).toBe(1);
  });

  it('preserves remaining cards and freezes offsets until rebuilding succeeds', async () => {
    const remaining = { ...entry, id: 22 };
    archive.listEntryBookmarks
      .mockResolvedValueOnce({ count: 3, results: [entry, remaining], next: 'page2' })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ count: 2, results: [remaining, remaining], next: 'page2' })
      .mockResolvedValueOnce({ count: 2, results: [{ ...entry, id: 23 }], next: null });
    const wrapper = mountPage(BookmarksPage);
    await wrapper.setData({ appliedSearch: '雨', keyword: '未提交' });
    await wrapper.vm.load();
    await wrapper.vm.remove(entry.id);
    expect(wrapper.vm.entries).toEqual([remaining]);
    expect(wrapper.findAll('.bookmark-card')).toHaveLength(1);
    expect(wrapper.text()).toContain('重新加载收藏列表');
    expect(wrapper.text()).toContain('列表暂时刷新失败');
    expect(wrapper.vm.refreshRequired).toBe(true);
    await wrapper.vm.load(true);
    expect(archive.listEntryBookmarks).toHaveBeenCalledTimes(2);
    await wrapper.vm.load(false, true);
    expect(wrapper.vm.entries).toEqual([remaining]);
    expect(wrapper.vm.refreshRequired).toBe(false);
    await wrapper.vm.load(true);
    expect(archive.listEntryBookmarks.mock.calls.map(([params]) => params)).toEqual([
      { page: 1, search: '雨' }, { page: 1, search: '雨' },
      { page: 1, search: '雨' }, { page: 2, search: '雨' },
    ]);
    expect(archive.unbookmarkEntry).toHaveBeenCalledTimes(1);
  });

  it('keeps rebuild recovery available after the last visible card is removed', async () => {
    const remaining = { ...entry, id: 22 };
    archive.listEntryBookmarks
      .mockResolvedValueOnce({ count: 3, results: [entry, remaining], next: 'page2' })
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('still offline'));
    const wrapper = mountPage(BookmarksPage);
    await wrapper.vm.load();
    await wrapper.vm.remove(entry.id);
    await wrapper.vm.remove(remaining.id);
    expect(wrapper.vm.entries).toEqual([]);
    expect(wrapper.vm.refreshRequired).toBe(true);
    expect(wrapper.text()).toContain('重新加载收藏列表');
    expect(wrapper.text()).toContain('列表暂时刷新失败');
    expect(wrapper.vm.next).toBe(false);
    await wrapper.vm.load(true);
    expect(archive.listEntryBookmarks).toHaveBeenCalledTimes(3);
    expect(archive.unbookmarkEntry.mock.calls).toEqual([[21], [22]]);
  });

  it('serializes retries and removals while a rebuild is pending', async () => {
    archive.listEntryBookmarks
      .mockResolvedValueOnce({ count: 2, results: [entry], next: 'page2' });
    const wrapper = mountPage(BookmarksPage);
    await wrapper.vm.load();
    let resolve;
    archive.listEntryBookmarks.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const removal = wrapper.vm.remove(entry.id);
    await Promise.resolve();
    await wrapper.vm.load(false, true);
    await wrapper.vm.remove(entry.id);
    await wrapper.vm.submitSearch();
    expect(archive.listEntryBookmarks).toHaveBeenCalledTimes(2);
    expect(archive.unbookmarkEntry).toHaveBeenCalledTimes(1);
    resolve({ count: 1, results: [{ ...entry, id: 22 }], next: null });
    await removal;
    expect(wrapper.vm.entries.map((item) => item.id)).toEqual([22]);
    expect(wrapper.vm.refreshRequired).toBe(false);
  });

});
