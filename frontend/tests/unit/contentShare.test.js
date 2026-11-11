import { describe, expect, it } from 'vitest';
import { entryShareMessage, recordingShareMessage } from '@/services/contentShare';

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
});
