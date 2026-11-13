import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setClipboard, setClipboardQuiet } from '@/utils/clipboard';
import { copyThemeShareLink } from '@/utils/themeShare';

describe('clipboard completion', () => {
  beforeEach(() => { global.uni = { showToast: vi.fn(), setClipboardData: vi.fn() }; });
  it('preserves ordinary success and quiet behavior', () => {
    uni.setClipboardData.mockImplementation(({ success }) => success());
    setClipboard('text');
    expect(uni.showToast).toHaveBeenCalledWith({ title: '已复制', icon: 'none' });
    uni.showToast.mockClear();
    setClipboardQuiet('text');
    expect(uni.showToast).not.toHaveBeenCalled();
  });
  it.each(['fail', 'throw', 'unavailable'])('does not announce success on %s and permits retry', (mode) => {
    const done = vi.fn();
    if (mode === 'fail') uni.setClipboardData.mockImplementation(({ fail }) => fail());
    if (mode === 'throw') uni.setClipboardData.mockImplementation(() => { throw new Error('denied'); });
    if (mode === 'unavailable') delete uni.setClipboardData;
    copyThemeShareLink('theme', { id: 'paper' }, done);
    expect(done).not.toHaveBeenCalled();
    expect(uni.showToast).toHaveBeenCalledTimes(1);
    expect(uni.showToast).toHaveBeenCalledWith({ title: '复制失败', icon: 'none' });
    uni.setClipboardData = vi.fn(({ success }) => success());
    copyThemeShareLink('theme', { id: 'paper' }, done);
    expect(done).toHaveBeenCalledOnce();
  });
});
