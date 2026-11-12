<template>
  <!-- eslint-disable vue/no-multiple-template-root -->
  <!-- H5 使用原生滚动容器，避免 uni-app scroll-view 在页面激活时访问已卸载节点。 -->
  <!-- #ifdef H5 -->
  <view
    ref="h5Scroll"
    class="platform-scroll platform-scroll--h5"
    :class="resolvedClasses"
    @scroll="onH5Scroll"
  >
    <slot />
  </view>
  <!-- #endif -->
  <!-- #ifndef H5 -->
  <scroll-view
    scroll-y
    :scroll-into-view="scrollIntoView"
    class="platform-scroll"
    :class="resolvedClasses"
    @scroll="onNativeScroll"
    @scrolltolower="onNativeScrollToLower"
  >
    <slot />
  </scroll-view>
  <!-- #endif -->
</template>

<script>
export default {
  name: 'PlatformScroll',
  props: {
    scrollIntoView: {
      type: String,
      default: '',
      validator: (value) => !value || /^[A-Za-z][A-Za-z0-9_-]*$/.test(value),
    },
    variant: {
      type: String,
      default: '',
      validator: (value) => ['', 'page-shell', 'app-shell', 'recording-feed'].includes(value),
    },
    containerClass: {
      type: [String, Array, Object],
      default: '',
    },
  },
  emits: ['scroll', 'scrolltolower'],
  data() {
    return {
      reachedLowerBoundary: false,
    };
  },
  computed: {
    resolvedClasses() {
      const semanticClass = {
        'page-shell': ['platform-scroll--page-shell', 'shell-content', 'shell-scroll'],
        'app-shell': ['platform-scroll--app-shell', 'app-shell__scroll'],
        'recording-feed': ['platform-scroll--recording-feed', 'recording-feed'],
      }[this.variant] || [];
      return [...semanticClass, this.containerClass];
    },
  },
  watch: {
    scrollIntoView() {
      this.scrollToTarget();
    },
  },
  methods: {
    async scrollToTarget() {
      // #ifdef H5
      await this.$nextTick();
      const id = this.scrollIntoView;
      if (!id || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) return;
      const ref = this.$refs.h5Scroll;
      const container = ref?.$el || ref;
      const target = container?.querySelector?.(`#${id}`);
      if (!target || typeof container.scrollTo !== 'function') return;
      const top = target.getBoundingClientRect().top
        - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
      // #endif
    },
    normalizeScrollTop(event) {
      const top = event?.detail?.scrollTop
        ?? event?.scrollTop
        ?? event?.currentTarget?.scrollTop
        ?? event?.target?.scrollTop
        ?? 0;
      return Number(top) || 0;
    },
    onNativeScroll(event) {
      this.$emit('scroll', { scrollTop: this.normalizeScrollTop(event) });
    },
    onNativeScrollToLower() {
      this.$emit('scrolltolower');
    },
    onH5Scroll(event) {
      this.onNativeScroll(event);
      const target = event?.currentTarget ?? event?.target;
      if (!target) return;
      const remaining = target.scrollHeight - target.clientHeight - target.scrollTop;
      if (remaining <= 1 && !this.reachedLowerBoundary) {
        this.reachedLowerBoundary = true;
        this.$emit('scrolltolower');
      } else if (remaining > 1) {
        this.reachedLowerBoundary = false;
      }
    },
  },
};
</script>

<style scoped>
.platform-scroll {
  display: block;
  box-sizing: border-box;
}

.platform-scroll--page-shell {
  position: relative;
  z-index: 1;
  height: calc(100vh - 104rpx - env(safe-area-inset-top));
  min-height: calc(100vh - 104rpx - env(safe-area-inset-top));
  padding: 28rpx;
}

.platform-scroll--app-shell {
  height: calc(100vh - 136rpx - env(safe-area-inset-top));
  background: linear-gradient(
    180deg,
    var(--accent-subtle-color) 0%,
    var(--page-color) 112rpx
  );
}

.platform-scroll--recording-feed {
  height: 100%;
}

/* #ifdef H5 */
.platform-scroll--h5 {
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

.platform-scroll--page-shell {
  height: calc(100dvh - 104rpx - env(safe-area-inset-top));
  min-height: calc(100dvh - 104rpx - env(safe-area-inset-top));
}

.platform-scroll--app-shell {
  height: calc(100dvh - 136rpx - env(safe-area-inset-top));
}

@media screen and (min-width: 600px) and (max-height: 500px) and (orientation: landscape) {
  .platform-scroll--page-shell {
    height: calc(100vh - 56px - env(safe-area-inset-top));
    height: calc(100dvh - 56px - env(safe-area-inset-top));
    min-height: calc(100vh - 56px - env(safe-area-inset-top));
    min-height: calc(100dvh - 56px - env(safe-area-inset-top));
    padding: 16px 24px;
  }

  .platform-scroll--app-shell {
    height: calc(100vh - 64px - env(safe-area-inset-top));
    height: calc(100dvh - 64px - env(safe-area-inset-top));
  }
}
/* #endif */
</style>
