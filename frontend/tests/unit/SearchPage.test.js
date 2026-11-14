import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/utils/httpClient', () => ({
  request: vi.fn(() => Promise.resolve({ accepted: 1 })),
}));

vi.mock('@/services/guantou', () => ({
  listAllDialects: vi.fn(async () => []),
}));

const request = (await import('@/utils/request')).default;
const { listAllDialects } = await import('@/services/guantou');
const { request: analyticsRequest } = await import('@/utils/httpClient');
const SearchPage = (await import('@/pages/search.vue')).default;

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function pageContext() {
  return {
    ...SearchPage.data(),
    ...SearchPage.methods,
  };
}

describe('entry-first search page orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAllDialects.mockReset().mockResolvedValue([]);
  });

  it('starts a shared keyword search before the optional region catalog settles', async () => {
    const catalog = deferred();
    listAllDialects.mockReturnValueOnce(catalog.promise);
    const page = pageContext();
    page.search = vi.fn().mockResolvedValue();
    request.get.mockResolvedValue({ results: [] });

    const loading = SearchPage.onLoad.call(page, { key: 'hiŋ' });
    await Promise.resolve();
    const callsBeforeCatalog = page.search.mock.calls.length;
    catalog.resolve([{ id: 1, name: '莆仙方言' }]);
    await loading;

    expect(callsBeforeCatalog).toBe(1);
    expect(page.search).toHaveBeenCalledOnce();
  });

  it('reports a failed region catalog and retries without replacing search state', async () => {
    const page = pageContext();
    page.filters.keyword = '行';
    page.filters.dialectId = 23;
    page.filters.hasRecording = false;
    page.entries = [{ id: 7 }];
    page.appliedFilters = { ...page.filters, keyword: '前次查询', hasRecording: true };
    const appliedFilters = { ...page.appliedFilters };
    page.next = '/entries/?page=2';
    listAllDialects.mockRejectedValueOnce(new Error('offline'));

    await page.loadDialects();
    expect(page.dialectsError).toBeTruthy();
    expect(page.dialectsLoading).toBe(false);

    const filters = { ...page.filters };
    listAllDialects.mockResolvedValueOnce([{ id: 23, name: '城里' }]);
    await page.loadDialects();
    expect(page.dialects).toEqual([{ id: 23, name: '城里' }]);
    expect(page.dialectsError).toBe('');
    expect(page.filters).toEqual(filters);
    expect(page.appliedFilters).toEqual(appliedFilters);
    expect(page.entries).toEqual([{ id: 7 }]);
    expect(page.next).toBe('/entries/?page=2');
    expect(request.get).not.toHaveBeenCalled();
  });

  it('makes an empty region catalog recoverable', async () => {
    const page = pageContext();
    await page.loadDialects();
    expect(page.dialectsError).toBeTruthy();
    expect(page.dialectsLoading).toBe(false);
  });

  it('admits only one region retry at a time', async () => {
    const catalog = deferred();
    listAllDialects.mockReturnValueOnce(catalog.promise);
    const page = pageContext();
    const first = page.loadDialects();
    const second = page.loadDialects();
    expect(page.dialectsLoading).toBe(true);
    expect(listAllDialects).toHaveBeenCalledOnce();
    catalog.resolve([{ id: 1, name: '莆仙方言' }]);
    await Promise.all([first, second]);
    expect(page.dialectsLoading).toBe(false);
  });

  it('keeps existing region choices when refreshing the catalog fails', async () => {
    const page = pageContext();
    page.dialects = [{ id: 23, name: '城里' }];
    page.filters.dialectId = 23;
    listAllDialects.mockRejectedValueOnce(new Error('offline'));
    await page.loadDialects();
    expect(page.dialects).toEqual([{ id: 23, name: '城里' }]);
    expect(page.filters.dialectId).toBe(23);
  });

  it('round-trips the submitted keyword in WeChat without the draft or filters', async () => {
    const page = pageContext();
    page.submittedKeyword = '行 & hiŋ+? %2F';
    page.filters.keyword = '尚未提交';
    page.filters.dialectId = 12;
    page.entries = [{ id: 1 }];
    Object.defineProperty(page, 'keywordShare', {
      get: () => SearchPage.computed.keywordShare.call(page),
    });

    const friend = SearchPage.onShareAppMessage.call(page);
    const timeline = SearchPage.onShareTimeline.call(page);
    expect(friend.path).toBe('/pages/search?sharedKeyword=%E8%A1%8C%20%26%20hi%C5%8B%2B%3F%20%252F');
    expect(friend.title).toContain(page.submittedKeyword);
    expect(timeline).toEqual({
      title: friend.title,
      query: friend.path.split('?')[1],
      imageUrl: '/static/share-cover.png',
    });
    request.get.mockResolvedValue({ results: [] });
    const recipient = pageContext();
    await SearchPage.onLoad.call(recipient, { sharedKeyword: timeline.query.split('=')[1] });
    expect(recipient.filters.keyword).toBe(page.submittedKeyword);
    expect(request.get).toHaveBeenCalledWith('/entries/', expect.objectContaining({
      search: page.submittedKeyword,
    }), true, { loading: false });
    page.loading = true;
    expect(SearchPage.onShareAppMessage.call(page).path).toBe('/pages/search');
    expect(SearchPage.onShareTimeline.call(page).query).toBe('sharedKeyword=');
  });

  it('keeps same-writing results as separate entries', async () => {
    const page = pageContext();
    page.filters.keyword = '行';
    request.get.mockResolvedValue({
      count: 2,
      next: null,
      results: [
        { id: 1, display_writing: '行', summary: '步行' },
        { id: 2, display_writing: '行', summary: '银行用字' },
      ],
    });

    await page.search();

    expect(request.get).toHaveBeenCalledWith('/entries/', expect.objectContaining({
      search: '行',
      page: 1,
      page_size: 20,
    }), true, { loading: false });
    expect(page.entries.map((entry) => entry.id)).toEqual([1, 2]);
    expect(page.total).toBe(2);
    expect(analyticsRequest).toHaveBeenCalledWith(
      'POST',
      '/product-events/',
      expect.objectContaining({
        event_name: 'entry_search',
        result: 'success',
        metadata: { result_bucket: '1-5', filter_count: 0 },
      }),
      expect.objectContaining({ auth: false, visitor: false, loading: false }),
    );
    expect(JSON.stringify(analyticsRequest.mock.calls[0])).not.toContain('银行用字');
  });

  it('uses the extracted term when paging without replacing the question or selected region', async () => {
    const page = pageContext();
    Object.assign(page.filters, { keyword: '「行」怎么读？', dialectId: 23, dialectMatch: 'exact' });
    request.get.mockResolvedValueOnce({ results: [{ id: 1 }], next: '/entries/?page=2' })
      .mockResolvedValueOnce({ results: [{ id: 2 }], next: null });

    await page.search();
    page.filters.keyword = '正在编辑的下一句';
    await page.loadMore();

    const calls = request.get.mock.calls.map(([, params]) => params);
    expect(calls).toEqual([1, 2].map((number) => expect.objectContaining({
      search: '行', dialect_id: 23, dialect_scope: 'exact', page: number,
    })));
    expect(page.submittedKeyword).toBe('「行」怎么读？');
    expect(page.filters.keyword).toBe('正在编辑的下一句');
    expect(page.entries.map(({ id }) => id)).toEqual([1, 2]);
  });

  it.each([
    ['害怕什么意思？', '害怕'],
    ['“银行 行业”是什么意思？', '银行 行业'],
    ['行哪里这样说', '行'],
    [' hiŋ ', 'hiŋ'],
    ['害怕莆田话怎么说？', '害怕莆田话怎么说？'],
    ['行在莆田怎么读？', '行在莆田怎么读？'],
    ['怎么读？', '怎么读？'],
  ])('uses %s as a question or a literal keyword', (input, expected) => {
    const page = pageContext();
    page.filters.keyword = input;
    expect(page.requestParams(1).search).toBe(expected);
  });

  it('preserves false and exact values in advanced filters', () => {
    const page = pageContext();
    page.filters.dialectId = 23;
    page.filters.dialectMatch = 'exact';
    page.filters.hasRecording = false;
    page.filters.ipa = 'hiŋ';

    expect(page.requestParams(3)).toMatchObject({
      dialect_id: 23,
      dialect_scope: 'exact',
      has_recording: false,
      ipa: 'hiŋ',
      page: 3,
    });
  });

  it('discards a stale search response after a newer query wins', async () => {
    const first = deferred();
    const second = deferred();
    request.get
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const page = pageContext();

    page.filters.keyword = '月';
    const firstRequest = page.search();
    page.filters.keyword = '月亮';
    const secondRequest = page.search();
    second.resolve({ results: [{ id: 2, display_writing: '月亮' }], count: 1 });
    await secondRequest;
    first.resolve({ results: [{ id: 1, display_writing: '月' }], count: 1 });
    await firstRequest;

    expect(page.entries).toHaveLength(1);
    expect(page.entries[0].display_writing).toBe('月亮');
  });

  it('starts a suggested search without changing filter semantics', () => {
    const page = pageContext();
    page.filters.hasRecording = false;
    page.search = vi.fn();

    page.quickSearch('hiŋ');

    expect(page.filters.keyword).toBe('hiŋ');
    expect(page.filters.hasRecording).toBe(false);
    expect(page.search).toHaveBeenCalledOnce();
  });

  it('clears advanced filters while preserving the current query', () => {
    const page = pageContext();
    page.filters = {
      ...page.filters,
      keyword: '害怕',
      dialectId: 23,
      dialectMatch: 'exact',
      hasRecording: false,
      sourceType: 'fieldwork',
    };
    page.search = vi.fn();

    page.resetAdvancedFilters();

    expect(page.filters).toMatchObject({
      keyword: '害怕',
      dialectId: '',
      dialectMatch: 'subtree',
      hasRecording: '',
      sourceType: '',
    });
    expect(page.search).toHaveBeenCalledOnce();
  });

  it('keeps later pages on the applied filters until the user applies new choices', async () => {
    const page = pageContext();
    page.filters.keyword = '行';
    request.get.mockResolvedValueOnce({ results: [{ id: 1 }], next: '/entries/?page=2' });
    await page.search();

    page.openSections = ['advanced'];
    page.filters.hasRecording = true;
    request.get.mockResolvedValueOnce({ results: [{ id: 2 }], next: null });
    await page.loadMore();
    expect(request.get.mock.calls[1][1]).toMatchObject({ search: '行', page: 2 });
    expect(request.get.mock.calls[1][1]).not.toHaveProperty('has_recording');
    expect(page.entries.map((entry) => entry.id)).toEqual([1, 2]);

    request.get.mockResolvedValueOnce({ results: [{ id: 3 }], next: null });
    await page.applyAdvancedFilters();
    expect(page.openSections).toEqual([]);
    expect(request.get.mock.calls[2][1]).toMatchObject({ page: 1, has_recording: true });
    expect(page.entries.map((entry) => entry.id)).toEqual([3]);
  });

  it('discards an old next page after a new search starts', async () => {
    const page = pageContext();
    const oldNext = deferred();
    request.get.mockResolvedValueOnce({ results: [{ id: 1 }], next: '/entries/?page=2' });
    await page.search();
    request.get.mockReturnValueOnce(oldNext.promise);
    const oldLoad = page.loadMore();

    page.filters.hasRecording = false;
    request.get.mockResolvedValueOnce({ results: [{ id: 3 }], next: null });
    await page.applyAdvancedFilters();
    oldNext.resolve({ results: [{ id: 2 }], next: '/entries/?page=3' });
    await oldLoad;

    expect(page.entries.map((entry) => entry.id)).toEqual([3]);
    expect(page.next).toBeNull();
    expect(page.loadingMore).toBe(false);
  });
});
