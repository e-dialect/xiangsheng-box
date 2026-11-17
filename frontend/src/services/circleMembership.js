// Successful mutations are scoped to the current login session, never persisted.
let token;
let session;
let revision = 0;
const changes = new Map();
const listeners = new Set();
const pending = new Map();

export function subscribeMembership(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function membershipSession() {
  const current = typeof uni === 'undefined' ? '' : (uni.getStorageSync('token') || '');
  if (current !== token) {
    token = current;
    session = Symbol('circle session');
    changes.clear();
    pending.clear();
    revision += 1;
  }
  return session;
}

export function membershipRevision() {
  membershipSession();
  return revision;
}

export function publishMembership(account, id, result) {
  if (account !== membershipSession()) return false;
  revision += 1;
  changes.set(id, { revision, is_member: result.is_member, member_count: result.member_count });
  listeners.forEach((listener) => listener());
  return true;
}

export function reconcileMembership(circle, since) {
  membershipSession();
  const change = changes.get(circle.id);
  if (!change || change.revision <= since) return circle;
  return { ...circle, is_member: change.is_member, member_count: change.member_count };
}

// Serialize a circle across retained pages, not just within one button instance.
export function acquireMembership(id) {
  membershipSession();
  if (pending.has(id)) return null;
  const operation = {};
  pending.set(id, operation);
  return () => {
    if (pending.get(id) === operation) pending.delete(id);
  };
}
