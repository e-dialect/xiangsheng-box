<script>
import { appRoutePath, goNotFound } from '@/services/navigation';
// app.js
import { getLoginStatus } from '@/services/login';
import { hydrateCapabilities } from '@/services/capabilities';
import { isH5Runtime } from '@/services/platform';
import {
  ensureDialectOnboarding,
  ONBOARDING_REASONS,
} from '@/services/dialectOnboarding';
import { bindThemeAdapters, pullThemeCloudState } from '@/services/themeApi';
import { applyTheme } from '@/services/theme';
import { hydrateOutfitStyle } from '@/services/themeCenter';
import pagesJson from '@/pages.json';

export default {
  data() {
    return {};
  },
  async onLaunch() {
    bindThemeAdapters();
    applyTheme();
    hydrateOutfitStyle();
    this.globalData.capabilities = await hydrateCapabilities();
    if (!this.globalData.id) {
      const token = uni.getStorageSync('token');
      const storedId = uni.getStorageSync('id');
      if (token && storedId !== undefined && storedId !== null && storedId !== '') {
        this.globalData.id = storedId;
      }
    }
    if (uni.getSystemInfoSync().uniPlatform === 'web') {
      const pages = pagesJson.pages.map((page) => `/${page.path}`);
      const currentPath = appRoutePath(window.location.pathname, import.meta.env.BASE_URL);
      // history 模式下 '/' 已由路由原生渲染首页（pages.json 第一项），
      // 不能再 reLaunch：重建已挂载页面会使首页 feed 接口重复发起一次。
      if (currentPath !== '/' && currentPath !== '' && !pages.includes(currentPath)) {
        goNotFound();
      }
    }

    uni.getSystemInfo({
      success: (e) => {
        this.globalData.platform = e.platform;
        this.globalData.StatusBar = e.statusBarHeight;
        let capsule = null;
        if (!isH5Runtime(e) && typeof uni.getMenuButtonBoundingClientRect === 'function') {
          try {
            capsule = uni.getMenuButtonBoundingClientRect();
          } catch {
            // Keep the platform-neutral fallback below when the optional API fails.
          }
        }

        if (capsule) {
          this.globalData.Custom = capsule;
          this.globalData.CustomBar = capsule.bottom + capsule.top - e.statusBarHeight;
        } else {
          this.globalData.CustomBar = e.statusBarHeight + 50;
        }
      },
    });
    const loggedIn = await getLoginStatus();
    if (loggedIn) {
      try {
        await pullThemeCloudState();
      } catch {
        // Local outfit stays until the next successful sync.
      }
      ensureDialectOnboarding(
        this.globalData.userInfo,
        ONBOARDING_REASONS.MISSING_DIALECT,
      );
    }
  },
  globalData: {
    userInfo: {
      avatar: '',
      nickname: '',
    },
    platform: '',
    StatusBar: 0,
    Custom: null,
    CustomBar: 0,
    contribution: 0,
    id: null,
    showRedirectTips: false,
    capabilities: {},
    comment: null,
    watch(method) {
      const obj = this;
      Object.defineProperty(obj, 'data', {
        configurable: true,
        enumerable: true,
        set(value) {
          if (value.avatar) {
            this.userInfo.avatar = value.avatar;
          }

          if (value.nickname) {
            this.userInfo.nickname = value.nickname;
          }

          method(value);
        },
        get() {
          return this;
        },
      });
    },
  },
};
</script>
<style lang="scss">
/* 全局 Design Tokens：全站颜色/间距/圆角/字号唯一来源（M1·设计系统） */
@use '@/styles/tokens.scss';
</style>

<style>
@import 'colorui/main.css';
@import 'colorui/icon.css';
@import '@/utils/u-parse/u-parse.css';
@import '@/styles/legacy-form-compat.scss';

page {
  background-color: var(--page-color);
  color: var(--text-color);
}

/* #ifdef H5 */
html[data-theme='dark'],
html[data-theme='dark'] page {
  background: var(--page-color);
  color-scheme: dark;
}

/* uni-app 的 H5 Loading 在淡出节点尚未销毁时仍可能保留透明 mask；
 * 离场反馈不可继续阻断页面操作。 */
uni-toast.uni-fade-leave-active,
uni-toast.uni-fade-leave-active .uni-mask {
  pointer-events: none;
}

/* 页面背景色跟随主题/页面切换时平滑过渡，避免深色↔浅色硬切闪变 */
page {
  transition: background-color 0.25s ease;
}

/*
 * P1 页面切换动画（H5 端）：新页面插入时淡入 + 轻微滑入。
 * - 仅在 services/navigation.js 的 openPage / goBack 导航时，为 <html> 临时
 *   加上 page-transitioning 类后才启用；首屏加载 / 硬刷新 / 深链直达不会带
 *   该类，因此首屏不会误触发动画（满足 #203/#217「首屏无劣化」）。
 * - 仅使用 transform / opacity 合成属性，不触发布局重排；动画结束后不保留
 *   transform（默认 fill-mode），避免为 position:fixed 后代创建新的包含块。
 * - opacity 从 0 渐显，让新页面（含背景）平滑浮现，天然承担深色首页 ↔ 浅色
 *   普通页切换时的背景 bridging：旧页面仍在下方垫底，避免背景色瞬间闪变。
 */
html.page-transitioning uni-page-wrapper {
  animation: page-enter 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}

@keyframes page-enter {
  from {
    opacity: 0;
    transform: translate3d(16px, 0, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

/* 尊重系统「减弱动态效果」设置，关闭页面切换动画 */
@media (prefers-reduced-motion: reduce) {
  html.page-transitioning uni-page-wrapper {
    animation: none;
  }
}

/*
 * UniApp 默认按窗口宽度线性放大 H5 的 rpx。平板、桌面和手机横屏如果继续
 * 使用该比例，移动端字号与间距会被放大到挤占主要任务区。宽视口统一停在
 * 平板阅读尺度；短横屏进一步压缩垂直占用，页面壳再负责布局重排。
 */
@media screen and (min-width: 600px) {
  html {
    font-size: 24px !important;
  }
}

@media screen and (min-width: 600px) and (max-height: 500px) and (orientation: landscape) {
  html {
    font-size: 20px !important;
  }
}
/* #endif */

.scrollPage {
  height: 100vh;
}

.layout-index {
  position: absolute;
  top: 45%;
  width: 100vw;
}

.layout-index-login {
  position: absolute;
  top: 33%;
  width: 100vw;
}

.index-card {
  background-color: #ffffff;
  padding: 30rpx 30rpx;
  border-radius: 20rpx;
  margin: 5vw;
}

.card-name {
  color: #115e83;
  font-size: 36rpx;
  font-weight: 700;
}

.card-slogan {
  color: black;
  margin-top: 10rpx;
  font-size: 32rpx;
  font-weight: 300;
}

.card-btn {
  position: absolute;
  right: 10vw;
  top: 6vh;
  font-size: 26rpx;
}

.index-word {
  background-color: #ffffff;
  border-radius: 20rpx;
  height: 25vh;
  margin: 5vw;
}

.word-sy {
  display: -webkit-box;
  word-break: break-all;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 7;
  overflow: hidden;
  text-overflow: ellipsis;
}

.index-search {
  background-color: #ffffff;
  border-radius: 20rpx;
  margin: 5vw;
}

.stand-view {
  height: 10vh;
}

.login-input {
  background-color: #f2f3f7;
  border-radius: 5000rpx;
  display: flex;
  margin: 30rpx 60rpx;
  padding: 20rpx;
}

.btn {
  margin: 10vh auto;
  background-color: white;
}
</style>
