import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import CharacterReadings from '@/pages/tools/character-readings.vue';
import { lookupCharacterReadings } from '@/services/entryRecording';
import { openPage, ROUTES } from '@/services/navigation';

vi.mock('@/services/entryRecording', () => ({ lookupCharacterReadings: vi.fn() }));
vi.mock('@/services/navigation', async () => ({
  ...await vi.importActual('@/services/navigation'), openPage: vi.fn(),
}));

function page() {
  return mount(CharacterReadings, {
    global: {
      stubs: {
        PageShell: { template: '<div><slot /></div>' },
        BaseForm: { template: '<div><slot /></div>', methods: { validate: () => true } },
        BaseField: true, BaseButton: true, BaseLoading: true, EmptyState: true,
      },
    },
  });
}

describe('逐字查音', () => {
  it('invalidates stale responses when input changes, including clearing the field', async () => {
    const wrapper = page();
    await wrapper.setData({ form: { text: '字' } });
    let finish;
    lookupCharacterReadings.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const request = wrapper.vm.lookup();
    await Promise.resolve();
    await wrapper.setData({ form: { text: '' } });
    finish([{ character: '字' }]);
    await request;
    expect(wrapper.vm.rows).toEqual([]);
    expect(wrapper.vm.loading).toBe(false);
  });

  it('retains input on failure, retries, and opens the source of the selected entry', async () => {
    const wrapper = page();
    await wrapper.setData({ form: { text: '字' } });
    lookupCharacterReadings.mockRejectedValueOnce(new Error('unavailable'));
    await wrapper.vm.lookup();
    expect(wrapper.vm.error).toBe(true);
    expect(wrapper.vm.form.text).toBe('字');
    const row = { character: '字', kind: 'han', entries: [] };
    lookupCharacterReadings.mockResolvedValueOnce([row]);
    await wrapper.vm.lookup();
    expect(lookupCharacterReadings).toHaveBeenLastCalledWith('字');
    expect(wrapper.vm.error).toBe(false);
    expect(wrapper.text()).toContain('尚无这个字的公开词条');
    wrapper.vm.openSources(42);
    expect(openPage).toHaveBeenCalledWith(ROUTES.entryReview, { entry_id: 42 });
  });
});
