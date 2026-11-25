import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

vi.mock('@/utils/request', () => ({
  default: {
    del: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const request = (await import('@/utils/request')).default;
const dialects = await import('@/services/guantou');
const mail = await import('@/services/mail');
const following = await import('@/services/following');
const discussion = await import('@/services/recordingSocial');
const users = await import('@/services/user');

describe('page-owned loading feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.get.mockResolvedValue({ results: [] });
  });

  it('keeps dialect, circle, message and recommendation reads local', async () => {
    await dialects.listDialects({ flat: true });
    await dialects.listCircles({ search: '莆田' });
    await dialects.getCircle(3);
    await dialects.listCircleRecordings(3, { page: 2 });
    await mail.getAllMails(1);
    await mail.listNotifications({ unread: true });
    await mail.getMailDetails(31);
    await following.listFollowRecommendations(3, 2);

    const localLoading = { loading: false };
    expect(request.get).toHaveBeenNthCalledWith(1, '/dialects/', { flat: true }, false, localLoading);
    expect(request.get).toHaveBeenNthCalledWith(2, '/circles/', { search: '莆田' }, false, localLoading);
    expect(request.get).toHaveBeenNthCalledWith(3, '/circles/3/', null, false, localLoading);
    expect(request.get).toHaveBeenNthCalledWith(4, '/circles/3/recordings/', { page: 2 }, true, localLoading);
    expect(request.get).toHaveBeenNthCalledWith(5, '/notifications', { page: 1 }, false, localLoading);
    expect(request.get).toHaveBeenNthCalledWith(6, '/notifications', { unread: true }, false, localLoading);
    expect(request.get).toHaveBeenNthCalledWith(7, '/notifications/31', null, false, localLoading);
    expect(request.get).toHaveBeenNthCalledWith(
      8,
      '/users/recommendations',
      { dialect_id: 3, limit: 2 },
      false,
      localLoading,
    );
  });

  it('keeps user profile reads inside the page loading state', async () => {
    await users.getUserInfo(7, true);

    expect(request.get).toHaveBeenCalledWith(
      '/users/7',
      null,
      true,
      { loading: false },
    );
  });

  it('keeps discussion list and bounded count reads silent', async () => {
    await discussion.listComments(7, 2, 'recording', 9);
    await discussion.listComments(11, 1, 'entry', 5, { pageSize: 1 });

    expect(request.get).toHaveBeenNthCalledWith(
      1, '/recording-comments/', { recording_id: 7, page: 2, parent_id: 9 }, true, { loading: false },
    );
    expect(request.get).toHaveBeenNthCalledWith(
      2, '/entry-comments/', {
        entry_id: 11, page: 1, parent_id: 5, page_size: 1,
      }, true, { loading: false },
    );
  });

  it('retains global waiting semantics for user actions', async () => {
    await dialects.joinCircle(3);
    await dialects.leaveCircle(3);
    await mail.postMail({ title: '乡音回复' });
    await mail.markNotificationsRead([31]);
    await following.followDialect(3);

    expect(request.post).toHaveBeenNthCalledWith(1, '/circles/3/membership/', {});
    expect(request.del).toHaveBeenCalledWith('/circles/3/membership/');
    expect(request.post).toHaveBeenNthCalledWith(2, '/notifications', { title: '乡音回复' }, false);
    expect(request.put).toHaveBeenNthCalledWith(1, '/notifications/unread', { notifications: [31] });
    expect(request.put).toHaveBeenNthCalledWith(2, '/dialects/3/follow/');
  });
});
