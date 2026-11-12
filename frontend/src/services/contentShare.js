import { APP_NAME } from '@/const/branding';
import { openPage, pageUrl, ROUTES } from '@/services/navigation';
import { showWechatShareMenu, WECHAT_SHARE_IMAGE } from '@/services/pageShare';
import { canUseNativeMiniProgramShare, isQQMiniProgram } from '@/services/platform';
import { naturalDialectName } from '@/utils/dialectTree';

function shareText(value, limit) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  const characters = Array.from(text);
  return characters.length > limit ? `${characters.slice(0, limit - 1).join('')}…` : text;
}

function contentShareMessage(content, route, title) {
  const dialect = content.usage_dialect;
  const region = naturalDialectName(dialect?.path_names?.slice(-1)[0] || dialect?.name);
  return {
    title: `${title} · ${shareText(region, 12) || '地区待补充'}`,
    path: pageUrl(route, { id: content.id }),
    query: `id=${encodeURIComponent(content.id)}`,
  };
}

export function entryShareMessage(entry) {
  if (entry?.visibility !== true || !entry.id || entry.status === 'redirected') return null;
  const writing = shareText(entry.display_writing, 14);
  const meaning = shareText(entry.summary, writing ? 14 : 20);
  const title = [...new Set([writing, meaning].filter(Boolean))].join(' · ') || '写法待整理';
  return contentShareMessage(entry, ROUTES.entryDetail, `词条｜${title}`);
}

export function recordingShareMessage(recording) {
  if (recording?.visibility !== true || !recording.id || recording.status === 'rejected') {
    return null;
  }
  const title = shareText(recording.original_gloss, 20) || '一段待整理的乡音';
  return contentShareMessage(recording, ROUTES.recordingDetail, `乡音｜${title}`);
}

export function collectionShareMessage(collection) {
  if (collection?.is_public !== true || !collection.id) return null;
  const title = shareText(collection.title, 24) || '公开集盒';
  return {
    title: `集盒｜${title}`,
    path: pageUrl(ROUTES.collectionDetail, { id: collection.id }),
    query: `id=${encodeURIComponent(collection.id)}`,
  };
}

export function defaultContentShareMessage() {
  return { title: APP_NAME, path: ROUTES.home };
}

export function qqContentShareMessage(message, kind) {
  return {
    title: message?.title || APP_NAME,
    imageUrl: WECHAT_SHARE_IMAGE,
    ...(message?.query ? { query: `box_share=${kind}&${message.query}` } : {}),
  };
}

export function openQQSharedContent(query) {
  const routes = {
    entry: ROUTES.entryDetail,
    recording: ROUTES.recordingDetail,
    collection: ROUTES.collectionDetail,
  };
  const kind = query?.box_share;
  const route = Object.prototype.hasOwnProperty.call(routes, kind) ? routes[kind] : null;
  const id = String(query?.id ?? '');
  if (!route || !/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) return;
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  if (current?.route === route.slice(1) && String(current.options?.id) === id) return;
  openPage(route, { id }, { reset: !pages.length });
}

export function syncContentShareMenu(page, shareable) {
  if (!canUseNativeMiniProgramShare()) return;
  const pages = getCurrentPages();
  if (pages[pages.length - 1]?.$vm !== page) return;
  if (!shareable) uni.hideShareMenu({ fail() {} });
  else if (isQQMiniProgram()) uni.showShareMenu({ fail() {} });
  else showWechatShareMenu();
}
