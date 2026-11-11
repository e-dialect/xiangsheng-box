import {
  describe, expect, it, vi,
} from 'vitest';

vi.mock('@/services/feedback', () => ({
  notify: vi.fn(), notifySuccess: vi.fn(), confirm: vi.fn(),
}));
const { notify } = await import('@/services/feedback');
const RecordingCreate = (await import('@/pages/recordings/create.vue')).default;

function pageContext(audio = {}, fields = {}) {
  return {
    ...RecordingCreate.methods,
    audio,
    form: fields,
    fieldErrors: {},
    validationTarget: '',
    $refs: { form: { validate: vi.fn(async () => true) } },
    $nextTick: vi.fn(async () => {}),
  };
}

describe('first missing recording step', () => {
  it.each([
    [{}, {}, 'record-required-audio', '请先录音或选择一段音频'],
    [{ path: 'blob:expired', invalid: true }, { usage_dialect_id: 2, original_gloss: '已有大意' }, 'record-required-audio', '请先录音或选择一段音频'],
    [{ path: 'blob:audio' }, {}, 'record-required-dialect', '请选择这段话的使用地区'],
    [{ path: 'blob:audio' }, { usage_dialect_id: 2 }, 'record-required-gloss', '请用自己的话简单说明意思'],
  ])('gives the first missing action and its section', async (audio, fields, target, message) => {
    const page = pageContext(audio, fields);
    expect(await page.validateForm()).toBe(false);
    expect(page.validationTarget).toBe(target);
    expect(notify).toHaveBeenLastCalledWith({ title: message, icon: 'none' });
  });

  it('repeats navigation to the same missing section on another submit', async () => {
    const page = pageContext();
    await page.validateForm();
    page.$nextTick.mockImplementation(async () => {
      expect(page.validationTarget).toBe('');
    });
    await page.validateForm();
    expect(page.validationTarget).toBe('record-required-audio');
  });

  it('does not redirect a complete form or change draft contents', async () => {
    const form = { usage_dialect_id: 2, original_gloss: '大意', rights_statement: '原授权' };
    const page = pageContext({ path: 'blob:audio' }, form);
    expect(await page.validateForm()).toBe(true);
    expect(page.validationTarget).toBe('');
    expect(page.form).toEqual(form);
    expect(page.$nextTick).not.toHaveBeenCalled();
  });
});
