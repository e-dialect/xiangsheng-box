import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { canUseNativeMiniProgramShare, isQQMiniProgram } from '@/services/platform';
import { ROUTES } from '@/services/navigation';
import EntryDetails from '@/pages/entries/details.vue';
import RecordingDetails from '@/pages/recordings/details.vue';

vi.mock('@/services/platform', async (importOriginal) => ({
  ...await importOriginal(),
  canUseNativeMiniProgramShare: vi.fn(() => false),
  isQQMiniProgram: vi.fn(() => false),
}));

const cases = [
  ['entry', EntryDetails, 'entry', ROUTES.entryDetail],
  ['recording', RecordingDetails, 'recording', ROUTES.recordingDetail],
];

describe.each(cases)('%s native sharing', (name, page, field, route) => {
  beforeEach(() => {
    vi.clearAllMocks();
    isQQMiniProgram.mockReturnValue(false);
  });

  it('uses native sharing on supported mini-program targets and link sharing on H5', () => {
    canUseNativeMiniProgramShare.mockReturnValue(true);
    expect(page.computed.shareType()).toBe('share');
    canUseNativeMiniProgramShare.mockReturnValue(false);
    expect(page.computed.shareType()).toBe('');
  });

  it('returns the public detail destination from the native share callback', () => {
    const shareMessage = page.computed.shareMessage.call({
      [field]: {
        id: 42, visibility: true, summary: '走路', original_gloss: '走路',
      },
      loading: false,
    });
    expect(page.onShareAppMessage.call({ shareMessage })).toMatchObject({
      path: `${route}?id=42`,
    });
  });

  it('keeps private content out of native share payloads', () => {
    const shareMessage = page.computed.shareMessage.call({
      [field]: { id: 42, visibility: false },
      loading: false,
    });
    expect(shareMessage).toBeNull();
    expect(page.onShareAppMessage.call({ shareMessage })).toMatchObject({ path: ROUTES.home });
  });

  it('returns the QQ launch query for the public detail', () => {
    isQQMiniProgram.mockReturnValue(true);
    const shareMessage = page.computed.shareMessage.call({
      [field]: {
        id: 42, visibility: true, summary: '走路', original_gloss: '走路',
      },
      loading: false,
    });
    const payload = page.onShareAppMessage.call({ shareMessage });
    expect(payload).toMatchObject({ query: `box_share=${name}&id=42` });
    expect(payload).not.toHaveProperty('path');
    expect(page.onShareAppMessage.call({ shareMessage: null })).not.toHaveProperty('query');
  });
});
