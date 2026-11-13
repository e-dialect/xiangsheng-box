import { mount } from '@vue/test-utils';
import {
  describe, expect, it, vi,
} from 'vitest';

vi.mock('@/services/entryRecording', () => ({
  bookmarkEntry: vi.fn(),
  createUsageAttestation: vi.fn(),
  entryTitle: vi.fn((entry) => entry?.display_writing || entry?.summary || '待整理词条'),
  getEntry: vi.fn(),
  listRecordings: vi.fn(),
  pageResults: vi.fn((response) => response?.results || response || []),
  unbookmarkEntry: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  requireAuth: vi.fn(() => true),
}));
vi.mock('@/services/feedback', () => ({ notifySuccess: vi.fn() }));
vi.mock('@/services/navigation', () => ({
  goRecordingDetail: vi.fn(),
  goRecordingDrafts: vi.fn(),
  ROUTES: { home: '/pages/index' },
  goBack: vi.fn(),
  goRecord: vi.fn(),
}));
vi.mock('@/services/capabilities', () => ({
  CAPABILITIES: { USAGE_ATTESTATION: 'usage_attestation' },
  ensureCapability: vi.fn(() => true),
}));
vi.mock('@/services/productAnalytics', () => ({
  PRODUCT_EVENTS: { EVIDENCE_SUBMIT: 'evidence_submit' },
  trackProductEvent: vi.fn(),
}));

const { getEntry, listRecordings } = await import('@/services/entryRecording');

const EntryDetails = (await import('@/pages/entries/details.vue')).default;

const entry = {
  id: 21,
  display_writing: '行',
  summary: '走；步行',
  usage_dialect: { id: 3, name: '莆仙方言' },
  status: 'reviewed',
  identity_note: '本条只收录步行义。',
  recording_count: 1,
  attestation_count: 7,
  evidence_count: 4,
  needs_audio: false,
  is_bookmarked: false,
  senses: [{
    id: 1,
    sense_number: 1,
    gloss: '走路',
    examples: [{ content: '本义项的原文例句', explain: '本义项的原文解释', type: '例' }],
    concepts: [],
  }],
  writings: [{ id: 2, writing: { text: '行', form_type: 'orthographic' } }],
  pronunciation_variants: [{
    id: 3,
    dialect: { id: 3, name: '莆仙方言' },
    surface_romanization: 'giang',
    ipa: 'kiaŋ',
  }],
};

function mountPage() {
  return mount(EntryDetails, {
    global: {
      stubs: {
        PageShell: { template: '<main><slot /></main>' },
        BaseButton: {
          props: ['text'],
          template: '<button>{{ text }}</button>',
        },
        BaseLoading: true,
        EmptyState: true,
        DialectLabel: {
          props: ['dialect'],
          template: '<span>{{ dialect && dialect.name }}</span>',
        },
        EntryRecordingCard: true,
      },
    },
    data: () => ({
      loading: false,
      errorMessage: '',
      entry,
      recordings: [{ id: 11, usage_dialect: entry.usage_dialect }],
    }),
  });
}

describe('entry detail information hierarchy', () => {
  it('presents meaning, pronunciation, recordings, evidence, then actions', () => {
    const wrapper = mountPage();
    const sections = wrapper.findAll('[data-detail-section]').map(
      (section) => section.attributes('data-detail-section'),
    );

    expect(sections).toEqual([
      'meaning',
      'pronunciation',
      'recordings',
      'evidence',
      'actions',
    ]);
  });

  it('keeps identity evidence and contribution actions out of the hero', () => {
    const wrapper = mountPage();

    expect(wrapper.find('.sense-row').text()).toContain('本义项的原文例句');
    expect(wrapper.find('.sense-row').text()).toContain('本义项的原文解释');
    expect(wrapper.find('[data-detail-section="meaning"]').text()).not.toContain('辨识说明');
    expect(wrapper.find('[data-detail-section="evidence"]').text()).toContain('辨识说明');
    expect(wrapper.find('[data-detail-section="evidence"]').text()).toContain('已整理');
    expect(wrapper.find('[data-detail-section="actions"]').text()).toContain('录下我这边的说法');
    expect(wrapper.find('[data-detail-section="actions"]').text()).toContain('收藏词条');
  });

  it('keeps examples and explanations inside their own sense when senses reorder', async () => {
    const wrapper = mountPage();
    const first = entry.senses[0];
    const second = {
      id: 2, sense_number: 2, gloss: '另一义项', concepts: [],
      examples: [{ content: '第二义项例句', explain: '第二义项解释', type: '俗' }],
    };
    for (const senses of [[first, second], [second, first]]) {
      await wrapper.setData({ entry: { ...entry, senses } });
      const rows = wrapper.findAll('.sense-row');
      expect(rows).toHaveLength(2);
      senses.forEach((sense, index) => {
        const own = sense.examples[0];
        const other = senses[1 - index].examples[0];
        expect(rows[index].text()).toContain(own.content);
        expect(rows[index].text()).toContain(own.explain);
        expect(rows[index].text()).not.toContain(other.content);
        expect(rows[index].text()).not.toContain(other.explain);
      });
    }
  });

});

describe('entry recordings pagination', () => {
  it('keeps additional regional recordings accessible after the first page', async () => {
    getEntry.mockResolvedValue(entry);
    listRecordings.mockResolvedValueOnce({ results: [{ id: 11 }], next: '/recordings/?page=2' });
    const wrapper = mountPage();
    await wrapper.setData({ id: 21 });
    await wrapper.vm.load();
    const recordingSection = wrapper.find('[data-detail-section="recordings"]');
    expect(recordingSection.find('[data-testid="load-more-recordings"]').exists()).toBe(true);
    listRecordings.mockResolvedValueOnce({
      results: [{ id: 11 }, { id: 12 }, { id: 12 }], next: null,
    });
    await wrapper.vm.loadMoreRecordings();
    expect(listRecordings).toHaveBeenLastCalledWith({ entry_id: 21, page: 2, page_size: 50 });
    expect(wrapper.vm.recordings.map((item) => item.id)).toEqual([11, 12]);
    expect(recordingSection.find('[data-testid="load-more-recordings"]').exists()).toBe(false);
  });

  it('preserves playable recordings and retries the same failed page', async () => {
    const wrapper = mountPage();
    await wrapper.setData({ id: 21, hasMoreRecordings: true });
    listRecordings.mockRejectedValueOnce(new Error('network'));
    await wrapper.vm.loadMoreRecordings();
    expect(wrapper.vm.recordings.map((item) => item.id)).toEqual([11]);
    expect(wrapper.vm.recordingPage).toBe(1);
    expect(wrapper.text()).toContain('已显示的录音仍可播放');
    listRecordings.mockResolvedValueOnce({ results: [{ id: 12 }], next: null });
    await wrapper.vm.loadMoreRecordings();
    expect(listRecordings).toHaveBeenLastCalledWith({ entry_id: 21, page: 2, page_size: 50 });
    expect(wrapper.vm.recordingsError).toBe('');
  });

  it('does not start duplicate loads or append a stale page after refresh', async () => {
    const wrapper = mountPage();
    await wrapper.setData({ id: 21, hasMoreRecordings: true });
    let resolvePage;
    listRecordings.mockImplementationOnce(() => new Promise((resolve) => {
      resolvePage = resolve;
    }));
    const pending = wrapper.vm.loadMoreRecordings();
    await wrapper.vm.loadMoreRecordings();
    expect(listRecordings).toHaveBeenCalledTimes(1);
    getEntry.mockResolvedValue(entry);
    listRecordings.mockResolvedValueOnce({ results: [{ id: 15 }], next: null });
    await wrapper.vm.load();
    resolvePage({ results: [{ id: 12 }], next: null });
    await pending;
    expect(wrapper.vm.recordings.map((item) => item.id)).toEqual([15]);
    expect(wrapper.vm.recordingsLoading).toBe(false);
  });

  it('handles an unpaginated response without inventing another page', async () => {
    const wrapper = mountPage();
    await wrapper.setData({ id: 21 });
    getEntry.mockResolvedValue(entry);
    listRecordings.mockResolvedValueOnce([{ id: 11 }]);
    await wrapper.vm.load();
    expect(wrapper.vm.hasMoreRecordings).toBe(false);
  });
});

describe('entry pagination lifecycle', () => {
  it.each(['unload', 'entry change'])('ignores a late page after %s', async (reason) => {
    const wrapper = mountPage();
    await wrapper.setData({ id: 21, hasMoreRecordings: true });
    let resolvePage;
    listRecordings.mockImplementationOnce(() => new Promise((resolve) => {
      resolvePage = resolve;
    }));
    const pending = wrapper.vm.loadMoreRecordings();
    if (reason === 'unload') EntryDetails.onUnload.call(wrapper.vm);
    else {
      await wrapper.setData({ id: 22 });
      getEntry.mockResolvedValue({ ...entry, id: 22 });
      listRecordings.mockResolvedValueOnce({ results: [{ id: 22 }], next: null });
      await wrapper.vm.load();
    }
    resolvePage({ results: [{ id: 99 }], next: null });
    await pending;
    expect(wrapper.vm.recordings.map((item) => item.id)).toEqual(reason === 'unload' ? [11] : [22]);
    expect(wrapper.vm.recordingPage).toBe(1);
    if (reason === 'entry change') expect(wrapper.vm.recordingsLoading).toBe(false);
    wrapper.unmount();
  });
});
