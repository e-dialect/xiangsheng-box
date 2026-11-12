<template>
  <view
    class="app-shell immersive-shell"
    :class="[`theme-${resolvedTheme}`, `accent-${accent}`]"
    :style="outfitVars"
  >
    <view class="app-shell__header">
      <view class="app-shell__heading">
        <view class="app-shell__brand">
          乡声集盒
        </view>
        <view class="app-shell__title">
          {{ title }}
        </view>
      </view>
      <BaseButton
        v-if="actionText"
        size="small"
        variant="light"
        :text="actionText"
        @click="$emit('action')"
      />
    </view>
    <PlatformScroll
      v-if="scroll"
      variant="app-shell"
      :scroll-into-view="scrollIntoView"
      @scrolltolower="$emit('scrolltolower')"
    >
      <view class="app-shell__content">
        <slot />
      </view>
      <view class="app-shell__footer">
        把乡音录下来，让每个词条都有来处。
      </view>
    </PlatformScroll>
    <view
      v-else
      class="app-shell__content app-shell__content--fixed"
    >
      <slot />
    </view>
    <HomeTabBar :active="active" />
    <FeedbackHost />
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import FeedbackHost from '@/components/FeedbackHost.vue';
import HomeTabBar from '@/components/home/HomeTabBar.vue';
import PlatformScroll from '@/components/PlatformScroll.vue';
import { getAccentPreference } from '@/services/theme';
import { hydrateOutfitStyle } from '@/services/themeCenter';
import { getAppliedOutfitVars } from '@/services/themeSchema';

export default {
  name: 'AppShell',
  components: {
    BaseButton, FeedbackHost, HomeTabBar, PlatformScroll,
  },
  props: {
    scrollIntoView: { type: String, default: '' },
    title: { type: String, required: true },
    active: { type: String, required: true },
    actionText: { type: String, default: '' },
    scroll: { type: Boolean, default: true },
  },
  emits: ['action', 'scrolltolower'],
  data() {
    return {
      resolvedTheme: 'light',
      accent: getAccentPreference(),
      outfitVars: {},
    };
  },
  mounted() {
    uni.$on('theme-change', this.handleThemeChange);
    hydrateOutfitStyle();
    this.syncOutfitVars();
  },
  beforeUnmount() {
    uni.$off('theme-change', this.handleThemeChange);
  },
  methods: {
    syncOutfitVars() {
      this.outfitVars = getAppliedOutfitVars();
    },
    handleThemeChange(theme) {
      this.resolvedTheme = theme?.resolved || 'light';
      this.accent = theme?.accent || getAccentPreference();
      this.syncOutfitVars();
    },
  },
};
</script>

<style scoped>
.app-shell {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  min-height: 100vh;
  box-sizing: border-box;
  background: var(--page-color);
  color: var(--text-color);
}
.app-shell__header {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  height: calc(136rpx + env(safe-area-inset-top));
  padding: calc(20rpx + env(safe-area-inset-top)) 30rpx 20rpx;
  box-sizing: border-box;
  overflow: hidden;
  background: linear-gradient(
    155deg,
    var(--immersive-bg-strong-color) 0%,
    var(--immersive-bg-soft-color) 62%,
    var(--immersive-bg-color) 100%
  );
  border-bottom: 1rpx solid var(--immersive-border-color);
  color: var(--on-immersive-color);
}
.app-shell__header::after {
  content: '';
  position: absolute;
  z-index: -1;
  top: -150rpx;
  right: -120rpx;
  width: 420rpx;
  height: 420rpx;
  border-radius: 50%;
  background: radial-gradient(circle, var(--immersive-glow-color), transparent 68%);
  pointer-events: none;
}
.app-shell__heading {
  min-width: 0;
}
.app-shell__brand {
  color: var(--immersive-accent-color);
  font-size: 16rpx;
  font-weight: 900;
  letter-spacing: 3rpx;
}
.app-shell__title {
  margin-top: 6rpx;
  font-family: STSong, SimSun, serif;
  font-size: 40rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
  line-height: 1.16;
  overflow-wrap: anywhere;
}
.app-shell__scroll {
  height: calc(100vh - 136rpx - env(safe-area-inset-top));
  background: linear-gradient(
    180deg,
    var(--accent-subtle-color) 0%,
    var(--page-color) 112rpx
  );
}
.app-shell__content {
  min-height: calc(100vh - 296rpx - env(safe-area-inset-top));
  padding: 30rpx 28rpx calc(148rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.app-shell__content--fixed {
  min-height: calc(100vh - 136rpx - env(safe-area-inset-top));
  padding-bottom: calc(148rpx + env(safe-area-inset-bottom));
  background: linear-gradient(
    180deg,
    var(--accent-subtle-color) 0%,
    var(--page-color) 112rpx
  );
}
.app-shell__footer {
  padding: 24rpx 30rpx calc(148rpx + env(safe-area-inset-bottom));
  color: var(--muted-color);
  text-align: center;
  font-family: STSong, SimSun, serif;
  font-size: 21rpx;
  letter-spacing: 2rpx;
}

/* #ifdef H5 */
.app-shell {
  height: 100dvh;
  min-height: 100dvh;
}

.app-shell__scroll {
  height: calc(100dvh - 136rpx - env(safe-area-inset-top));
}

.app-shell__content {
  min-height: calc(100dvh - 296rpx - env(safe-area-inset-top));
}

.app-shell__content--fixed {
  min-height: calc(100dvh - 136rpx - env(safe-area-inset-top));
}

@media screen and (min-width: 960px) {
  .app-shell {
    max-width: 960px;
    margin: 0 auto;
    border-inline: 1rpx solid var(--border-color);
  }

  .app-shell__content,
  .app-shell__footer {
    width: 100%;
    max-width: 880px;
    margin-inline: auto;
  }
}

@media screen and (min-width: 600px) and (max-height: 500px) and (orientation: landscape) {
  .app-shell__header {
    height: calc(64px + env(safe-area-inset-top));
    padding: calc(8px + env(safe-area-inset-top)) 24px 8px;
  }

  .app-shell__heading {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .app-shell__brand {
    flex: 0 0 auto;
    font-size: 10px;
    letter-spacing: 2px;
  }

  .app-shell__title {
    margin-top: 0;
    font-size: 24px;
    letter-spacing: 1px;
  }

  .app-shell__scroll {
    height: calc(100vh - 64px - env(safe-area-inset-top));
    height: calc(100dvh - 64px - env(safe-area-inset-top));
  }

  .app-shell__content {
    min-height: calc(100vh - 120px - env(safe-area-inset-top));
    min-height: calc(100dvh - 120px - env(safe-area-inset-top));
    padding: 10px 24px calc(72px + env(safe-area-inset-bottom));
  }

  .app-shell__content--fixed {
    min-height: calc(100vh - 64px - env(safe-area-inset-top));
    min-height: calc(100dvh - 64px - env(safe-area-inset-top));
  }

  .app-shell__footer {
    padding: 12px 24px calc(72px + env(safe-area-inset-bottom));
    font-size: 12px;
  }
}
/* #endif */
</style>
