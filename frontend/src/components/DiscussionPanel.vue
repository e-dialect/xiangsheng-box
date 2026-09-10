<template>
  <view
    class="discussion-panel"
    :class="[`discussion-panel--${mode}`, { 'is-dragging': dragging }]"
    :style="panelStyle"
  >
    <view
      class="discussion-panel__dim"
      @tap="close"
    />
    <view
      class="discussion-panel__sheet"
      :style="sheetStyle"
      @tap.stop
    >
      <view
        class="discussion-panel__grab"
        role="button"
        aria-label="拖动或点按切换面板高度"
        @touchstart.stop="onTouchStart"
        @touchmove.stop.prevent="onTouchMove"
        @touchend.stop="onTouchEnd"
        @tap="toggleMode"
      />
      <view class="discussion-panel__head">
        <BaseButton
          v-if="stage === 'thread'"
          size="small"
          variant="ghost"
          text="返回"
          aria-label="返回留言列表"
          @click="backToList"
        />
        <text class="discussion-panel__title">
          {{ title }}
        </text>
        <BaseButton
          size="small"
          variant="ghost"
          text="关闭"
          aria-label="关闭讨论面板"
          @click="close"
        />
      </view>
      <scroll-view
        v-if="stage === 'list' && scopes.length > 1"
        class="discussion-panel__scopes"
        scroll-x
      >
        <view class="discussion-panel__scope-row">
          <view
            v-for="scope in scopes"
            :key="keyOf(scope)"
            class="discussion-panel__scope"
            :class="{ 'is-active': keyOf(scope) === activeScopeKey }"
            role="button"
            :aria-label="`切换到${scope.label}`"
            @tap="openScope(keyOf(scope))"
          >
            <text class="discussion-panel__scope-label">
              {{ scope.label }}
            </text>
            <text
              v-if="scope.subtitle"
              class="discussion-panel__scope-subtitle"
            >
              {{ scope.subtitle }}
            </text>
          </view>
        </view>
      </scroll-view>
      <DiscussionThread
        :key="threadKey"
        class="discussion-panel__thread"
        :target-type="activeScope.type"
        :target-id="activeScope.id"
        :root-id="stage === 'thread' ? rootId : null"
        :initial-comment-id="anchorComment"
        :heading="title"
        :show-heading="false"
        :external-composer="true"
        :page-size="pageSize"
        :auth-context="authContext"
        @loaded="onLoaded"
        @open-thread="pushThread"
        @sent="$emit('sent', $event)"
      >
        <template #composer="{ replyTarget, sending, submit, cancelReply }">
          <text
            v-if="rootDeleted"
            class="box-note discussion-panel__closed"
          >
            该留言已删除，回复不再开放。
          </text>
          <DiscussionComposer
            v-else
            v-model="draft"
            :label="stage === 'thread' ? '写一条回复' : '写一条留言'"
            :reply-target="replyTarget"
            :sending="sending"
            :maxlength="2000"
            @cancel-reply="cancelReply"
            @submit="(text) => onComposerSubmit(submit, text)"
          />
        </template>
      </DiscussionThread>
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import DiscussionThread from '@/components/DiscussionThread.vue';
import DiscussionComposer from '@/components/DiscussionComposer.vue';
import lockPageScroll from '@/utils/lockPageScroll';

const HALF = 'half';
const FULL = 'full';
const DRAG_STEP = 60;
const DRAG_CLOSE = 140;

export default {
  name: 'DiscussionPanel',
  components: { BaseButton, DiscussionThread, DiscussionComposer },
  props: {
    /* [{ type: 'entry' | 'recording', id, label, subtitle }]，至少一项 */
    scopes: {
      type: Array,
      required: true,
      validator: (value) => value.length > 0
        && value.every((item) => item && item.id && ['entry', 'recording'].includes(item.type)),
    },
    pageSize: { type: Number, default: 0 },
    /* 深链：直接打开某条一级评论的回复串，并高亮某条评论 */
    initialRoot: { type: [Number, String], default: null },
    initialComment: { type: [Number, String], default: null },
  },
  emits: ['close', 'sent'],
  data() {
    const first = this.scopes[0];
    const deepLink = Boolean(this.initialRoot || this.initialComment);
    return {
      stage: deepLink ? 'thread' : 'list',
      activeScopeKey: `${first.type}:${first.id}`,
      rootId: deepLink ? (this.initialRoot || this.initialComment) : null,
      anchorComment: deepLink ? (this.initialComment || null) : null,
      rootDeleted: false,
      mode: HALF,
      dragging: false,
      dragStartY: 0,
      dragDelta: 0,
      draft: '',
      keyboardOffset: 0,
      releaseScroll: null,
      viewportHandler: null,
    };
  },
  computed: {
    activeScope() {
      return this.scopes.find((item) => this.keyOf(item) === this.activeScopeKey) || this.scopes[0];
    },
    /* 目标对象变化时靠 key 重挂，迟到的响应不会写进新的讨论串 */
    threadKey() {
      return this.stage === 'thread'
        ? `${this.activeScopeKey}#${this.rootId}`
        : this.activeScopeKey;
    },
    title() {
      if (this.stage === 'thread') return '全部回复';
      return this.activeScope.label || '大家怎么说';
    },
    authContext() {
      const context = {};
      if (this.anchorComment) {
        context.commentId = this.anchorComment;
        context.rootId = this.rootId;
      }
      return context;
    },
    panelStyle() {
      return { '--kb-offset': `${this.keyboardOffset}px` };
    },
    sheetStyle() {
      const offset = this.dragging ? Math.max(0, this.dragDelta) : 0;
      return { transform: offset ? `translateY(${offset}px)` : '' };
    },
  },
  mounted() {
    this.releaseScroll = lockPageScroll();
    this.bindKeyboard();
  },
  beforeUnmount() {
    if (typeof this.releaseScroll === 'function') this.releaseScroll();
    this.unbindKeyboard();
  },
  methods: {
    keyOf(scope) {
      return `${scope.type}:${scope.id}`;
    },
    bindKeyboard() {
      // #ifdef MP-WEIXIN
      uni.onKeyboardHeightChange(this.onKeyboardHeight);
      // #endif
      // #ifdef H5
      if (typeof window !== 'undefined') {
        this.viewportHandler = () => {
          const viewport = window.visualViewport;
          this.keyboardOffset = viewport
            ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
            : 0;
        };
        window.visualViewport?.addEventListener('resize', this.viewportHandler);
      }
      // #endif
    },
    unbindKeyboard() {
      // #ifdef MP-WEIXIN
      uni.offKeyboardHeightChange(this.onKeyboardHeight);
      // #endif
      // #ifdef H5
      if (typeof window !== 'undefined' && this.viewportHandler) {
        window.visualViewport?.removeEventListener('resize', this.viewportHandler);
      }
      // #endif
    },
    onKeyboardHeight(result) {
      this.keyboardOffset = Math.max(0, Number(result?.height || 0));
    },
    openScope(key) {
      if (key === this.activeScopeKey) return;
      this.activeScopeKey = key;
      this.backToList();
    },
    pushThread(comment) {
      this.stage = 'thread';
      this.rootId = comment.id;
      this.anchorComment = null;
      this.rootDeleted = Boolean(comment.deleted);
    },
    backToList() {
      this.stage = 'list';
      this.rootId = null;
      this.anchorComment = null;
      this.rootDeleted = false;
    },
    onLoaded() {
      /* 首屏定位过一次就交给滚动容器，避免每次重挂都跳回锚点 */
      if (this.anchorComment) this.anchorComment = null;
    },
    async onComposerSubmit(submit, text) {
      const payload = {
        parentId: this.stage === 'thread' ? this.rootId : null,
        replyToId: null,
      };
      const sent = await submit(text, payload);
      if (sent) this.draft = '';
    },
    toggleMode() {
      this.mode = this.mode === FULL ? HALF : FULL;
    },
    touchY(event) {
      const touch = (event.touches && event.touches[0])
        || (event.changedTouches && event.changedTouches[0]);
      return touch ? touch.clientY : 0;
    },
    onTouchStart(event) {
      this.dragging = true;
      this.dragStartY = this.touchY(event);
      this.dragDelta = 0;
    },
    onTouchMove(event) {
      if (!this.dragging) return;
      this.dragDelta = this.touchY(event) - this.dragStartY;
    },
    onTouchEnd() {
      if (!this.dragging) return;
      const delta = this.dragDelta;
      this.dragging = false;
      this.dragDelta = 0;
      if (delta > DRAG_CLOSE && this.mode === HALF) {
        this.close();
        return;
      }
      if (delta > DRAG_STEP) {
        this.mode = HALF;
        return;
      }
      if (delta < -DRAG_STEP) this.mode = FULL;
    },
    close() {
      this.$emit('close');
    },
  },
};
</script>

<style scoped>
.discussion-panel {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.discussion-panel__dim {
  position: absolute;
  inset: 0;
  background: var(--veil-color);
}

.discussion-panel__sheet {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 62vh;
  min-height: 0;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--surface-color);
  transition: height 220ms ease;
}

.discussion-panel--full .discussion-panel__sheet {
  height: 92vh;
}

.discussion-panel.is-dragging .discussion-panel__sheet {
  transition: none;
}

.discussion-panel__grab {
  flex: none;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.discussion-panel__grab::after {
  content: '';
  width: 72rpx;
  height: 8rpx;
  border-radius: var(--radius-pill);
  background: var(--border-color);
}

.discussion-panel__head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  min-height: 88rpx;
}

.discussion-panel__title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-color);
}

.discussion-panel__scopes {
  flex: none;
  white-space: nowrap;
}

.discussion-panel__scope-row {
  display: inline-flex;
  gap: var(--space-2);
  padding: 0 var(--space-3) var(--space-2);
}

.discussion-panel__scope {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  min-height: 88rpx;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  border: 1rpx solid var(--border-color);
  background: var(--surface-subtle-color);
}

.discussion-panel__scope.is-active {
  border-color: var(--accent-color);
  background: var(--accent-subtle-color);
}

.discussion-panel__scope-label {
  font-size: var(--font-size-sm);
  color: var(--text-color);
}

.discussion-panel__scope-subtitle {
  font-size: var(--font-size-xs);
  color: var(--muted-color);
}

.discussion-panel__thread {
  flex: 1;
  min-height: 0;
  padding: 0 var(--space-3);
  padding-bottom: var(--kb-offset, 0px);
}

.discussion-panel__closed {
  display: block;
  padding-bottom: calc(var(--space-2) + env(safe-area-inset-bottom));
}

/* #ifdef H5 */
.discussion-panel__sheet {
  width: 100%;
  max-width: 640px;
  margin-inline: auto;
}

.discussion-panel--full .discussion-panel__sheet {
  height: min(92vh, calc(100dvh - 24px));
}

@media screen and (min-width: 600px) and (max-height: 500px) and (orientation: landscape) {
  .discussion-panel {
    flex-direction: row;
    justify-content: flex-end;
  }

  .discussion-panel__sheet,
  .discussion-panel--full .discussion-panel__sheet {
    height: 100%;
    max-height: none;
    width: 460px;
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  }
}
/* #endif */
</style>
