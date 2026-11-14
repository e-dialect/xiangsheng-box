import {
  beforeEach, expect, it, vi,
} from 'vitest';

vi.mock('@/services/collections', () => ({
  listCollections: vi.fn(),
  createCollection: vi.fn(),
}));

const { listCollections } = await import('@/services/collections');
const { default: CollectionIndex } = await import('@/pages/collections/index.vue');

beforeEach(() => { listCollections.mockReset(); });

it('keeps the newer collection mode when an earlier search resolves late', async () => {
  let resolvePublic;
  listCollections.mockReturnValueOnce(new Promise((resolve) => { resolvePublic = resolve; }));
  listCollections.mockResolvedValueOnce({ results: [{ id: 8, title: '我的集盒' }] });
  const page = {
    ...CollectionIndex.data(),
    ...CollectionIndex.methods,
    searchTerm: '拜年',
  };

  const publicRequest = page.load();
  page.mine = true;
  await page.load();
  resolvePublic({ results: [{ id: 7, title: '拜年话' }] });
  await publicRequest;

  expect(listCollections.mock.calls).toEqual([
    [{ search: '拜年', page: 1 }], [{ mine: true, page: 1 }],
  ]);
  expect(page.boxes.map((box) => box.id)).toEqual([8]);
  expect(page.loading).toBe(false);
});

it('preserves the applied search and loaded pages when refresh fails, then replaces them on retry', async () => {
  const page = {
    ...CollectionIndex.data(),
    ...CollectionIndex.methods,
    searchInput: '还没提交的文字',
    searchTerm: '拜年',
    boxes: [{ id: 1 }, { id: 2 }],
    page: 2,
    next: '/collections/?page=3',
  };
  listCollections.mockRejectedValueOnce(new Error('offline'));
  const refresh = page.refresh();
  expect(page.refreshing).toBe(true);
  expect(page.boxes).toHaveLength(2);
  await Promise.all([page.refresh(), page.load('append'), refresh]);

  expect(listCollections.mock.calls).toEqual([[{ search: '拜年', page: 1 }]]);
  expect(page).toMatchObject({
    searchInput: '还没提交的文字',
    boxes: [{ id: 1 }, { id: 2 }],
    page: 2,
    next: '/collections/?page=3',
    error: '',
    refreshing: false,
  });
  expect(page.refreshError).toContain('刷新失败');

  listCollections.mockResolvedValueOnce({ results: [{ id: 3 }], next: '/collections/?page=2' });
  await page.refresh();
  expect(listCollections).toHaveBeenLastCalledWith({ search: '拜年', page: 1 });
  expect(page).toMatchObject({
    boxes: [{ id: 3 }], page: 1, next: '/collections/?page=2', refreshError: '',
  });
});

it('ignores a refresh response after the user starts a new search', async () => {
  let resolveRefresh;
  listCollections.mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve; }));
  listCollections.mockResolvedValueOnce({ results: [{ id: 5 }] });
  const page = {
    ...CollectionIndex.data(),
    ...CollectionIndex.methods,
    searchTerm: '拜年',
    searchInput: '称呼',
  };

  const refresh = page.refresh();
  page.searchCollections();
  resolveRefresh({ results: [{ id: 4 }] });
  await refresh;

  expect(listCollections.mock.calls).toEqual([
    [{ search: '拜年', page: 1 }], [{ search: '称呼', page: 1 }],
  ]);
  expect(page.boxes).toEqual([{ id: 5 }]);
  expect(page.refreshing).toBe(false);
});
