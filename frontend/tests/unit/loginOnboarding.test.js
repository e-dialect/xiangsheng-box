import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/routers', () => ({
  toIndexPage: vi.fn(),
}));

vi.mock('@/routers/login', () => ({
  toLoginPage: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  clearInterceptIntent: vi.fn(),
  peekInterceptIntent: vi.fn(() => null),
}));

vi.mock('@/services/dialectOnboarding', () => ({
  needsDialectOnboarding: vi.fn((user) => !user.primary_dialect),
  ONBOARDING_REASONS: {
    MISSING_DIALECT: 'missing_dialect',
    NEW_USER: 'new_user',
  },
  toDialectOnboarding: vi.fn(),
}));

vi.mock('@/services/themeApi', () => ({
  afterThemeLogin: vi.fn(async () => ({ merge: null })),
}));

vi.mock('@/utils/rawRequest', () => ({
  default: {
    get: vi.fn(),
  },
}));

import { toIndexPage } from '@/routers';
import { peekInterceptIntent } from '@/services/authGuard';
import { toDialectOnboarding } from '@/services/dialectOnboarding';
import { afterLogin } from '@/services/login';
import rawRequest from '@/utils/rawRequest';

describe('post-login dialect branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = {};
    globalThis.uni = {
      getStorageSync: vi.fn((key) => storage[key]),
      setStorageSync: vi.fn((key, value) => {
        storage[key] = value;
      }),
      showToast: vi.fn(),
      redirectTo: vi.fn(),
    };
    globalThis.getCurrentPages = vi.fn(() => []);
    globalThis.getApp = vi.fn(() => ({ globalData: {} }));
  });

  it('sends a new user without a primary dialect to welcome onboarding', async () => {
    rawRequest.get.mockResolvedValue({
      user: { id: 7, primary_dialect: null },
      contribution: {},
    });

    await afterLogin({ id: 7, token: 'token' }, { isNew: true });

    expect(toDialectOnboarding).toHaveBeenCalledWith('new_user', true);
    expect(toIndexPage).not.toHaveBeenCalled();
  });

  it('recovers the bookmarked entry on an existing account after a cold bridge return', async () => {
    globalThis.getCurrentPages.mockReturnValue([{ route: 'pages/login/login' }]);
    peekInterceptIntent.mockReturnValueOnce({ action: 'bookmark_entry', context: { entryId: 42 } });
    rawRequest.get.mockResolvedValue({
      user: { id: 7, primary_dialect: { id: 3 } },
      contribution: {},
    });

    await afterLogin({ id: 7, token: 'token' });

    expect(uni.redirectTo).toHaveBeenCalledWith({ url: '/pages/entries/details?id=42' });
    expect(toIndexPage).not.toHaveBeenCalled();
  });

  it('sends a ready existing user to the normal destination', async () => {
    rawRequest.get.mockResolvedValue({
      user: { id: 7, primary_dialect: { id: 3 } },
      contribution: {},
    });

    await afterLogin({ id: 7, token: 'token' });

    expect(toDialectOnboarding).not.toHaveBeenCalled();
    expect(toIndexPage).toHaveBeenCalledWith(true);
  });
});
