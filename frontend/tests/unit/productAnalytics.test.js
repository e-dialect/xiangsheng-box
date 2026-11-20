import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { isWechatMiniProgram } from '@/services/platform';
import {
  PRODUCT_EVENTS,
  productEventPayload,
  productPlatform,
  resetProductAnalyticsSessionForTests,
  trackProductEvent,
} from '@/services/productAnalytics';
import { request } from '@/utils/httpClient';

vi.mock('@/services/platform', () => ({
  isWechatMiniProgram: vi.fn(() => false),
}));

vi.mock('@/utils/httpClient', () => ({
  request: vi.fn(() => Promise.resolve({ accepted: 1 })),
}));

describe('product analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isWechatMiniProgram.mockReturnValue(false);
    globalThis.uni = { getSystemInfoSync: vi.fn(() => ({ uniPlatform: 'web' })) };
    resetProductAnalyticsSessionForTests('session-test-12345678');
  });

  it('uses the same event catalog on H5 and WeChat', () => {
    expect(Object.values(PRODUCT_EVENTS)).toEqual([
      'listen_feed_view',
      'entry_search',
      'recording_submit',
      'evidence_submit',
      'curation_task_complete',
      'share_clipboard',
      'share_system',
      'share_opened',
      'capability_degraded',
    ]);
    expect(productPlatform()).toBe('h5');
    isWechatMiniProgram.mockReturnValue(true);
    expect(productPlatform()).toBe('mp-weixin');
  });

  it('drops search text, ids, location and account data before transport', () => {
    const payload = productEventPayload(PRODUCT_EVENTS.ENTRY_SEARCH, {
      surface: 'search',
      result: 'success',
      metadata: {
        result_bucket: '1-5',
        filter_count: 2,
        query: '银行',
        entry_id: 42,
        dialect_code: '闽.莆仙.莆田',
        user_id: 7,
      },
    });

    expect(payload).toMatchObject({
      session_id: 'session-test-12345678',
      event_name: 'entry_search',
      platform: 'h5',
      surface: 'search',
      result: 'success',
      metadata: { result_bucket: '1-5', filter_count: 2 },
    });
    expect(JSON.stringify(payload)).not.toContain('银行');
    expect(JSON.stringify(payload)).not.toContain('闽.莆仙');
  });

  it('posts silently and never blocks the product flow on analytics failure', async () => {
    request.mockRejectedValueOnce(new Error('offline'));

    await expect(trackProductEvent(PRODUCT_EVENTS.RECORDING_SUBMIT, {
      surface: 'record',
      result: 'success',
      metadata: { has_linked_entry: true },
    })).resolves.toBe(false);

    expect(request).toHaveBeenCalledWith(
      'POST',
      '/product-events/',
      expect.objectContaining({ event_name: 'recording_submit' }),
      {
        auth: false,
        visitor: false,
        silent: true,
        redirectOnUnauthorized: false,
        loading: false,
        timeout: 2500,
      },
    );
  });

  it('refuses unknown events and unsafe surface names', async () => {
    expect(productEventPayload('custom_event')).toBeNull();
    expect(productEventPayload(PRODUCT_EVENTS.ENTRY_SEARCH, { surface: '搜索页' })).toBeNull();
    expect(productEventPayload(PRODUCT_EVENTS.ENTRY_SEARCH, { surface: 'private_note' })).toBeNull();
    await expect(trackProductEvent('custom_event')).resolves.toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
