<template>
  <view
    v-if="open"
    class="sheet-mask preview-mask"
    @tap="$emit('cancel')"
  >
    <view class="sheet-mask-dim" />
    <view
      class="sheet preview-sheet"
      @tap.stop
    >
      <BaseButton
        class="preview-close"
        size="small"
        variant="ghost"
        aria-label="关闭实时预览"
        @click="$emit('cancel')"
      >
        关闭
      </BaseButton>
      <view class="sheet-title">
        {{ title }}
      </view>
      <view class="muted">
        {{ hint }}
      </view>
      <view
        v-if="model.skin"
        class="skin-meta"
      >
        <view class="skin-name">
          {{ model.skin.name }}
        </view>
        <view class="swatch-row">
          <view
            class="swatch"
            :style="{ background: model.skin.primary }"
          >
            主色
          </view>
          <view
            class="swatch"
            :style="{ background: model.skin.secondary, color: model.skin.textColor }"
          >
            辅色
          </view>
          <view
            class="swatch"
            :style="{ background: model.skin.background, color: model.skin.textColor }"
          >
            背景
          </view>
          <view
            class="swatch"
            :style="{ color: model.skin.textColor, background: model.skin.secondary }"
          >
            文字
          </view>
        </view>
        <image
          v-if="model.skin.previewImage"
          class="skin-cover"
          :src="model.skin.previewImage"
          mode="aspectFill"
        />
      </view>
      <view
        v-if="model.nativeLocked"
        class="hint-row warn"
      >
        ⚠️微信小程序原生组件无法自定义，该部分样式不会生效
      </view>
      <view
        v-for="row in model.skipped"
        :key="`skip-${row.group?.id || row.item?.id}`"
        class="skip-row"
      >
        {{ row.item?.name || row.group?.name }} · {{ row.hint }}
      </view>

      <view class="preview-label">
        首页录音流
      </view>
      <view
        class="mock-phone"
        :class="[model.shotClass, model.accentClass, { native: model.nativeLocked }]"
        :style="model.vars"
      >
        <view
          class="mock-grain"
          aria-hidden="true"
        />
        <view
          class="mock-nav"
          :class="{ locked: model.nativeLocked }"
        >
          {{ model.nativeLocked ? '系统默认顶栏' : '乡声集盒' }}
        </view>
        <view
          v-for="recording in model.sample.recordings"
          :key="recording.title"
          class="mock-recording"
        >
          <view class="mock-video">
            <view class="mock-play" />
          </view>
          <view class="mock-recording-copy">
            <view class="mock-recording-title">
              {{ recording.title }}
            </view>
            <view class="muted">
              {{ recording.caption }}
            </view>
          </view>
          <view class="mock-actions">
            <view class="mock-pill">
              赞
            </view>
            <view class="mock-pill">
              评
            </view>
            <view class="mock-pill">
              转
            </view>
          </view>
        </view>
        <view
          class="mock-tab"
          :class="{ locked: model.nativeLocked }"
        >
          <view>听</view>
          <view>查</view>
          <view>录</view>
          <view>我</view>
        </view>
      </view>

      <view class="preview-label">
        主题集盒
      </view>
      <view
        class="mock-phone"
        :class="[model.shotClass, model.accentClass]"
        :style="model.vars"
      >
        <view class="mock-nav">
          乡声集盒 · 月下乡音
        </view>
        <view class="mock-recording">
          <view class="mock-recording-title">
            01 月娘
          </view><view class="muted">
            月亮 · 2 段乡音
          </view><view class="mock-pill">
            城里 › 听录音
          </view><view class="mock-pill">
            仙游 › 听录音
          </view>
        </view>
      </view>
      <view class="preview-label">
        个人中心
      </view>
      <view
        class="mock-phone"
        :class="[model.shotClass, model.accentClass]"
        :style="model.vars"
      >
        <view
          class="mock-grain"
          aria-hidden="true"
        />
        <view class="mock-profile">
          <view class="mock-avatar" />
          <view class="mock-name">
            {{ model.sample.nickname }}
          </view>
          <view class="mock-tag">
            {{ model.sample.dialectTag }}
          </view>
        </view>
        <view class="mock-grid">
          <view
            v-for="recording in model.sample.recordings"
            :key="`grid-${recording.title}`"
            class="mock-tile"
          >
            {{ recording.title }}
          </view>
        </view>
      </view>

      <view class="preview-label">
        评论区
      </view>
      <view
        class="mock-phone mock-comments"
        :class="[model.shotClass, model.accentClass]"
        :style="model.vars"
      >
        <view
          class="mock-grain"
          aria-hidden="true"
        />
        <view
          v-for="row in model.sample.comments"
          :key="row.name"
          class="mock-bubble"
        >
          <view class="mock-avatar sm" />
          <view class="mock-bubble-body">
            <view class="mock-name">
              {{ row.name }}
            </view>
            <view>{{ row.text }}</view>
          </view>
        </view>
        <view class="mock-input">
          说点家乡话…
        </view>
      </view>

      <view class="preview-label">
        话题卡片
      </view>
      <view
        class="mock-phone mock-topics"
        :class="[model.shotClass, model.accentClass]"
        :style="model.vars"
      >
        <view
          class="mock-grain"
          aria-hidden="true"
        />
        <view
          v-for="topic in model.sample.topics"
          :key="topic"
          class="mock-topic"
        >
          # {{ topic }}
        </view>
      </view>

      <view class="sheet-actions">
        <BaseButton
          variant="ghost"
          size="small"
          @click="$emit('cancel')"
        >
          取消
        </BaseButton>
        <BaseButton
          size="small"
          @click="$emit('apply')"
        >
          立即应用
        </BaseButton>
      </view>
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import {
  THEME_PREVIEW_HINT,
  THEME_PREVIEW_SAMPLE,
} from '@/services/themeCenter';

export default {
  name: 'ThemeLivePreview',
  components: { BaseButton },
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '实时预览' },
    model: {
      type: Object,
      default: () => ({
        shotClass: ['shot-default'],
        skipped: [],
        nativeLocked: false,
        sample: THEME_PREVIEW_SAMPLE,
        vars: {},
        skin: null,
        accentClass: '',
      }),
    },
  },
  emits: ['cancel', 'apply'],
  data() {
    return { hint: THEME_PREVIEW_HINT };
  },
};
</script>

<style scoped>
.sheet-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 0;
}

.sheet-mask-dim {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: var(--text-color);
  opacity: 0.46;
}

.preview-sheet {
  position: relative;
  z-index: 1;
  width: 100%;
  max-height: 100vh;
  height: 100%;
  overflow: auto;
  padding: calc(var(--space-4) + var(--space-2)) var(--space-3) var(--space-4);
  border-radius: 0;
  background: var(--page-color);
  box-sizing: border-box;
}

.preview-close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  z-index: 2;
  margin: 0;
}

.sheet-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.muted {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.55;
}

.skin-meta {
  margin-top: var(--space-3);
}

.skin-name {
  font-size: var(--font-size-md);
  font-weight: 600;
}

.swatch-row {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.swatch {
  flex: 1;
  min-height: 44px;
  padding: var(--space-1);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--on-accent-color);
  font-size: var(--font-size-xs);
  text-align: center;
}

.skin-cover {
  display: block;
  width: 100%;
  height: 96px;
  margin-top: var(--space-2);
  border-radius: var(--radius-md);
  object-fit: cover;
}

.hint-row {
  margin-top: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.hint-row.warn {
  color: var(--warning-color);
}

.skip-row {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  opacity: 0.72;
}

.preview-label {
  margin-top: var(--space-3);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.mock-phone {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2);
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--page-color);
  letter-spacing: var(--dress-letter-spacing, 0em);
}

.mock-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: var(--dress-grain-opacity, 0.12);
  background-image: var(--dress-grain-image, var(--grain-dot));
  background-size: var(--dress-grain-size, 46rpx 46rpx);
}

.mock-nav,
.mock-tab {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--dress-nav-bar-background, var(--accent-color));
  color: var(--dress-nav-bar-color, var(--on-accent-color));
  border: 1px solid var(--dress-nav-bar-border-color, transparent);
  font-size: var(--font-size-xs);
}

.mock-tab {
  background: var(--dress-tab-bar-background, var(--accent-color));
  color: var(--dress-tab-bar-color, var(--on-accent-color));
  border-color: var(--dress-tab-bar-border-color, transparent);
}

.mock-tab > view:first-child {
  padding: 0 var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--dress-tab-bar-accent, var(--accent-color));
  color: var(--dress-tab-bar-on-accent, var(--on-accent-color));
}

.mock-nav.locked,
.mock-tab.locked {
  background: var(--surface-subtle-color);
  color: var(--muted-color);
}

.mock-recording {
  position: relative;
  z-index: 1;
  padding: var(--dress-card-padding, var(--space-2));
  border-radius: var(--dress-card-border-radius, var(--radius-md));
  background: var(--dress-card-background, var(--surface-color));
  border:
    var(--dress-card-border-width, 1px)
    solid var(--dress-card-border-color, var(--border-color));
  box-shadow: var(--dress-card-shadow, none);
}

.mock-video {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120rpx;
  border-radius: var(--radius-sm);
  background: var(--accent-subtle-color);
}

.mock-play {
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 16rpx 0 16rpx 28rpx;
  border-color: transparent transparent transparent var(--accent-color);
}

.mock-recording-title,
.mock-name {
  font-weight: 700;
  font-size: var(--font-size-sm);
}

.mock-actions,
.mock-grid,
.mock-topics {
  display: flex;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.mock-pill,
.mock-tag,
.mock-topic,
.mock-tile,
.mock-input,
.mock-bubble {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
}

.mock-profile {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-md);
  background: var(--dress-home-bg-background, var(--surface-color));
  color: var(--dress-home-bg-color, var(--text-color));
}

.mock-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--radius-pill);
  background: var(--accent-color);
  border:
    var(--dress-avatar-frame-border-width, 0px)
    solid var(--dress-avatar-frame-border-color, transparent);
  box-shadow: none;
}

.mock-avatar.sm {
  width: 40rpx;
  height: 40rpx;
  flex-shrink: 0;
  box-shadow: none;
}

.mock-grid .mock-tile {
  flex: 1;
  height: 72rpx;
  border-radius: var(--radius-sm);
  line-height: 72rpx;
  text-align: center;
}

.mock-comments {
  gap: var(--space-2);
}

.mock-bubble {
  position: relative;
  z-index: 1;
  display: flex;
  gap: var(--space-2);
  border-radius: var(--dress-comment-bubble-border-radius, var(--radius-md));
  background: var(--dress-comment-bubble-background, var(--accent-subtle-color));
  border:
    var(--dress-comment-bubble-border-width, 1px)
    solid var(--dress-comment-bubble-border-color, transparent);
  color: var(--text-color);
}

.mock-input {
  position: relative;
  z-index: 1;
  border-radius: var(--dress-input-box-border-radius, var(--radius-md));
  color: var(--muted-color);
  background: var(--dress-input-box-background, var(--accent-subtle-color));
  border:
    var(--dress-input-box-border-width, 0px)
    solid var(--dress-input-box-border-color, transparent);
}

.mock-topic {
  position: relative;
  z-index: 1;
  border-radius: var(--dress-topic-card-border-radius, var(--radius-md));
  background: var(--dress-topic-card-background, var(--accent-subtle-color));
  border:
    var(--dress-topic-card-border-width, 0px)
    solid var(--dress-topic-card-border-color, transparent);
}

.sheet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.sheet-actions .base-button {
  flex: 1;
}

.pressable:active {
  opacity: 0.72;
}

.shot-simple {
  background: var(--surface-subtle-color);
}

.shot-dialect {
  background: var(--accent-preview-tea);
}

.shot-retro {
  background: var(--accent-preview-osmanthus);
}

.shot-festival,
.shot-street {
  background: var(--accent-preview-clay);
}

.shot-folk {
  background: var(--accent-preview-osmanthus);
}

.shot-season {
  background: var(--accent-preview-tea);
}

.shot-guofeng {
  background: var(--accent-subtle-color);
}

.shot-cyber,
.shot-dark {
  background: var(--accent-preview-ink);
}

.shot-anime {
  background: var(--surface-subtle-color);
}

.dress-navbar .mock-nav:not(.locked) {
  box-shadow: 0 0 0 2rpx var(--gilt-color);
}

.dress-tabbar .mock-tab:not(.locked) {
  border-radius: var(--radius-pill);
}

.dress-actions .mock-pill {
  border-radius: var(--radius-sm);
}

.dress-cards .mock-recording,
.dress-cards .mock-tile {
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.dress-profile .mock-profile {
  background: var(--accent-subtle-color);
}

.dress-avatar .mock-avatar {
  box-shadow: 0 0 0 6rpx var(--gilt-color);
}

.dress-comment .mock-bubble {
  background: var(--surface-color);
}

.dress-topic .mock-topic {
  background: var(--accent-color);
  color: var(--on-accent-color);
}
</style>
