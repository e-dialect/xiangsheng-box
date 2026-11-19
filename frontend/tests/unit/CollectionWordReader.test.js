import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CollectionDetails from '@/pages/collections/details.vue';
import { getCollection } from '@/services/collections';

vi.mock('@/services/collections', async (importOriginal) => ({
  ...await importOriginal(), getCollection: vi.fn(),
}));

const stopPlayback = vi.fn();
const section = (id, word, recordings = []) => ({
  id, entry: { id: id + 10, display_writing: word, summary: word, pronunciation_variants: [] },
  recordings, recording_count: recordings.length,
});
const box = (sections) => ({
  title: '菜单', is_public: true, sections, pending: [], entry_count: sections.length,
});

function mountPage(sections) {
  return mount(CollectionDetails, {
    data: () => ({ box: box(sections), loading: false }),
    global: {
      stubs: {
        PageShell: { template: '<main><slot /></main>' },
        BaseButton: { props: ['text'], emits: ['click'], template: '<button @click="$emit(\'click\')">{{ text }}</button>' },
        EntryRecordingCard: {
          props: ['recording'], methods: { stopPlayback },
          template: '<span>{{ recording.original_gloss }}</span>',
        },
        EmptyState: true,
      },
    },
  });
}
const button = (page, label) => page.findAll('button').find((el) => el.text() === label);

describe('逐词阅读', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reads in directory order, stops playback and keeps unconfirmed audio out of the word', async () => {
    const page = mountPage([
      section(7, '面线', [
        { id: 1, recording: { original_gloss: '可试听的录音' } },
        { id: 2, needs_review: true, recording: { original_gloss: '待核的旧关联' } },
      ]),
      section(5, '红团'),
    ]);
    await button(page, '逐词阅读').trigger('click');
    expect(page.text()).toContain('第 1 / 2 个词');
    expect(page.text()).toContain('可试听的录音');
    expect(page.text()).not.toContain('待核的旧关联');
    await button(page, '上一个词').trigger('click');
    expect(stopPlayback).toHaveBeenCalled();
    expect(page.text()).toContain('第 2 / 2 个词');
    expect(page.text()).toContain('红团');
    expect(page.text()).toContain('暂未收录');
    await button(page, '下一个词').trigger('click');
    expect(page.text()).toContain('第 1 / 2 个词');
    await button(page, '返回目录').trigger('click');
    expect(button(page, '逐词阅读')).toBeDefined();
  });

  it('follows the same visible section on returning from details and releases a removed section', async () => {
    const one = section(17, '面线');
    const two = section(23, '红团');
    const page = mountPage([one, two]);
    await button(page, '逐词阅读').trigger('click');
    await button(page, '下一个词').trigger('click');
    getCollection.mockResolvedValueOnce(box([two, one]));
    await page.vm.load();
    expect(page.text()).toContain('第 1 / 2 个词');
    expect(page.text()).toContain('红团');
    getCollection.mockResolvedValueOnce(box([one]));
    await page.vm.load();
    expect(button(page, '逐词阅读')).toBeDefined();
    expect(page.text()).not.toContain('红团');
    await button(page, '逐词阅读').trigger('click');
    expect(button(page, '下一个词')).toBeUndefined();
    expect(page.text()).toContain('第 1 / 1 个词');
    getCollection.mockResolvedValueOnce(box([]));
    await page.vm.load();
    expect(button(page, '逐词阅读')).toBeUndefined();
  });
});
