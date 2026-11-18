import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

vi.mock('@/utils/request', () => ({
  default: {
    del: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const request = (await import('@/utils/request')).default;
const service = await import('@/services/entryRecording');

describe('Entry / Recording V2 service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the entry-first and recording resources', async () => {
    request.get.mockResolvedValue({ results: [] });
    request.post.mockResolvedValue({ id: 8 });
    const options = { canPresent: () => true, loading: false };

    await service.listEntries({ search: '行' });
    await service.listRecordings({ entry_id: 3 });
    await service.createRecording({ audio_url: 'https://example.test/a.mp3' }, options);

    expect(request.get).toHaveBeenNthCalledWith(1, '/entries/', { search: '行' }, true, { loading: false });
    expect(request.get).toHaveBeenNthCalledWith(2, '/recordings/', { entry_id: 3 }, true, { loading: false });
    expect(request.post).toHaveBeenCalledWith('/recordings/', {
      audio_url: 'https://example.test/a.mp3',
    }, false, options);
  });

  it('keeps false filter values and omits only empty filters', () => {
    expect(service.buildEntrySearchParams({
      keyword: '行',
      dialectId: 11,
      dialectMatch: 'subtree',
      hasRecording: false,
      ipa: '',
      page: 2,
    })).toEqual({
      search: '行',
      dialect_id: 11,
      dialect_scope: 'subtree',
      has_recording: false,
      page: 2,
    });
  });

  it('selects an accepted primary link without merging other interpretations', () => {
    const competing = { id: 2, role: 'competing', entry: { id: 9 } };
    const primary = {
      id: 1, role: 'primary', status: 'accepted', entry: { id: 7 },
    };
    const rejected = {
      id: 3, role: 'primary', status: 'rejected', entry: { id: 4 },
    };

    expect(service.primaryEntryLink({
      entry_links: [competing, rejected, primary],
    })).toBe(primary);
  });

  it('posts a scoped usage attestation', async () => {
    request.post.mockResolvedValue({ id: 10 });

    await service.createUsageAttestation('7', '11', ' 我这里常说 ');

    expect(request.post).toHaveBeenCalledWith('/usage-attestations/', {
      entry_id: 7,
      dialect_id: 11,
      note: '我这里常说',
    });
  });

  it('uses the private idempotent entry bookmark endpoints', async () => {
    request.get.mockResolvedValue({ results: [] });
    request.put.mockResolvedValue({ entry_id: 7, bookmarked: true });
    request.del.mockResolvedValue({ entry_id: 7, bookmarked: false });

    await service.listEntryBookmarks({ page: 2 });
    await service.bookmarkEntry(7);
    await service.unbookmarkEntry(7);

    expect(request.get).toHaveBeenCalledWith('/entries/bookmarks/', { page: 2 }, true, { loading: false });
    expect(request.put).toHaveBeenCalledWith('/entries/7/bookmark/', {});
    expect(request.del).toHaveBeenCalledWith('/entries/7/bookmark/');
  });

  it('exposes governance and contribution endpoints', async () => {
    request.get.mockResolvedValue({ results: [] });
    request.post.mockResolvedValue({ id: 12 });
    request.del.mockResolvedValue(null);

    await service.listCuratorApplications();
    await service.createCuratorApplication({ role: 'lexical' });
    await service.withdrawCuratorApplication(9);
    await service.listCuratorGrants({ active: true });
    await service.listCurationTasks();
    await service.createCurationAction({ action_type: 'review' });
    await service.getMyContributionHistory();

    expect(request.get).toHaveBeenCalledWith('/curator-applications/', {}, true, { loading: false });
    expect(request.post).toHaveBeenCalledWith('/curator-applications/', { role: 'lexical' });
    expect(request.del).toHaveBeenCalledWith('/curator-applications/9/');
    expect(request.get).toHaveBeenCalledWith('/curator-grants/', { active: true }, true, { loading: false });
    expect(request.get).toHaveBeenCalledWith('/curation/tasks/', {}, true, { loading: false });
    expect(request.post).toHaveBeenCalledWith('/curation/actions/', { action_type: 'review' });
    expect(request.get).toHaveBeenCalledWith('/contributions/me/', {}, true, { loading: false });
  });
});
