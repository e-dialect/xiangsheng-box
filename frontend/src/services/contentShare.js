import { APP_NAME } from '@/const/branding';
import { pageUrl, ROUTES } from '@/services/navigation';
import { showWechatShareMenu } from '@/services/pageShare';
import { isWechatMiniProgram } from '@/services/platform';
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

export function defaultContentShareMessage() {
  return { title: APP_NAME, path: ROUTES.home };
}

export function syncContentShareMenu(page, shareable) {
  if (!isWechatMiniProgram()) return;
  const pages = getCurrentPages();
  if (pages[pages.length - 1]?.$vm !== page) return;
  if (shareable) showWechatShareMenu();
  else uni.hideShareMenu({ fail() {} });
}
