import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearUserInfo } from '@/services/user';

describe('user logout storage policy', () => {
  let storage;
  let app;

  beforeEach(() => {
    storage = {
      token: 'token-1',
      id: '7',
      auth_intercept_intent: 'intent',
      'can_drafts:user:7': '[{"id":"draft-1"}]',
      'recording_drafts:v2:user:7': '[{"id":"recording-draft-1"}]',
      search_history: '["moon"]',
      ui_theme_pack: 'member-pine',
      ui_theme_outfits: '[{"id":"mix-a"}]',
      ui_theme_account: '7',
    };
    app = {
      globalData: {
        id: 7,
        userInfo: { id: 7 },
        contribution: {},
      },
    };
    globalThis.getApp = vi.fn(() => app);
    globalThis.uni = {
      removeStorageSync: vi.fn((key) => {
        delete storage[key];
      }),
    };
  });

  it('removes login state while preserving scoped drafts and local preferences', () => {
    clearUserInfo();

    expect(storage.token).toBeUndefined();
    expect(storage.id).toBeUndefined();
    expect(storage.auth_intercept_intent).toBeUndefined();
    expect(storage['can_drafts:user:7']).toBe('[{"id":"draft-1"}]');
    expect(storage['recording_drafts:v2:user:7']).toBe('[{"id":"recording-draft-1"}]');
    expect(storage.search_history).toBe('["moon"]');
    expect(storage.ui_theme_pack).toBeUndefined();
    expect(storage.ui_theme_outfits).toBeUndefined();
    expect(storage.ui_theme_account).toBeUndefined();
    expect(app.globalData.id).toBeUndefined();
    expect(app.globalData.userInfo).toBeUndefined();
  });
});
