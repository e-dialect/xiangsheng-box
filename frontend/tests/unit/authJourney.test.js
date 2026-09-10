import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/routers/login', () => ({
  toLoginPage: vi.fn(),
}));

vi.mock('@/services/authGuard', () => ({
  clearInterceptIntent: vi.fn(),
  saveInterceptIntent: vi.fn(),
}));

import { toLoginPage } from '@/routers/login';
import { clearInterceptIntent, saveInterceptIntent } from '@/services/authGuard';
import {
  cancelLoginToSearch,
  openLoginFromMine,
  resolveAuthDestination,
} from '@/services/authJourney';

describe('auth journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.uni = { reLaunch: vi.fn() };
  });

  it('records voluntary mine login before opening the shared login page', () => {
    openLoginFromMine();

    expect(saveInterceptIntent).toHaveBeenCalledWith({
      action: 'open_mine',
      context: { page: 'mine' },
      voluntary: true,
    });
    expect(toLoginPage).toHaveBeenCalledTimes(1);
  });

  it('clears a cancelled intent and relaunches public search', () => {
    cancelLoginToSearch();

    expect(clearInterceptIntent).toHaveBeenCalledTimes(1);
    expect(uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/search' });
  });

  it('returns a dm intent to the mail send page with the recipient', () => {
    expect(resolveAuthDestination({
      action: 'dm',
      context: { page: 'user_detail', userId: 9 },
    })).toEqual({
      kind: 'url',
      route: 'pages/mails/send',
      url: '/pages/mails/send?id=9',
    });
  });

  it('rejects a dm intent without a recipient', () => {
    expect(resolveAuthDestination({
      action: 'dm',
      context: { page: 'user_detail' },
    })).toEqual({ kind: 'fallback' });
  });

  it('returns a follow intent to the user without performing the follow', () => {
    expect(resolveAuthDestination({
      action: 'follow',
      context: { page: 'user_detail', userId: 12 },
    })).toEqual({
      kind: 'url',
      route: 'pages/users/details',
      url: '/pages/users/details?id=12',
    });
  });

  it('returns circle membership to its exact context', () => {
    expect(resolveAuthDestination({
      action: 'circle_join',
      context: { page: 'circle_detail', circleId: 6 },
    })).toEqual({
      kind: 'url',
      route: 'pages/circles/details',
      url: '/pages/circles/details?id=6',
    });
  });

  it('keeps the comment anchor when returning to an interrupted discussion', () => {
    expect(resolveAuthDestination({
      action: 'interact_entry',
      context: { page: 'entry_detail', entryId: 21, commentId: 31, rootId: 30 },
    })).toEqual({
      kind: 'url',
      route: 'pages/entries/details',
      url: '/pages/entries/details?id=21&comment=31&root=30',
    });
    expect(resolveAuthDestination({
      action: 'interact_recording',
      context: { page: 'recording_detail', recordingId: 7 },
    })).toEqual({
      kind: 'url',
      route: 'pages/recordings/details',
      url: '/pages/recordings/details?id=7',
    });
  });

  it('returns V2 recording and attestation intents to the Entry context', () => {
    expect(resolveAuthDestination({
      action: 'record_recording',
      context: { page: 'entry_detail', entryId: 27 },
    })).toEqual({
      kind: 'url',
      route: 'pages/recordings/create',
      url: '/pages/recordings/create?entry_id=27',
    });
    expect(resolveAuthDestination({
      action: 'attest_usage',
      context: { page: 'listen', entryId: 27 },
    })).toEqual({
      kind: 'url',
      route: 'pages/entries/details',
      url: '/pages/entries/details?id=27',
    });
  });
});
