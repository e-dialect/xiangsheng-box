import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

vi.mock('@/services/entryRecording', () => ({
  createRecording: vi.fn(),
  createUsageAttestation: vi.fn(),
  dialectLabel: vi.fn((dialect) => dialect?.name || '地区待补充'),
  entryTitle: vi.fn((entry) => entry?.display_writing || entry?.summary || '待整理词条'),
  getEntry: vi.fn(),
  listEntries: vi.fn(),
  listRecordings: vi.fn(),
  pageResults: vi.fn((response) => response?.results || response || []),
  primaryEntryLink: vi.fn((recording) => (
    recording?.entry_links?.find((link) => link.role === 'primary') || null
  )),
}));

vi.mock('@/services/authGuard', () => ({
  requireAuth: vi.fn(() => true),
}));

vi.mock('@/services/file', () => ({
  uploadFile: vi.fn(),
  chooseAudioFile: vi.fn(),
  supportsAudioFileSelection: vi.fn(() => true),
}));

vi.mock('@/services/feedback', () => ({
  notify: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('@/services/capabilities', () => ({
  CAPABILITIES: {
    RECORDING: 'recording',
    USAGE_ATTESTATION: 'usage_attestation',
  },
  ensureCapability: vi.fn(() => true),
}));

vi.mock('@/services/productAnalytics', () => ({
  PRODUCT_EVENTS: {
    RECORDING_SUBMIT: 'recording_submit',
    EVIDENCE_SUBMIT: 'evidence_submit',
  },
  trackProductEvent: vi.fn(),
}));

vi.mock('@/services/guantou', () => ({
  listAllDialects: vi.fn(async () => []),
}));

vi.mock('@/services/navigation', () => ({
  goRecordingDetail: vi.fn(),
  goRecordingDrafts: vi.fn(),
  goEntryDetail: vi.fn(),
  goHome: vi.fn(),
  goRecord: vi.fn(),
  goBack: vi.fn(),
  ROUTES: { home: '/pages/index' },
}));

const entryRecording = await import('@/services/entryRecording');
const { requireAuth } = await import('@/services/authGuard');
const { uploadFile } = await import('@/services/file');
const { notifySuccess } = await import('@/services/feedback');
const { goRecordingDetail, goRecord } = await import('@/services/navigation');
const { trackProductEvent } = await import('@/services/productAnalytics');
const RecordingFeed = (await import('@/components/home/RecordingFeed.vue')).default;
const RecordingCreate = (await import('@/pages/recordings/create.vue')).default;
const EntryDetails = (await import('@/pages/entries/details.vue')).default;

function context(Component, extra = {}) {
  return {
    ...Component.data(),
    ...Component.methods,
    ...extra,
  };
}

describe('V2 listening flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { showToast: vi.fn(), getStorageSync: vi.fn(() => 1) };
    globalThis.getApp = vi.fn(() => ({ globalData: { userInfo: {} } }));
  });

  it('loads recording resources and keeps their linked entry identity', async () => {
    const recording = {
      id: 4,
      usage_dialect: { id: 11, name: '莆仙方言' },
      entry_links: [{ role: 'primary', entry: { id: 7, display_writing: '行' } }],
    };
    entryRecording.listRecordings.mockResolvedValue({ results: [recording], next: null });
    const feed = context(RecordingFeed, { tab: 'recommended' });

    await feed.reload();

    expect(entryRecording.listRecordings).toHaveBeenCalledWith({ page: 1, page_size: 12 });
    expect(feed.items[0].entry_links[0].entry.id).toBe(7);
  });

  it('records an attestation and starts a regional comparison chain', async () => {
    entryRecording.createUsageAttestation.mockResolvedValue({ id: 3 });
    const feed = context(RecordingFeed, { tab: 'recommended' });

    await feed.attest({ entryId: 7, dialectId: 11 });
    feed.continueChain(7);

    expect(entryRecording.createUsageAttestation).toHaveBeenCalledWith(7, 11);
    expect(feed.attestedEntries.has(7)).toBe(true);
    expect(goRecord).toHaveBeenCalledWith({ entry_id: 7 });
  });
});

describe('low-threshold recording flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { showToast: vi.fn(), getStorageSync: vi.fn(() => 1) };
    globalThis.getApp = vi.fn(() => ({ globalData: { userInfo: {} } }));
  });

  it('submits with only audio, usage region, and a plain-language gloss', async () => {
    uploadFile.mockResolvedValue({
      url: 'https://example.test/voice.mp3',
      duration_ms: 2300,
    });
    entryRecording.createRecording.mockResolvedValue({
      id: 9,
      entry_links: [{ role: 'primary', entry: { id: 17 } }],
    });
    const page = context(RecordingCreate, {
      $refs: { form: { validate: vi.fn(async () => true) } },
      ownerScope: 'user:1',
      draftReady: true,
    });
    page.audio = { path: '/tmp/voice.mp3', durationMs: 2300 };
    page.form.usage_dialect_id = 11;
    page.form.original_gloss = '表示害怕的意思';

    await page.submit();

    expect(entryRecording.createRecording).toHaveBeenCalledWith(expect.objectContaining({
      audio_url: 'https://example.test/voice.mp3',
      usage_dialect_id: 11,
      original_gloss: '表示害怕的意思',
      original_writing: '',
      original_pronunciation: '',
    }));
    expect(notifySuccess).toHaveBeenCalled();
    expect(goRecordingDetail).toHaveBeenCalledWith(9, { replace: true });
    expect(trackProductEvent).toHaveBeenCalledWith('recording_submit', {
      surface: 'record',
      result: 'success',
      metadata: { has_linked_entry: false },
    });
  });

  it('intercepts a direct guest deep link before loading or uploading', async () => {
    requireAuth.mockReturnValueOnce(false);

    await RecordingCreate.onLoad.call(context(RecordingCreate), {});

    expect(requireAuth).toHaveBeenCalledWith('record_recording', { page: 'record' });
    expect(entryRecording.createRecording).not.toHaveBeenCalled();
  });

  it('does not require a writing or IPA before validation succeeds', async () => {
    const page = context(RecordingCreate, {
      $refs: { form: { validate: vi.fn(async () => true) } },
      ownerScope: 'user:1',
      draftReady: true,
    });
    page.audio = { path: '/tmp/voice.mp3', durationMs: 1200 };
    page.form.usage_dialect_id = 11;
    page.form.original_gloss = '意思还不太确定';

    expect(await page.validateForm()).toBe(true);
    expect(page.form.original_writing).toBe('');
    expect(page.form.original_pronunciation).toBe('');
  });

  it('exposes the three required steps without treating professional fields as progress', () => {
    const page = context(RecordingCreate);
    page.audio = { path: '/tmp/voice.mp3', durationMs: 1200, invalid: false };
    page.form.usage_dialect_id = 11;
    page.form.original_writing = '行';
    page.form.original_pronunciation = 'hiŋ';

    const stepsBeforeGloss = RecordingCreate.computed.requiredSteps.call(page);
    expect(stepsBeforeGloss.map((step) => ({
      key: step.key,
      complete: step.complete,
      current: step.current,
    }))).toEqual([
      { key: 'audio', complete: true, current: false },
      { key: 'dialect', complete: true, current: false },
      { key: 'gloss', complete: false, current: true },
    ]);

    page.form.original_gloss = '表示可以通行';
    const completedSteps = RecordingCreate.computed.requiredSteps.call(page);
    expect(completedSteps.every((step) => step.complete)).toBe(true);
    expect(completedSteps.some((step) => step.current)).toBe(false);
  });
});

describe('entry detail flow', () => {
  it('loads one Entry and all of its current recordings independently', async () => {
    entryRecording.getEntry.mockResolvedValue({ id: 7, display_writing: '行' });
    entryRecording.listRecordings.mockResolvedValue({
      results: [{ id: 1 }, { id: 2 }],
    });
    const page = context(EntryDetails, { id: 7 });

    await page.load();

    expect(entryRecording.getEntry).toHaveBeenCalledWith(7);
    expect(entryRecording.listRecordings).toHaveBeenCalledWith({
      entry_id: 7,
      page: 1,
      page_size: 50,
    });
    expect(page.recordings).toHaveLength(2);
  });

  it('reports a successful usage attestation without copying the dialect id', async () => {
    entryRecording.createUsageAttestation.mockResolvedValue({ id: 9 });
    const page = context(EntryDetails, {
      id: 7,
      entry: { attestation_count: 0 },
    });

    await page.attest({ dialectId: 11 });

    expect(entryRecording.createUsageAttestation).toHaveBeenCalledWith(7, 11);
    expect(trackProductEvent).toHaveBeenCalledWith('evidence_submit', {
      surface: 'entry_detail',
      result: 'success',
    });
    expect(JSON.stringify(trackProductEvent.mock.calls.at(-1))).not.toContain('11');
  });
});
