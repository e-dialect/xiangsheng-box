import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import {
  collectionShareMessage, entryShareMessage, openQQSharedContent,
  qqContentShareMessage, recordingShareMessage,
} from '@/services/contentShare';

const dialect = {
  path_names: ['闽语', '莆仙方言', '仙游'],
  qualified_code: 'private-internal-code',
};

describe('public content share cards', () => {
  it('uses the Entry meaning when the writing is missing and opens that Entry', () => {
    expect(entryShareMessage({
      id: 12, visibility: true, summary: '走路', usage_dialect: dialect,
    })).toEqual({
      title: '词条｜走路 · 仙游',
      path: '/pages/entries/details?id=12',
      query: 'id=12',
    });
  });

  it('uses the Recording meaning and omits contributor information', () => {
    expect(recordingShareMessage({
      id: 34,
      visibility: true,
      original_gloss: '  走路\n 回家 ',
      recorder: { username: 'internal-account' },
    })).toEqual({
      title: '乡音｜走路 回家 · 地区待补充',
      path: '/pages/recordings/details?id=34',
      query: 'id=34',
    });
  });

  it('uses the meaning to distinguish Entries with the same writing', () => {
    expect(entryShareMessage({
      id: 21, visibility: true, display_writing: '行', summary: '步行', usage_dialect: dialect,
    })?.title).toBe('词条｜行 · 步行 · 仙游');
  });

  it('does not create cards for private or withdrawn content', () => {
    expect(entryShareMessage({ id: 1, visibility: false })).toBeNull();
    expect(entryShareMessage({ id: 1, visibility: true, status: 'redirected' })).toBeNull();
    expect(recordingShareMessage({ id: 2 })).toBeNull();
    expect(recordingShareMessage({ id: 2, visibility: true, status: 'rejected' })).toBeNull();
  });

  it('shares a public collection with its saved title and excludes private collections', () => {
    expect(collectionShareMessage({
      id: 7, is_public: true, title: '  春节\n 问候  ', description: '盒签简介',
    })).toEqual({
      title: '集盒｜春节 问候',
      path: '/pages/collections/details?id=7',
      query: 'id=7',
    });
    expect(collectionShareMessage({ id: 7, is_public: false, title: '私人' })).toBeNull();
  });
});

describe('QQ mini-program share destination', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses a typed QQ query for public content and omits private destinations', () => {
    const message = entryShareMessage({ id: 12, visibility: true, summary: '走路' });
    expect(qqContentShareMessage(message, 'entry')).toMatchObject({
      query: 'box_share=entry&id=12',
    });
    expect(qqContentShareMessage(null, 'recording')).not.toHaveProperty('query');
  });

  it('opens a shared recording when cold and a shared entry when already open', () => {
    const uni = { reLaunch: vi.fn(), navigateTo: vi.fn() };
    const getCurrentPages = vi.fn(() => []);
    vi.stubGlobal('uni', uni);
    vi.stubGlobal('getCurrentPages', getCurrentPages);
    openQQSharedContent({ box_share: 'recording', id: '34' });
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/recordings/details?id=34' });
    getCurrentPages.mockReturnValue([{ route: 'pages/index' }]);
    openQQSharedContent({ box_share: 'entry', id: '12' });
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/entries/details?id=12' });
  });

  it('opens a shared public collection from its QQ launch query', () => {
    vi.stubGlobal('uni', { reLaunch: vi.fn(), navigateTo: vi.fn() });
    vi.stubGlobal('getCurrentPages', () => []);
    openQQSharedContent({ box_share: 'collection', id: '19' });
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/collections/details?id=19' });
  });

  it('ignores invalid routes and IDs and does not reopen the current item', () => {
    const uni = { reLaunch: vi.fn(), navigateTo: vi.fn() };
    vi.stubGlobal('uni', uni);
    vi.stubGlobal('getCurrentPages', () => [{
      route: 'pages/entries/details', options: { id: 12 },
    }]);
    openQQSharedContent({ box_share: '/pages/users/me', id: '12' });
    openQQSharedContent({ box_share: 'entry', id: '12?private=true' });
    openQQSharedContent({ box_share: 'entry', id: '12' });
    expect(uni.reLaunch).not.toHaveBeenCalled();
    expect(uni.navigateTo).not.toHaveBeenCalled();
  });
});
