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
      'discussion',
      'actions',
    ]);
  });

  it('keeps identity evidence and contribution actions out of the hero', () => {
    const wrapper = mountPage();

    expect(wrapper.find('[data-detail-section="meaning"]').text()).not.toContain('辨识说明');
    expect(wrapper.find('[data-detail-section="evidence"]').text()).toContain('辨识说明');
    expect(wrapper.find('[data-detail-section="evidence"]').text()).toContain('已整理');
    expect(wrapper.find('[data-detail-section="actions"]').text()).toContain('录下我这边的说法');
    expect(wrapper.find('[data-detail-section="actions"]').text()).toContain('收藏词条');
  });
});
