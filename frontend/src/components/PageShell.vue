<template>
  <view
    class="page-shell"
    :class="[`theme-${resolvedTheme}`, `accent-${accent}`]"
    :style="outfitVars"
  >
    <view
      class="shell-grain"
      aria-hidden="true"
    />
    <view class="shell-topbar">
      <BaseButton
        v-if="showBack"
        class="shell-back"
        size="small"
        variant="ghost"
        shape="circle"
        aria-label="返回"
        @click="handleBack"
      >
        <text
          class="shell-back-glyph"
          aria-hidden="true"
        >
          ‹
        </text>
      </BaseButton>
      <view
        v-else
        class="shell-back-placeholder"
      />
      <text class="shell-title">
        {{ title }}
      </text>
      <BaseButton
        v-if="actionText"
        class="shell-action"
        size="small"
        :text="actionText"
        @click="$emit('action')"
      />
      <BaseButton
        v-else-if="refreshable"
        class="shell-action"
        size="small"
        variant="ghost"
        text="刷新"
        aria-label="刷新当前页面"
        :loading="refreshing"
        :disabled="refreshing"
        @click="$emit('refresh')"
      />
      <view
        v-else
        class="shell-action-placeholder"
      />
    </view>
    <slot name="before" />
    <PlatformScroll
      v-if="scroll"
      variant="page-shell"
      :refreshable="refreshable"
      :refreshing="refreshing"
      :container-class="contentClass"
      @refresh="$emit('refresh')"
      @scroll="onScroll"
      @scrolltolower="$emit('scrolltolower')"
    >
      <slot />
    </PlatformScroll>
    <view
      v-else
      class="shell-content"
      :class="contentClass"
    >
      <slot />
    </view>
    <FeedbackHost />
  </view>
</template>

<script>
import { getAccentPreference } from '@/services/theme';
import { hydrateOutfitStyle } from '@/services/themeCenter';
import { getAppliedOutfitVars } from '@/services/themeSchema';
import { goBack, ROUTES } from '@/services/navigation';
import BaseButton from '@/components/BaseButton.vue';
import FeedbackHost from '@/components/FeedbackHost.vue';
import PlatformScroll from '@/components/PlatformScroll.vue';

export default {
  name: 'PageShell',
  components: { BaseButton, FeedbackHost, PlatformScroll },
  props: {
    refreshable: { type: Boolean, default: false },
    refreshing: { type: Boolean, default: false },
    title: {
      type: String,
      required: true,
    },
    showBack: {
      type: Boolean,
      default: true,
    },
    actionText: {
      type: String,
      default: '',
    },
    scroll: {
      type: Boolean,
      default: true,
    },
    contentClass: {
      type: [String, Array, Object],
      default: '',
    },
    backFallback: {
      type: String,
      default: ROUTES.home,
    },
    interceptBack: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['action', 'back', 'scroll', 'scrolltolower', 'refresh'],
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
    onScroll(event) {
      const top = event?.detail?.scrollTop
        ?? event?.scrollTop
        ?? event?.currentTarget?.scrollTop
        ?? event?.target?.scrollTop
        ?? 0;
      this.$emit('scroll', { scrollTop: Number(top) || 0 });
    },
    handleBack() {
      this.$emit('back');
      if (this.interceptBack) return;
      goBack(this.backFallback);
    },
  },
};
</script>

<style scoped>
/* 颜色 Token 来自全局 styles/tokens.scss；暗色由 .theme-dark 全局规则覆盖子树 */
.page-shell {
  position: relative;
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
  background: var(--page-color);
  color: var(--text-color);
  letter-spacing: var(--dress-letter-spacing, 0em);
}

.shell-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: var(--dress-grain-opacity, 0);
  background-image: var(--dress-grain-image, var(--grain-dot));
  background-size: var(--dress-grain-size, 46rpx 46rpx);
}

.shell-topbar {
  position: relative;
  z-index: 1;
  height: calc(104rpx + env(safe-area-inset-top));
  display: grid;
  grid-template-columns: minmax(56rpx, 1fr) auto minmax(56rpx, 1fr);
  align-items: center;
  gap: 16rpx;
  padding: env(safe-area-inset-top) 24rpx 0;
  background: var(
    --dress-nav-bar-background,
    linear-gradient(90deg, var(--surface-color), var(--accent-subtle-color))
  );
  border-bottom: 1rpx solid var(--dress-nav-bar-border-color, var(--border-color));
  color: var(--dress-nav-bar-color, var(--text-color));
  box-sizing: border-box;
}

.shell-back-placeholder {
  width: 56rpx;
}

.shell-back {
  justify-self: start;
  margin: 0;
}

.shell-back-glyph {
  font-size: 40rpx;
  line-height: 1;
}

.shell-title {
  min-width: 0;
  max-width: 420rpx;
  text-align: center;
  font-family: STSong, SimSun, serif;
  font-size: 32rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
  overflow-wrap: anywhere;
}

.shell-action,
.shell-action-placeholder {
  min-width: 0;
}

.shell-action {
  margin: 0;
  justify-self: end;
}

.shell-content {
  position: relative;
  z-index: 1;
  min-height: calc(100vh - 104rpx - env(safe-area-inset-top));
  padding: 28rpx;
  box-sizing: border-box;
}

.shell-scroll {
  height: calc(100vh - 104rpx - env(safe-area-inset-top));
}

/* #ifdef H5 */
.page-shell {
  min-height: 100dvh;
}

.shell-content {
  min-height: calc(100dvh - 104rpx - env(safe-area-inset-top));
}

.shell-scroll {
  height: calc(100dvh - 104rpx - env(safe-area-inset-top));
}

@media screen and (min-width: 960px) {
  .page-shell {
    max-width: 960px;
    margin: 0 auto;
    border-inline: 1rpx solid var(--border-color);
  }

  .shell-content {
    width: 100%;
    max-width: 880px;
    margin-inline: auto;
  }
}

@media screen and (min-width: 600px) and (max-height: 500px) and (orientation: landscape) {
  .shell-topbar {
    height: calc(56px + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 20px 0;
    grid-template-columns: minmax(40px, 1fr) auto minmax(40px, 1fr);
    gap: 12px;
  }

  .shell-back-placeholder {
    width: 40px;
  }

  .shell-title {
    max-width: 420px;
    font-size: 22px;
  }

  .shell-content {
    min-height: calc(100vh - 56px - env(safe-area-inset-top));
    min-height: calc(100dvh - 56px - env(safe-area-inset-top));
    padding: 16px 24px;
  }

  .shell-scroll {
    height: calc(100vh - 56px - env(safe-area-inset-top));
    height: calc(100dvh - 56px - env(safe-area-inset-top));
  }
}
/* #endif */
</style>
