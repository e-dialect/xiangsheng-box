import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/request', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/services/feedback', () => ({ confirm: vi.fn(), cancelConfirmation: vi.fn() }));
vi.mock('@/services/guantou', () => ({ listAllDialects: vi.fn() }));

const request = (await import('@/utils/request')).default;
const { confirm } = await import('@/services/feedback');
const { listAllDialects } = await import('@/services/guantou');
const service = await import('@/services/curationReview');
const { appRoutePath } = await import('@/services/navigation');
const EntryReview = (await import('@/pages/curation/entry-review.vue')).default;
const ActionDetail = (await import('@/pages/curation/action-detail.vue')).default;
const Workbench = (await import('@/pages/curation/index.vue')).default;
const dialects = [
  { id: 1, name: '原范围', qualified_code: 'a' },
  { id: 2, name: '后代', qualified_code: 'a.b' },
  { id: 3, name: '更细地区', qualified_code: 'a.b.c' },
  { id: 4, name: '原范围同名', qualified_code: 'ax' },
];
const grant = { role: 'regional_curator', is_active: true, dialect: dialects[0] };
let session;

function context(Component, extra = {}) {
  const ctx = {
    ...service.reviewSession.data(), ...Component.data(),
    ...service.reviewSession.methods, ...Component.methods,
    ...extra,
  };
  Object.entries(Component.computed || {}).forEach(([key, get]) => {
    Object.defineProperty(ctx, key, { get: () => get.call(ctx), configurable: true });
  });
  return ctx;
}

function readyEntry() {
  return context(EntryReview, {
    id: 7, entry: { id: 7, status: 'reviewed', usage_dialect: dialects[0] },
    dialects, summary: { grants: [grant] }, evidence: [{ id: 9, citation: '资料第 2 页' }],
    selectedEvidence: [9], form: { dialectId: 2, reason: '依据地方材料修正' },
    $refs: { form: { validate: vi.fn(async () => true) } },
  });
}

describe('stage two curation loop', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.resetAllMocks();
    session = { id: 1, token: 'session-a' };
    globalThis.uni = {
      getStorageSync: vi.fn((key) => session[key]), navigateTo: vi.fn(),
      setClipboardData: vi.fn(),
    };
    confirm.mockResolvedValue(true);
    listAllDialects.mockResolvedValue(dialects);
    request.get.mockImplementation(async (url) => {
      if (url === '/entries/7/') return { id: 7, status: 'reviewed', usage_dialect: dialects[0] };
      if (url === '/curation/') return { grants: [grant] };
      return { results: [], next: null };
    });
    request.post.mockResolvedValue({ id: 80 });
  });

  it('excludes self, ancestors and other trees without comparing names', () => {
    expect(service.strictDescendants(dialects, 1).map((item) => item.id)).toEqual([2, 3]);
    expect(service.strictDescendants(dialects, 2).map((item) => item.id)).toEqual([3]);
    expect(service.strictDescendants(dialects, null)).toEqual([]);
    expect(service.canNarrow({ grants: [grant] }, dialects[1], dialects)).toBe(true);
    expect(service.canNarrow({ grants: [{ ...grant, role: 'lexical_curator' }] }, dialects[0], dialects)).toBe(false);
    expect(service.canNarrow({ grants: [{ ...grant, dialect: dialects[1] }] }, dialects[0], dialects)).toBe(false);
    expect(service.canNarrow({ grants: [{ ...grant, is_active: false }] }, dialects[0], dialects)).toBe(false);
  });

  it('keeps evidence pagination in the service and never requests an arbitrary next URL', async () => {
    await service.listEntryEvidence(7, 2);
    await service.listEntryActions(7, 3);
    expect(request.get).toHaveBeenCalledWith('/evidence-records/', { entry_id: 7, page: 2, page_size: 20 }, true, { loading: false });
    expect(request.get).toHaveBeenCalledWith('/curation/actions/', { target_type: 'entry', target_id: 7, page: 3, page_size: 20 }, true, { loading: false });
  });

  it('uses fresh owner-only staff information to enable a staff account with no grant', async () => {
    const ctx = readyEntry();
    request.get.mockImplementation(async (url) => {
      if (url === '/users/1') return { user: { id: 1, is_staff: true } };
      if (url === '/curation/') return { grants: [] };
      if (url === '/entries/7/') return ctx.entry;
      return { results: [], next: null };
    });
    await ctx.loadContext();
    expect(ctx.summary).toEqual({ grants: [], is_staff: true });
    expect(ctx.disabledReason).toBe('');
    await ctx.submit();
    expect(request.post).toHaveBeenCalledTimes(1);
    service.reviewSession.onHide.call(ctx);
    expect(ctx.summary).toBeNull();
  });

  it.each([
    ['ordinary account', { user: { id: 1, is_staff: false } }],
    ['public profile', { user: { id: 1 } }],
    ['different owner', { user: { id: 2, is_staff: true } }],
    ['non-boolean flag', { user: { id: 1, is_staff: 'true' } }],
  ])('does not treat an empty grant list as staff for %s', async (_, profile) => {
    const ctx = readyEntry();
    request.get.mockImplementation(async (url) => (
      url === '/users/1' ? profile : { grants: [], is_staff: true }
    ));
    await ctx.loadContext();
    expect(ctx.summary.is_staff).toBe(false);
    expect(ctx.canSubmit).toBe(false);
    await ctx.submit();
    expect(request.post).not.toHaveBeenCalled();
  });

  it('keeps revoked, expired and out-of-scope ordinary accounts blocked', () => {
    expect(service.canNarrow({ grants: [], is_staff: false }, dialects[0], dialects)).toBe(false);
    expect(service.canNarrow({ grants: [{ ...grant, is_active: false }], is_staff: false }, dialects[0], dialects)).toBe(false);
    expect(service.canNarrow({ grants: [{ ...grant, dialect: dialects[3] }], is_staff: false }, dialects[0], dialects)).toBe(false);
  });

  it('fails closed on staff lookup errors and discards staff results after switching accounts', async () => {
    const ctx = readyEntry();
    request.get.mockImplementation(async (url) => {
      if (url === '/users/1') throw { statusCode: 0 };
      return { grants: [] };
    });
    await ctx.loadContext();
    expect(ctx.summary.is_staff).toBe(false);
    expect(ctx.contextError).toContain('无法核对站点审核权限');
    let resolveProfile;
    request.get.mockImplementation(async (url) => (
      url === '/users/1' ? new Promise((resolve) => { resolveProfile = resolve; }) : { grants: [] }
    ));
    const pending = ctx.loadContext();
    session = { id: 2, token: 'session-b' };
    service.reviewSession.onHide.call(ctx);
    resolveProfile({ user: { id: 1, is_staff: true } });
    await pending;
    expect(ctx.summary).toBeNull();
  });

  it.each(['/', '/guantou-preview/'])('copies an action URL with H5 base %s and only the action ID', (base) => {
    vi.stubEnv('BASE_URL', base);
    const ctx = context(ActionDetail, { id: 80 });
    ctx.copyLink();
    expect(uni.setClipboardData).toHaveBeenCalledWith({
      data: `${window.location.origin}${base}pages/curation/action-detail?id=80`,
    });
  });

  it.each([
    ['/', '/pages/curation/action-detail', '/pages/curation/action-detail'],
    ['/guantou-preview/', '/guantou-preview/pages/curation/action-detail', '/pages/curation/action-detail'],
    ['/guantou-preview/', '/guantou-preview/', '/'],
    ['/guantou-preview/', '/guantou-preview', '/'],
    ['/guantou-preview/', '/guantou-preview-other/pages/curation/action-detail', '/guantou-preview-other/pages/curation/action-detail'],
    ['/guantou-preview/', '/guantou-preview/unknown', '/unknown'],
  ])('checks application routes within mount %s for %s', (base, pathname, expected) => {
    expect(appRoutePath(pathname, base)).toBe(expected);
  });

  it('blocks repeated clicks while confirming and posts one semantic action with a 201 requirement', async () => {
    let accept;
    confirm.mockImplementation(() => new Promise((resolve) => { accept = resolve; }));
    const ctx = readyEntry();
    const pending = ctx.submit();
    await Promise.resolve();
    await ctx.submit();
    expect(confirm).toHaveBeenCalledTimes(1);
    accept(true);
    await pending;
    expect(request.post).toHaveBeenCalledTimes(1);
    expect(request.post).toHaveBeenCalledWith('/curation/actions/', {
      action_type: 'narrow_scope', target_type: 'entry', target_id: 7,
      evidence_ids: [9], reason: '依据地方材料修正', changes: { dialect_id: 2 },
    }, true, { loading: false, expectedStatus: 201 });
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/curation/action-detail?id=80&entry_id=7' });
  });

  it('preserves the draft on rejection and does not post when validation or confirmation fails', async () => {
    const ctx = readyEntry();
    ctx.$refs.form.validate.mockResolvedValue(false);
    await ctx.submit();
    expect(request.post).not.toHaveBeenCalled();
    ctx.$refs.form.validate.mockResolvedValue(true);
    confirm.mockResolvedValue(false);
    await ctx.submit();
    expect(request.post).not.toHaveBeenCalled();
    confirm.mockResolvedValue(true);
    request.post.mockRejectedValue({ statusCode: 403 });
    await ctx.submit();
    expect(ctx.form.reason).toBe('依据地方材料修正');
    expect(ctx.selectedEvidence).toEqual([9]);
    expect(ctx.submitError).toContain('不允许');
    expect(uni.navigateTo).not.toHaveBeenCalled();
  });

  it('requires a fresh confirmation when the object changed before POST', async () => {
    const ctx = readyEntry();
    request.get.mockResolvedValue({ id: 7, status: 'reviewed', usage_dialect: dialects[1] });
    await ctx.submit();
    expect(request.post).not.toHaveBeenCalled();
    expect(ctx.entry.usage_dialect.id).toBe(2);
    expect(ctx.target).toBeUndefined();
    expect(ctx.submitError).toContain('已被修改');
  });

  it('does not retry an unknown POST result and requires explicit reconciliation', async () => {
    const ctx = readyEntry();
    request.post.mockRejectedValue({ statusCode: 0, message: 'timeout' });
    await ctx.submit();
    await ctx.submit();
    expect(request.post).toHaveBeenCalledTimes(1);
    expect(ctx.unknownResult).toBe(true);
    expect(ctx.form.reason).toBe('依据地方材料修正');
    await ctx.reconcile();
    expect(ctx.unknownResult).toBe(false);
    expect(request.post).toHaveBeenCalledTimes(1);
  });

  it('keeps an unknown result locked while another history request is still pending', async () => {
    const ctx = readyEntry();
    ctx.unknownResult = true;
    ctx.historyLoading = true;
    await ctx.reconcile();
    expect(ctx.unknownResult).toBe(true);
    expect(request.get).not.toHaveBeenCalled();
  });

  it('loads sources and history even when the current grant summary is forbidden', async () => {
    const ctx = context(EntryReview, { id: 7 });
    request.get.mockImplementation(async (url) => {
      if (url === '/curation/') throw { statusCode: 403 };
      if (url === '/entries/7/') return { id: 7, usage_dialect: dialects[0] };
      return { results: [{ id: 80 }], next: null };
    });
    await ctx.load();
    expect(ctx.history).toEqual([{ id: 80 }]);
    expect(ctx.evidence).toEqual([{ id: 80 }]);
    expect(ctx.contextError).toContain('不允许');
    expect(ctx.entryError).toBe('');
  });

  it('retains the failed next page number for retry and clears records after access denial', async () => {
    const ctx = readyEntry();
    ctx.evidenceNext = true;
    request.get.mockRejectedValueOnce({ statusCode: 0 });
    await ctx.loadEvidence(2);
    expect(ctx.evidenceRetryPage).toBe(2);
    expect(ctx.evidencePage).toBe(1);
    request.get.mockResolvedValueOnce({ results: [{ id: 10 }], next: null });
    await ctx.loadEvidence(ctx.evidenceRetryPage);
    expect(ctx.evidence.map((item) => item.id)).toEqual([9, 10]);
    request.get.mockRejectedValueOnce({ statusCode: 403 });
    await ctx.loadEvidence(3);
    expect(ctx.evidence).toEqual([]);
    expect(ctx.selectedEvidence).toEqual([]);
  });

  it('discards pending responses from another account and clears drafts on hide', async () => {
    let resolve;
    request.get.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const ctx = readyEntry();
    const pending = ctx.loadHistory(1);
    service.reviewSession.onHide.call(ctx);
    session = { id: 2, token: 'session-b' };
    resolve({ results: [{ id: 123 }], next: null });
    await pending;
    expect(ctx.history).toEqual([]);
    expect(ctx.evidence).toEqual([]);
    expect(ctx.form.reason).toBe('');
    expect(ctx.summary).toBeNull();
  });

  it('purges already rendered history after a different browser tab changes the account', () => {
    const ctx = readyEntry();
    ctx.history = [{ id: 123, reason: 'A 的记录' }];
    service.reviewSession.mounted.call(ctx);
    session = { id: 2, token: 'session-b' };
    window.dispatchEvent(new StorageEvent('storage', { key: 'token' }));
    expect(ctx.history).toEqual([]);
    expect(ctx.evidence).toEqual([]);
    expect(ctx.form.reason).toBe('');
    expect(ctx.entryError).toContain('账号已变更');
    service.reviewSession.beforeUnmount.call(ctx);
  });

  it('opens own history without requesting the curator summary or hidden evidence IDs', async () => {
    const ctx = context(ActionDetail, { id: 80 });
    request.get.mockImplementation(async (url) => {
      if (url === '/curation/actions/80/') return {
        id: 80, target_type: 'entry', target_id: 7, actor: { id: 1 }, grant: null,
        evidence_ids: [9], authority_snapshot: { status: 'unavailable', reason: 'legacy_record' },
      };
      throw { statusCode: 404 };
    });
    await ctx.load();
    expect(ctx.action.id).toBe(80);
    expect(request.get.mock.calls.map(([url]) => url)).toEqual(['/curation/actions/80/', '/evidence-records/9/']);
    expect(ctx.sources[0].source).toBeNull();
    expect(ctx.sources[0].error).toBe('记录不存在或你无权读取');
    expect(service.authorityLines(ctx.action.authority_snapshot)).toEqual(['旧记录未保存当时授权']);
    ctx.openHistory();
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/curation/entry-review?entry_id=7' });
  });

  it('keeps recording and entry material routes distinct', () => {
    Workbench.methods.openMaterial({ target_type: 'recording', id: 5 });
    Workbench.methods.openMaterial({ target_type: 'entry', id: 8 });
    expect(uni.navigateTo).toHaveBeenNthCalledWith(1, { url: '/pages/recordings/details?id=5' });
    expect(uni.navigateTo).toHaveBeenNthCalledWith(2, { url: '/pages/curation/entry-review?entry_id=8' });
  });
});
