import { flushPromises, shallowMount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import DailyEntry from '@/components/DailyEntry.vue';
import Search from '@/pages/search.vue';
import { goEntryDetail } from '@/services/navigation';
import request from '@/utils/request';

vi.mock('@/utils/request', () => ({ default: { get: vi.fn() } }));
vi.mock('@/services/navigation', async (original) => ({
  ...(await original()),
  goEntryDetail: vi.fn(),
}));

describe('daily entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the selected scope as a visitor and opens the returned entry', async () => {
    request.get.mockResolvedValueOnce({ id: 7, display_writing: '月娘', summary: '月亮' });
    const wrapper = shallowMount(DailyEntry, { props: { dialectId: 12, dialectScope: 'subtree' } });
    await flushPromises();

    expect(request.get).toHaveBeenCalledWith(
      '/entries/daily/',
      { dialect_id: 12, dialect_scope: 'subtree' },
      true,
      expect.objectContaining({ auth: false, visitor: false }),
    );
    expect(wrapper.text()).toContain('月娘');
    expect(wrapper.text()).toContain('月亮');
    wrapper.findComponent({ name: 'BaseButton' }).vm.$emit('click');
    expect(goEntryDetail).toHaveBeenCalledWith(7);
  });

  it('lets a visitor retry after a request failure and shows the empty region', async () => {
    request.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('');
    const wrapper = shallowMount(DailyEntry);
    await flushPromises();
    const state = wrapper.findComponent({ name: 'EmptyState' });
    expect(state.props()).toMatchObject({
      title: '每日一词暂时没有加载出来。',
      actionText: '重试每日一词',
    });

    state.vm.$emit('action');
    await flushPromises();
    expect(wrapper.findComponent({ name: 'EmptyState' }).props()).toMatchObject({
      title: '当前地区范围暂时没有可推荐的词条。',
      actionText: '',
    });
    expect(request.get).toHaveBeenCalledTimes(2);
    expect(request.get).toHaveBeenLastCalledWith('/entries/daily/', {}, true, expect.any(Object));
    expect(goEntryDetail).not.toHaveBeenCalled();
  });

  it('waits on site scope and hides when a region is unresolved or a search is active', async () => {
    const page = Search.data();
    const show = () => Search.computed.showDailyEntry.call(page);
    let finishScope;
    const scopeLoading = new Promise((resolve) => { finishScope = resolve; });
    const ready = Search.watch.siteScopeReady.call(page, scopeLoading);
    expect(show()).toBe(false);
    finishScope();
    await ready;
    page.pendingSiteScope = { code: '闽.莆仙' };
    expect(show()).toBe(false);
    page.pendingSiteScope = null;
    expect(show()).toBe(true);
    page.filters.keyword = '月亮';
    expect(show()).toBe(false);
  });
});
