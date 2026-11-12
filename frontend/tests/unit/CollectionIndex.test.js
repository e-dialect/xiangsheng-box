import { expect, it, vi } from 'vitest';

vi.mock('@/services/collections', () => ({
  listCollections: vi.fn(),
  createCollection: vi.fn(),
}));

const { listCollections } = await import('@/services/collections');
const { default: CollectionIndex } = await import('@/pages/collections/index.vue');

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

  expect(listCollections.mock.calls).toEqual([[{ search: '拜年', page: 1 }], [{ mine: true, page: 1 }]]);
  expect(page.boxes.map((box) => box.id)).toEqual([8]);
  expect(page.loading).toBe(false);
});
