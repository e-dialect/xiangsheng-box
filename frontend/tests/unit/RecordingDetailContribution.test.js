import { describe, expect, it } from 'vitest';
import RecordingDetail from '@/pages/recordings/details.vue';

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
