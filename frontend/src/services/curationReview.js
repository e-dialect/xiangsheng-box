import request from '@/utils/request';
import { buildDialectTree, findDialectPath, dialectBreadcrumb } from '@/utils/dialectTree';

const OPTIONS = Object.freeze({ loading: false });

// Only the authenticated owner's response exposes is_staff. Keep no profile cache.
export async function getReviewStaff() {
  const id = Number(uni.getStorageSync('id'));
  if (!uni.getStorageSync('token') || !Number.isSafeInteger(id) || id <= 0) return false;
  const response = await request.get(`/users/${id}`, {}, true, OPTIONS);
  return Number(response?.user?.id) === id && response.user.is_staff === true;
}

export function listEntryEvidence(id, page = 1) {
  return request.get('/evidence-records/', { entry_id: id, page, page_size: 20 }, true, OPTIONS);
}

export function getEvidence(id) {
  return request.get(`/evidence-records/${id}/`, {}, true, OPTIONS);
}

export function listEntryActions(id, page = 1) {
  return request.get('/curation/actions/', {
    target_type: 'entry', target_id: id, page, page_size: 20,
  }, true, OPTIONS);
}

export function getAction(id) {
  return request.get(`/curation/actions/${id}/`, {}, true, OPTIONS);
}

export function submitNarrowScope(payload) {
  return request.post('/curation/actions/', payload, true, { ...OPTIONS, expectedStatus: 201 });
}

export function strictDescendants(dialects, ancestorId) {
  if (!ancestorId) return [];
  const tree = buildDialectTree(dialects);
  return dialects.filter((dialect) => findDialectPath(tree, dialect.id)
    .slice(0, -1).some((parent) => String(parent.id) === String(ancestorId)));
}

export function canNarrow(summary, dialect, dialects) {
  if (!dialect?.id || !summary) return false;
  if (summary.is_staff === true) return true;
  const ancestors = findDialectPath(buildDialectTree(dialects), dialect.id);
  return (summary.grants || []).some((grant) => (
    grant.is_active === true && grant.role === 'regional_curator'
    && ancestors.some((node) => String(node.id) === String(grant.dialect?.id))
  ));
}

export function narrowPayload(entryId, dialectId, evidenceIds, reason) {
  return {
    action_type: 'narrow_scope',
    target_type: 'entry',
    target_id: Number(entryId),
    reason: String(reason || '').trim(),
    evidence_ids: evidenceIds.map(Number),
    changes: { dialect_id: Number(dialectId) },
  };
}

export function reviewError(error) {
  return ({
    401: '登录已失效，请重新登录后再试',
    403: '当前账号不允许执行此操作',
    404: '记录不存在或你无权读取',
  })[error?.statusCode] || error?.message || '加载失败，请重试';
}

export function actionLabel(type) {
  return ({
    narrow_scope: '缩小地区范围',
    review: '审核',
    resolve_legacy: '处理旧库候选',
    split: '拆分',
    merge: '合并',
    preserve_competing: '保留竞争解释',
  })[type] || '整理操作';
}

export function authorityLines(snapshot) {
  if (!snapshot || snapshot.status !== 'captured') return ['旧记录未保存当时授权'];
  const role = ({ regional_curator: '地区整理员', lexical_curator: '词条整理员', staff: '站点审核员' })[snapshot.role] || '角色未提供';
  return [role, snapshot.mode === 'staff' ? '站点审核权限' : dialectBreadcrumb(snapshot.dialect),
    snapshot.valid_from ? `有效期：${snapshot.valid_from} 至 ${snapshot.valid_until || '未提供'}` : '',
    snapshot.captured_at ? `快照时间：${snapshot.captured_at}` : ''].filter(Boolean);
}

// No shared evidence/history cache. Invalidate pending work on hide/unload and
// compare the authenticated session before committing any asynchronous result.
const sessionListeners = new WeakMap();

export const reviewSession = {
  data() { return { reviewEpoch: 0 }; },
  mounted() {
    // #ifdef H5
    let token = uni.getStorageSync('token');
    let id = uni.getStorageSync('id');
    const check = () => {
      const nextToken = uni.getStorageSync('token');
      const nextId = uni.getStorageSync('id');
      if (token === nextToken && id === nextId) return;
      token = nextToken; id = nextId;
      this.clearReview();
      this.sessionChanged();
    };
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    sessionListeners.set(this, () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    });
    // #endif
  },
  beforeUnmount() { sessionListeners.get(this)?.(); sessionListeners.delete(this); },
  onHide() { this.clearReview(); },
  onUnload() { this.clearReview(); },
  methods: {
    clearReview() {
      this.reviewEpoch += 1;
      this.resetReview();
    },
    reviewGuard() {
      const epoch = this.reviewEpoch;
      const token = uni.getStorageSync('token');
      const id = uni.getStorageSync('id');
      return () => epoch === this.reviewEpoch && token === uni.getStorageSync('token')
        && id === uni.getStorageSync('id');
    },
  },
};
