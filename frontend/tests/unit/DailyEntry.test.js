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
    expect(wrapper.text()).toContain('暂时没有加载出来');

    wrapper.findComponent({ name: 'BaseButton' }).vm.$emit('click');
    await flushPromises();
    expect(wrapper.text()).toContain('当前地区范围暂时没有可推荐的词条');
    expect(request.get).toHaveBeenLastCalledWith('/entries/daily/', {}, true, expect.any(Object));
    expect(goEntryDetail).not.toHaveBeenCalled();
  });

  it('keeps the feature hidden while the site region is unresolved or a search is active', () => {
    const page = Search.data();
    const show = () => Search.computed.showDailyEntry.call(page);
    expect(show()).toBe(false);
    page.browseScopeReady = true;
    page.pendingSiteScope = { code: '闽.莆仙' };
    expect(show()).toBe(false);
    page.pendingSiteScope = null;
    expect(show()).toBe(true);
    page.filters.keyword = '月亮';
    expect(show()).toBe(false);
  });
});
