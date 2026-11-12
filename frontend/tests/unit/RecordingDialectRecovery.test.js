import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { shallowMount } from '@vue/test-utils';

vi.mock('@/services/guantou', () => ({ listAllDialects: vi.fn() }));
const { listAllDialects } = await import('@/services/guantou');
const RecordingCreate = (await import('@/pages/recordings/create.vue')).default;
const catalog = [{ id: 2, name: '莆仙语' }, { id: 3, name: '城里', parent: 2 }];
function pageContext() {
  return {
    ...RecordingCreate.data(),
    ...RecordingCreate.methods,
    primaryDialect: { id: 2 },
  };
}

describe('recording region catalog recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('getApp', () => ({ globalData: { userInfo: {} } }));
  });

  it('retries a failed initial request without losing the contribution', async () => {
    listAllDialects.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(catalog);
    const page = pageContext();
    await page.loadDialects({ applyDefault: true });
    expect(page.dialectsError).toContain('请重试');
    expect(page.dialectsLoading).toBe(false);
    page.audio = { path: 'blob:recording' };
    page.form.original_gloss = '日常问候';
    page.selectedEntry = { id: 17 };
    const before = JSON.stringify([page.audio, page.form, page.selectedEntry]);
    await page.loadDialects();
    expect(page.dialects).toEqual(catalog);
    expect(page.dialectsError).toBe('');
    expect(JSON.stringify([page.audio, page.form, page.selectedEntry])).toBe(before);
  });

  it('preserves a restored or manually selected region through failure and recovery', async () => {
    listAllDialects.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(catalog);
    const page = pageContext();
    page.form.usage_dialect_id = 3;
    page.dialects = catalog;
    await page.loadDialects();
    expect(page.form.usage_dialect_id).toBe(3);
    expect(page.dialects).toEqual(catalog);
    await page.loadDialects();
    expect(page.form.usage_dialect_id).toBe(3);
  });

  it('does not overwrite a selection made while the initial request was pending', async () => {
    let resolve;
    listAllDialects.mockReturnValue(new Promise((done) => { resolve = done; }));
    const page = pageContext();
    const pending = page.loadDialects({ applyDefault: true });
    await page.loadDialects();
    expect(listAllDialects).toHaveBeenCalledTimes(1);
    expect(page.dialectsLoading).toBe(true);
    page.form.usage_dialect_id = 3;
    resolve(catalog);
    await pending;
    expect(page.form.usage_dialect_id).toBe(3);
    expect(page.dialectsLoading).toBe(false);
  });

  it('still applies the profile default on the initial successful load', async () => {
    listAllDialects.mockResolvedValue(catalog);
    const page = pageContext();
    await page.loadDialects({ applyDefault: true });
    expect(page.form.usage_dialect_id).toBe(2);
  });

  it('offers recovery for an empty catalog instead of a silent dead end', async () => {
    listAllDialects.mockResolvedValue([]);
    const page = pageContext();
    await page.loadDialects();
    expect(page.dialectsError).toContain('地区列表暂时无法读取');
    expect(page.dialectsLoading).toBe(false);
  });

  it('renders a working retry action beside the required region step', async () => {
    listAllDialects.mockResolvedValue(catalog);
    const wrapper = shallowMount(RecordingCreate, {
      global: { renderStubDefaultSlot: true },
    });
    await wrapper.setData({ dialectsError: '地区列表暂时无法读取，请重试。' });
    const retry = wrapper.findAllComponents({ name: 'BaseButton' })
      .find((button) => button.props('text') === '重新加载地区');
    expect(retry.exists()).toBe(true);
    retry.vm.$emit('click');
    await vi.waitFor(() => expect(wrapper.vm.dialects).toEqual(catalog));
    expect(wrapper.vm.dialectsError).toBe('');
    wrapper.unmount();
  });
});
