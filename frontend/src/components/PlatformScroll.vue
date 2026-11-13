<template>
  <!-- eslint-disable vue/no-multiple-template-root -->
  <!-- H5 使用原生滚动容器，避免 uni-app scroll-view 在页面激活时访问已卸载节点。 -->
  <!-- #ifdef H5 -->
  <view
    ref="h5Scroll"
    class="platform-scroll platform-scroll--h5"
    :class="resolvedClasses"
    @scroll="onH5Scroll"
    @touchstart="onPullStart"
    @touchmove="onPullMove"
    @touchend="onPullEnd"
    @touchcancel="resetPull"
  >
    <view
      v-if="refreshable && (pullDistance || refreshing)"
      class="refresh-status"
      role="status"
      aria-live="polite"
    >
      {{ refreshing ? '正在刷新…' : pullDistance >= 64 ? '松开刷新' : '下拉刷新' }}
    </view>
    <slot />
  </view>
  <!-- #endif -->
  <!-- #ifndef H5 -->
  <scroll-view
    scroll-y
    :refresher-enabled="refreshable"
    :refresher-triggered="refreshing"
    :scroll-into-view="scrollIntoView"
    class="platform-scroll"
    :class="resolvedClasses"
    @refresherrefresh="requestRefresh"
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
    refreshable: { type: Boolean, default: false },
    refreshing: { type: Boolean, default: false },
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
  emits: ['scroll', 'scrolltolower', 'refresh'],
  data() {
    return {
      reachedLowerBoundary: false,
      pullStart: null,
      pullDistance: 0,
      refreshRequested: false,
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
    refreshing(value) {
      if (!value) this.refreshRequested = false;
      this.resetPull();
    },
    refreshable() { this.resetPull(); },
    scrollIntoView() {
      this.scrollToTarget();
    },
  },
  methods: {
    resetPull() { this.pullStart = null; this.pullDistance = 0; },
    requestRefresh() {
      if (!this.refreshable || this.refreshing || this.refreshRequested) return;
      this.refreshRequested = true;
      this.$emit('refresh');
      // If the consumer has no async work, allow another gesture after its update.
      this.$nextTick(() => { if (!this.refreshing) this.refreshRequested = false; });
    },
    onPullStart(event) {
      this.resetPull();
      if (!this.refreshable || this.refreshing || event.touches?.length !== 1) return;
      const target = event.currentTarget;
      if ((target?.scrollTop || 0) > 0) return;
      const origin = event.target;
      if (origin?.closest?.('input, textarea, button, [role="button"], [contenteditable="true"]')) return;
      const touch = event.touches[0];
      this.pullStart = { x: touch.clientX, y: touch.clientY };
    },
    onPullMove(event) {
      if (!this.pullStart) return;
      if (event.touches?.length !== 1 || (event.currentTarget?.scrollTop || 0) > 0) {
        this.resetPull(); return;
      }
      const touch = event.touches[0];
      const dy = touch.clientY - this.pullStart.y;
      if (dy < 0 || Math.abs(touch.clientX - this.pullStart.x) > Math.abs(dy)) {
        this.resetPull(); return;
      }
      this.pullDistance = Math.min(96, dy * 0.5);
    },
    onPullEnd() {
      const ready = this.pullDistance >= 64;
      this.resetPull();
      if (ready) this.requestRefresh();
    },
    async scrollToTarget() {
      // #ifdef H5
      await this.$nextTick();
      const id = this.scrollIntoView;
      if (!id || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) return;
      const ref = this.$refs.h5Scroll;
      const container = ref?.$el || ref;
      const target = container?.querySelector?.(`#${id}`);
      if (!target || typeof container.scrollTo !== 'function') return;
      // The page can mark its sticky header; measure it on every jump so wrapping
      // or a viewport change does not leave the requested field behind the header.
      const header = container.querySelector('[data-scroll-offset]');
      const offset = Math.max(0, Number(header?.getBoundingClientRect().height) || 0);
      const top = target.getBoundingClientRect().top
        - container.getBoundingClientRect().top + container.scrollTop - offset;
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
.refresh-status { text-align: center; padding: 12px; color: var(--text-secondary-color); }
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
