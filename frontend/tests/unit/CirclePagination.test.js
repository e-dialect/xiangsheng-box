import { shallowMount } from '@vue/test-utils';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import CircleDirectory from '@/pages/circles/index.vue';
import CircleDetails from '@/pages/circles/details.vue';
import { getCircle, listCircleRecordings, listCircles } from '@/services/guantou';

vi.mock('@/services/guantou', () => ({
  getCircle: vi.fn(),
  listCircleRecordings: vi.fn(),
  listCircles: vi.fn(),
  joinCircle: vi.fn(),
  leaveCircle: vi.fn(),
}));

describe('dialect circle pagination', () => {
  beforeEach(() => vi.resetAllMocks());

  it('retries the directory page with the submitted search and keeps visible circles', async () => {
    const first = { id: 1, name: '莆田城区', dialect: { name: '莆田' } };
    const second = { id: 2, name: '莆田乡镇', dialect: { name: '莆田' } };
    listCircles
      .mockResolvedValueOnce({ results: [first], count: 2, next: '/circles/?page=2' })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ results: [first, second], count: 2, next: null });
    const wrapper = shallowMount(CircleDirectory);
    await wrapper.vm.refresh('莆田');
    await wrapper.setData({ search: '仙游' });

    await wrapper.vm.loadMore();
    expect(wrapper.vm.circles).toEqual([first]);
    expect(wrapper.vm.moreError).toBe(true);
    await wrapper.vm.loadMore();

    expect(listCircles.mock.calls).toEqual([
      [{ page: 1, search: '莆田' }],
      [{ page: 2, search: '莆田' }],
      [{ page: 2, search: '莆田' }],
    ]);
    expect(wrapper.vm.circles).toEqual([first, second]);
    expect(wrapper.vm.next).toBe(false);
  });

  it('keeps playable recordings when the next page fails', async () => {
    const first = { id: 20 };
    const older = { id: 10 };
    getCircle.mockResolvedValue({ id: 4, name: '仙游圈', dialect: { id: 3, name: '仙游' } });
    listCircleRecordings
      .mockResolvedValueOnce({ results: [first], next: '/circles/4/recordings/?page=2' })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ results: [older], next: null });
    const wrapper = shallowMount(CircleDetails);
    await wrapper.setData({ circleId: 4 });
    await wrapper.vm.loadCircle();

    await wrapper.vm.loadRecordings(true);
    expect(wrapper.vm.recordings).toEqual([first]);
    expect(wrapper.vm.recordingsError).toBe('');
    expect(wrapper.vm.moreError).toBe(true);
    await wrapper.vm.loadRecordings(true);

    expect(listCircleRecordings.mock.calls).toEqual([
      [4, { page: 1, page_size: 50 }],
      [4, { page: 2, page_size: 50 }],
      [4, { page: 2, page_size: 50 }],
    ]);
    expect(wrapper.vm.recordings).toEqual([first, older]);
    expect(wrapper.vm.hasMoreRecordings).toBe(false);
  });
});
