import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import RecordingDetails from '@/pages/recordings/details.vue';
import { createCurationAction, resubmitRecording } from '@/services/entryRecording';
import { uploadFile } from '@/services/file';

vi.mock('@/services/entryRecording', async (original) => ({
  ...(await original()),
  createCurationAction: vi.fn(),
  resubmitRecording: vi.fn(),
}));
vi.mock('@/services/file', () => ({ chooseAudioFile: vi.fn(), uploadFile: vi.fn() }));

const sessionToken = 'test-moderation-session';
function pageContext(refName, validate) {
  return {
    ...RecordingDetails.data(),
    ...RecordingDetails.methods,
    id: 42,
    recording: { updated_at: 'revision-before-review' },
    revision: { original_gloss: ' 修订含义 ', speaker_consent_source: 'self', speaker_label: '' },
    replacement: { path: '/replacement.wav' },
    takedown: { reason: ' 说明为何下架 ' },
    sessionToken,
    $refs: { [refName]: { validate } },
    load: vi.fn(),
  };
}

describe.each([
  ['resubmit', 'revisionForm', resubmitRecording],
  ['takeDown', 'takedownForm', createCurationAction],
])('%s moderation form', (method, refName, mutate) => {
  beforeEach(() => {
    vi.stubGlobal('uni', { getStorageSync: () => sessionToken });
    uploadFile.mockResolvedValue({ url: '/replacement-media' });
  });

  it('keeps edits and skips mutations when the shared form does not validate', async () => {
    const validate = vi.fn()
      .mockResolvedValueOnce({ invalid: true })
      .mockResolvedValueOnce(undefined);
    const page = pageContext(refName, validate);
    await page[method]();
    await page[method]();
    expect(validate).toHaveBeenCalledTimes(2);
    expect(uploadFile).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
    expect(page.load).not.toHaveBeenCalled();
    expect(page.busy).toBe(false);
  });

  it('awaits one validation across repeated submissions and preserves the request payload', async () => {
    let finish;
    const validate = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const page = pageContext(refName, validate);
    const first = page[method]();
    await page[method]();
    expect(validate).toHaveBeenCalledOnce();
    expect(mutate).not.toHaveBeenCalled();
    expect(uploadFile).not.toHaveBeenCalled();
    finish(true);
    await first;
    expect(mutate).toHaveBeenCalledOnce();
    if (method === 'resubmit') {
      expect(resubmitRecording).toHaveBeenCalledWith(42, {
        original_gloss: '修订含义',
        publication_consent: 'public-display-v1',
        speaker_consent_source: 'self',
        speaker_label: '',
        audio_url: '/replacement-media',
      });
    } else {
      expect(createCurationAction).toHaveBeenCalledWith({
        target_type: 'recording',
        target_id: 42,
        action_type: 'review',
        changes: { status: 'rejected', revision: 'revision-before-review' },
        reason: '说明为何下架',
      });
    }
    expect(page.load).toHaveBeenCalledOnce();
    expect(page.busy).toBe(false);
  });

  it('discards a successful validation if the session changes while it is pending', async () => {
    const validate = vi.fn(async () => {
      vi.stubGlobal('uni', { getStorageSync: () => 'different-session' });
      return true;
    });
    const page = pageContext(refName, validate);
    await page[method]();
    expect(uploadFile).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
    expect(page.load).not.toHaveBeenCalled();
  });
});
