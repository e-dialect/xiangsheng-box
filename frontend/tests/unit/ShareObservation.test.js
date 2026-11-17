import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

vi.mock('@/services/feedback', () => ({ notify: vi.fn() }));

function fetchEvents() {
  return window.fetch.mock.calls.map(([, options]) => JSON.parse(options.body));
}

describe('anonymous H5 shares', () => {
  let observeSharedOpen;
  let sharePage;
  let markWebShareUrl;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('uni', {
      getSystemInfoSync: () => ({ uniPlatform: 'web' }),
      setClipboardData: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    ({ observeSharedOpen, markWebShareUrl } = await import('@/services/shareObservation'));
    ({ sharePage } = await import('@/services/pageShare'));
  });

  afterEach(() => {
    delete navigator.share;
    delete navigator.canShare;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['/pages/collections/details?id=42', 'collection'],
    ['/pages/entries/details?id=43', 'entry'],
    ['/pages/recordings/details?id=44', 'recording'],
    ['/pages/search?key=%E4%B9%A1%E9%9F%B3', 'search'],
    ['/pages/tools/local?dialect=pxm&tool=quiz&quiz=version-1', 'quiz'],
  ])('marks supported mounted targets without changing their destination', (path, kind) => {
    const original = new URL(`https://example.test/preview${path}`);
    const marked = markWebShareUrl(original.href, '/preview/');
    const result = new URL(marked.url);
    expect(marked.kind).toBe(kind);
    expect(result.searchParams.get('share_kind')).toBe(kind);
    result.searchParams.delete('share_kind');
    expect(result.href).toBe(original.href);
  });

  it('counts actual clipboard success or failure and sends no content identifiers', async () => {
    const title = '方言原始词';
    const path = '/pages/search?key=%E6%96%B9%E8%A8%80%E5%8E%9F%E5%A7%8B%E8%AF%8D';
    await sharePage({ title, path }, '已复制');
    expect(window.fetch).not.toHaveBeenCalled();

    const clipboard = uni.setClipboardData.mock.calls[0][0];
    expect(new URL(clipboard.data).searchParams.get('key')).toBe(title);
    clipboard.success();
    await sharePage({ title, path }, '已复制');
    uni.setClipboardData.mock.calls[1][0].fail();

    const events = fetchEvents();
    expect(events.map((item) => item.result)).toEqual(['success', 'error']);
    expect(events[0]).toMatchObject({
      event_name: 'share_clipboard', platform: 'h5', surface: 'search', metadata: {},
    });
    expect(Object.keys(events[0]).sort()).toEqual([
      'event_name', 'metadata', 'platform', 'result', 'session_id', 'surface',
    ]);
    expect(JSON.stringify(events)).not.toContain(title);
    expect(window.fetch.mock.calls[0][1]).toMatchObject({
      credentials: 'omit', referrerPolicy: 'strict-origin', keepalive: true,
    });
  });

  it('counts system attempts and cancellation without copying on cancellation', async () => {
    navigator.share = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'));
    navigator.canShare = vi.fn(() => true);
    const path = '/pages/entries/details?id=42';
    await sharePage({ title: '词条', path }, '已复制');

    expect(uni.setClipboardData).not.toHaveBeenCalled();
    expect(fetchEvents().map((item) => [item.event_name, item.result])).toEqual([
      ['share_system', 'attempt'], ['share_system', 'cancelled'],
    ]);
    expect(navigator.share.mock.calls[0][0].url).toContain('share_kind=entry');
  });

  it('records system API success, and falls back on a non-cancellation rejection', async () => {
    navigator.share = vi.fn().mockResolvedValueOnce().mockRejectedValueOnce(new Error('blocked'));
    const message = { title: '乡音', path: '/pages/recordings/details?id=42' };
    await sharePage(message, '已复制');
    await sharePage(message, '已复制');
    uni.setClipboardData.mock.calls[0][0].success();

    expect(fetchEvents().map((item) => [item.event_name, item.result])).toEqual([
      ['share_system', 'attempt'],
      ['share_system', 'success'],
      ['share_system', 'attempt'],
      ['share_system', 'error'],
      ['share_clipboard', 'success'],
    ]);
  });

  function setLanding(initialPath, livePath) {
    const firstUrl = new URL(initialPath, window.location.origin);
    Object.defineProperty(window.performance, 'getEntriesByType', {
      configurable: true,
      value: () => [{ name: firstUrl.href }],
    });
    window.history.replaceState({}, '', livePath);
  }

  it('counts one successfully loaded exact target on the original document navigation', () => {
    const path = '/pages/tools/local?dialect=pxm&tool=quiz&quiz=version-1';
    const marked = `${path}&share_kind=quiz`;
    setLanding(marked, marked);
    observeSharedOpen(path.replace('version-1', 'version-2'));
    expect(window.fetch).not.toHaveBeenCalled();
    observeSharedOpen(path);
    observeSharedOpen(path);
    expect(fetchEvents()).toMatchObject([{ event_name: 'share_opened', surface: 'quiz' }]);
    expect(JSON.stringify(fetchEvents())).not.toContain('version-1');
  });

  it('classifies filter-only links and compares the normalized applied criteria', () => {
    const path = '/pages/search?filters=%7B%22dialectId%22%3A42%2C%22hasRecording%22%3Afalse%7D';
    const marked = markWebShareUrl(new URL(path, window.location.origin).href, '/');
    expect(marked.kind).toBe('search');
    setLanding(marked.url, marked.url);
    const otherDialect = '/pages/search?filters=%7B%22dialectId%22%3A43%2C%22hasRecording%22%3Afalse%7D';
    observeSharedOpen(otherDialect);
    expect(window.fetch).not.toHaveBeenCalled();
    const sameApplied = '/pages/search?filters=%7B%22hasRecording%22%3Afalse%2C%22dialectId%22%3A%2242%22%7D';
    observeSharedOpen(sameApplied);
    expect(fetchEvents()).toMatchObject([{ event_name: 'share_opened', surface: 'search' }]);
    expect(fetchEvents()[0].metadata).toEqual({});
    expect(fetchEvents()[0]).not.toHaveProperty('filters');
  });

  it('requires filters to match even if a modified search retains the same word', () => {
    const path = '/pages/search?key=alpha&filters=%7B%22source%22%3A%22privateSource%22%7D';
    const marked = `${path}&share_kind=search`;
    setLanding(marked, marked);
    observeSharedOpen(path.replace('privateSource', 'otherSource'));
    observeSharedOpen('/pages/search?key=alpha');
    expect(window.fetch).not.toHaveBeenCalled();
    observeSharedOpen(path);
    expect(fetchEvents()).toMatchObject([{ event_name: 'share_opened', surface: 'search' }]);
    expect(JSON.stringify(fetchEvents())).not.toContain('privateSource');
    expect(JSON.stringify(fetchEvents())).not.toContain('alpha');
  });

  it('ignores in-app navigations and unmarked or incorrectly marked direct opens', () => {
    const path = '/pages/recordings/details?id=8';
    setLanding('/', `${path}&share_kind=recording`);
    observeSharedOpen(path);
    setLanding(path, path);
    observeSharedOpen(path);
    setLanding(`${path}&share_kind=entry`, `${path}&share_kind=entry`);
    observeSharedOpen(path);
    expect(window.fetch).not.toHaveBeenCalled();
  });
});
