import { shallowMount } from '@vue/test-utils';
import {
  beforeEach, afterEach, describe, expect, it, vi,
} from 'vitest';

vi.mock('@/services/entryRecording', async (importOriginal) => ({
  ...await importOriginal(), getEntry: vi.fn(),
}));
const { getEntry } = await import('@/services/entryRecording');
const RecordingCreate = (await import('@/pages/recordings/create.vue')).default;

let wrapper;
beforeEach(() => {
  vi.useFakeTimers();
  getEntry.mockResolvedValue({ id: 42, display_writing: '行', summary: '走路' });
  globalThis.uni = { getStorageSync: vi.fn(() => 1), setStorageSync: vi.fn() };
  globalThis.getApp = () => ({ globalData: {} });
});
afterEach(() => {
  wrapper?.unmount();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function mountPage() {
  wrapper = shallowMount(RecordingCreate, {
    global: {
      stubs: {
        AppShell: { template: '<main><slot /></main>' },
        BaseForm: { template: '<form><slot /></form>' },
        BaseButton: { props: ['text'], template: '<button @click="$emit(\'click\')">{{ text }}</button>' },
        TCollapse: { props: ['value'], template: '<section><slot v-if="value.includes(\'optional\')" /></section>' },
        TCollapsePanel: { template: '<section><slot /></section>' },
      },
    },
  });
  return wrapper.vm;
}

describe('linked recording task', () => {
  it('shows the selected word outside the collapsed optional fields and allows cancellation', async () => {
    const page = mountPage();
    await page.loadEntry(42);
    await page.$nextTick();
    expect(page.optionalSections).toEqual([]);
    expect(wrapper.find('.record-entry-context').text()).toContain('这次录这个词');
    expect(wrapper.find('.record-entry-context').text()).toContain('走路');
    await wrapper.find('.record-entry-context button').trigger('click');
    expect(page.selectedEntry).toBeNull();
    expect(wrapper.find('.record-entry-context').exists()).toBe(false);
  });

  it('preserves restored fields and the user’s explicit expanded state when loading context', async () => {
    const page = mountPage();
    page.optionalSections = ['optional'];
    page.form.original_gloss = '我自己写的大意';
    page.form.rights_statement = '保留原来的授权说明';
    page.form.original_pronunciation = '原读音';
    await page.loadEntry(42);
    expect(page.optionalSections).toEqual(['optional']);
    expect(page.form).toMatchObject({
      original_gloss: '我自己写的大意', rights_statement: '保留原来的授权说明', original_pronunciation: '原读音',
    });
    expect(wrapper.find('.entry-linker').exists()).toBe(false);
  });
});
