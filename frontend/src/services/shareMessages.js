import { SHARE_TAGLINE } from '@/const/branding';
import { currentProductName } from '@/services/productProfile';
import { ROUTES } from '@/services/navigation';

export function message(successMessage, failMessage) {
  return {
    success() {
      uni.showToast({
        title: successMessage,
        icon: 'success',
      });
    },
    fail() {
      uni.showToast({
        title: failMessage,
        icon: 'error',
      });
    },
  };
}

export function defaultMessage() {
  return message('分享成功', '分享失败');
}
export default {
  onShareTimeline() {
    return {
      title: `${currentProductName()}：${SHARE_TAGLINE}`,
      path: ROUTES.home,
      imageUrl: 'https://cos.edialect.top/miniprogram/fm.gif',
      ...defaultMessage(),
    };
  },
};
