import { notify } from '@/services/feedback';

export const WECHAT_SHARE_IMAGE = '/static/share-cover.png';

const appShareBase = String(import.meta.env.VITE_BOX_SHARE_WEB_URL || '').trim().replace(/\/+$/, '');

function isNativeApp() {
  let enabled = false;
  // #ifdef APP-PLUS
  enabled = true;
  // #endif
  // #ifndef APP-PLUS
  enabled = false;
  // #endif
  return enabled;
}

export function hasShareTarget() {
  return !isNativeApp() || /^https:\/\/[^\s/?#]+(?:\/[^\s?#]*)?$/.test(appShareBase);
}

export function showWechatShareMenu() {
  // #ifdef MP-WEIXIN
  uni.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'], fail() {} });
  // #endif
}

export function canUseSystemShare() {
  if (isNativeApp()) return typeof uni.shareWithSystem === 'function';
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

function copyPageUrl(url, copiedTitle) {
  uni.setClipboardData({
    data: url,
    success: () => notify({ title: copiedTitle }),
    fail: () => notify({ title: '复制失败，请重试' }),
  });
}

export async function sharePage(message, copiedTitle) {
  if (!message) return;
  if (isNativeApp()) {
    if (!hasShareTarget()) return;
    const url = `${appShareBase}${message.path}`;
    if (canUseSystemShare()) {
      uni.shareWithSystem({
        type: 'text',
        summary: message.title,
        href: url,
        fail(error) {
          if (!/cancel/i.test(error?.errMsg || '')) copyPageUrl(url, copiedTitle);
        },
      });
    } else {
      copyPageUrl(url, copiedTitle);
    }
    return;
  }

  if (typeof window === 'undefined') return;
  const mount = import.meta.env.BASE_URL.replace(/\/$/, '');
  const url = `${window.location.origin}${mount}${message.path}`;
  const payload = { title: message.title, url };
  if (canUseSystemShare() && (!navigator.canShare || navigator.canShare(payload))) {
    try {
      await navigator.share(payload);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  copyPageUrl(url, copiedTitle);
}
