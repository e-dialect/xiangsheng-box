import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import { listRecordings } from '@/services/entryRecording';
import {
  ensureDialectOnboarding,
  loadDialectSample,
  needsDialectOnboarding,
  saveDialectProfile,
} from '@/services/dialectOnboarding';
import request from '@/utils/request';

vi.mock('@/services/entryRecording', () => ({
  listRecordings: vi.fn(),
  pageResults: vi.fn((response) => response.results || response || []),
}));

vi.mock('@/utils/request', () => ({
  default: {
    put: vi.fn(),
  },
}));

describe('dialect onboarding service', () => {
  let app;
  let storage;

  beforeEach(() => {
    vi.clearAllMocks();
    app = { globalData: { userInfo: { id: 7 }, id: 7 } };
    storage = new Map([['id', 7], ['token', 'initial-token']]);
    globalThis.getApp = vi.fn(() => app);
    globalThis.getCurrentPages = vi.fn(() => [{ route: 'pages/index' }]);
    globalThis.uni = {
      reLaunch: vi.fn(),
      redirectTo: vi.fn(),
      getStorageSync: vi.fn((key) => storage.get(key) || ''),
      setStorageSync: vi.fn((key, value) => storage.set(key, value)),
    };
  });

  it('uses primary_dialect as the single source of truth', () => {
    expect(needsDialectOnboarding(null)).toBe(false);
    expect(needsDialectOnboarding({ primary_dialect: null })).toBe(true);
    expect(needsDialectOnboarding({ primary_dialect: { id: 3 } })).toBe(false);
  });

  it('routes a signed-in incomplete profile to the missing-dialect flow', () => {
    expect(ensureDialectOnboarding({ primary_dialect: null }, 'missing_dialect')).toBe(true);
    expect(uni.reLaunch).toHaveBeenCalledWith({
      url: '/pages/users/onboarding?reason=missing_dialect',
    });
  });

  it('loads one real public recording from the selected dialect subtree', async () => {
    listRecordings.mockResolvedValue({ results: [{ id: 8, audio_url: 'voice.mp3' }] });

    await expect(loadDialectSample(4)).resolves.toMatchObject({ id: 8 });
    expect(listRecordings).toHaveBeenCalledWith({
      dialect_id: 4,
      dialect_scope: 'subtree',
      page: 1,
      page_size: 1,
    });
  });

  it('persists nickname and primary dialect through the existing profile API', async () => {
    request.put.mockResolvedValue({
      token: 'new-token',
      user: { id: 7, nickname: '川娃', primary_dialect: { id: 4 } },
    });

    const user = await saveDialectProfile(7, {
      nickname: ' 川娃 ',
      primaryDialectId: 4,
    });

    expect(request.put).toHaveBeenCalledWith('/users/7', {
      user: { nickname: '川娃', primary_dialect_id: 4 },
    }, true);
    expect(uni.setStorageSync).toHaveBeenCalledWith('token', 'new-token');
    expect(app.globalData.userInfo).toEqual(user);
  });
  it.each(['logout', 'replacement', 'same-user-login'])(
    'ignores a successful response after %s changes the initiating session',
    async (change) => {
      let resolveSave;
      request.put.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
      const saving = saveDialectProfile(7, { nickname: '旧账号', primaryDialectId: 4 });
      if (change === 'logout') {
        storage.clear();
        app.globalData = {};
      } else {
        const id = change === 'replacement' ? 8 : 7;
        storage.set('id', id);
        storage.set('token', 'replacement-token');
        app.globalData = { id, userInfo: { id, nickname: '当前会话' } };
      }
      const currentState = { ...app.globalData };
      const currentStorage = [...storage];
      resolveSave({ token: 'late-token', user: { id: 7, nickname: '旧账号' } });

      await expect(saving).resolves.toBeNull();
      expect(app.globalData).toEqual(currentState);
      expect([...storage]).toEqual(currentStorage);
      expect(uni.setStorageSync).not.toHaveBeenCalled();
    },
  );

  it('does not send a stale page save for another account', async () => {
    storage.set('id', 8);
    await expect(saveDialectProfile(7, { nickname: '旧账号', primaryDialectId: 4 }))
      .resolves.toBeNull();
    expect(request.put).not.toHaveBeenCalled();
  });

  it('suppresses a late rejected response after logout', async () => {
    let rejectSave;
    request.put.mockReturnValueOnce(new Promise((resolve, reject) => { rejectSave = reject; }));
    const saving = saveDialectProfile(7, { nickname: '旧账号', primaryDialectId: 4 });
    storage.clear();
    app.globalData = {};
    rejectSave(new Error('expired request'));
    await expect(saving).resolves.toBeNull();
    expect(uni.setStorageSync).not.toHaveBeenCalled();
  });

  it('keeps a current-session failure available for a retry', async () => {
    request.put.mockRejectedValueOnce(new Error('保存暂时失败'));
    await expect(saveDialectProfile(7, { nickname: '当前账号', primaryDialectId: 4 }))
      .rejects.toThrow('保存暂时失败');
    expect(uni.setStorageSync).not.toHaveBeenCalled();
    request.put.mockResolvedValueOnce({ user: { id: 7, primary_dialect: { id: 4 } } });
    await expect(saveDialectProfile(7, { nickname: '当前账号', primaryDialectId: 4 }))
      .resolves.toMatchObject({ id: 7 });
  });
});
