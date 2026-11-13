import { describe, expect, it, vi } from 'vitest';
import { requireAuth } from '@/services/authGuard';
import { goRecord } from '@/services/navigation';

vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn() }));
vi.mock('@/services/navigation', async (importOriginal) => ({
  ...await importOriginal(), goRecord: vi.fn(),
}));
import RecordingDetail from '@/pages/recordings/details.vue';
import CollectionDetail from '@/pages/collections/details.vue';

const primary = { is_current: true, role: 'primary', status: 'accepted', entry: { id: 8 } };
const target = (entryLinks, extra = {}) => RecordingDetail.computed.recordingTarget.call({
  recording: { visibility: true, entry_links: entryLinks, ...extra },
});

describe('the recording detail contribution target', () => {
  it('uses the accepted primary entry without selecting a mention', () => {
    expect(target([{ ...primary, role: 'mention', entry: { id: 9 } }, primary])).toEqual({ id: 8 });
  });

  it.each(['suggested', 'disputed'])(
    'does not select an accepted primary while another primary is %s',
    (status) => {
      expect(target([primary, { ...primary, status, entry: { id: 9 } }])).toBeNull();
    },
  );

  it('ignores rejected and historical primary suggestions', () => {
    expect(target([
      primary,
      { ...primary, status: 'rejected', entry: { id: 9 } },
      { ...primary, status: 'suggested', is_current: false, entry: { id: 10 } },
    ])).toEqual({ id: 8 });
  });

  it('does not choose a private, pending, historical, or disputed target', () => {
    expect(target([primary], { visibility: false })).toBeNull();
    expect(target([{ ...primary, status: 'suggested' }])).toBeNull();
    expect(target([{ ...primary, is_current: false }])).toBeNull();
    expect(target([primary, { ...primary, role: 'competing', entry: { id: 9 } }])).toBeNull();
    expect(target([primary, { ...primary, entry: { id: 9 } }])).toBeNull();
  });
});


describe.each([['recording', RecordingDetail], ['collection', CollectionDetail]])('%s contribution navigation', (name, Page) => {
  it('preserves the entry for authentication without opening recording', () => {
    vi.clearAllMocks();
    requireAuth.mockReturnValue(false);
    Page.methods.recordFor(8);
    expect(requireAuth).toHaveBeenCalledWith('record_recording', { entryId: 8 });
    expect(goRecord).not.toHaveBeenCalled();
  });

  it('passes only the entry, without copying another speaker metadata', () => {
    vi.clearAllMocks();
    requireAuth.mockReturnValue(true);
    Page.methods.recordFor(8);
    expect(goRecord).toHaveBeenCalledWith({ entry_id: 8 });
  });
});
