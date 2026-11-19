import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import SoundLookup from '@/components/localtools/SoundLookup.vue';
import SearchPage from '@/pages/search.vue';
import { listAllDialects } from '@/services/guantou';
import request from '@/utils/request';

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

function pageContext() {
  return { ...SearchPage.data(), ...SearchPage.methods };
}

describe('returning from sound lookup to entry search', () => {
  beforeEach(() => {
    listAllDialects.mockResolvedValue([]);
    request.get.mockResolvedValue({ results: [] });
  });

  it.each(['WeChat', 'H5'])('round-trips the character and region through %s', async (platform) => {
    const dialect = '闽.莆仙.莆田.城里';
    const navigateTo = vi.fn();
    vi.stubGlobal('uni', { ...globalThis.uni, navigateTo });
    try {
      SoundLookup.methods.searchByCharacter.call({ dialect }, '红');
      const [{ url }] = navigateTo.mock.calls[0];
      const [path, query] = url.split('?');
      expect(path).toBe('/pages/search');
      expect(query).toContain('%E7%BA%A2');
      const options = platform === 'H5'
        ? Object.fromEntries(new URLSearchParams(query))
        : { sound_lookup: query.slice('sound_lookup='.length) };
      listAllDialects.mockResolvedValue([{ id: 23, qualified_code: dialect }]);
      const page = pageContext();
      await SearchPage.onLoad.call(page, options);
      expect(page.filters).toMatchObject({ keyword: '红', dialectId: 23 });
      expect(request.get).toHaveBeenCalledWith('/entries/', expect.objectContaining({
        search: '红', dialect_id: 23,
      }), true, { loading: false });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('preserves an existing shared keyword with a literal escape', async () => {
    const page = pageContext();
    await SearchPage.onLoad.call(page, { key: '行 %2F', sound_lookup: '%2525ZZ' });
    expect(page.filters.keyword).toBe('行 %2F');
  });
});
