<template>
  <view v-if="theme">
    <view
      class="sheet-mask"
      @tap="$emit('close')"
    >
      <view class="sheet-mask-dim" />
      <view
        class="sheet"
        @tap.stop
      >
        <view class="shot-wrap">
          <view
            class="sheet-tools"
            @tap.stop
          >
            <BaseButton
              class="icon-btn"
              :class="{
                on: isItemFav('theme', theme.id),
              }"
              size="extra-small"
              variant="light"
              shape="circle"
              :aria-label="`${isItemFav('theme', theme.id) ? '取消收藏' : '收藏'}主题：${theme.name}`"
              :disabled="!theme.available"
              @click="$emit('toggle-favorite', 'theme', theme)"
            >
              {{ isItemFav('theme', theme.id) ? '★' : '☆' }}
            </BaseButton>
            <BaseButton
              class="icon-btn"
              size="extra-small"
              variant="light"
              shape="circle"
              :aria-label="`分享主题：${theme.name}`"
              :disabled="!theme.available"
              @click="$emit('share', 'theme', theme)"
            >
              ↗
            </BaseButton>
          </view>
          <view class="preview-label">
            首页录音流
          </view>
          <view
            class="shot shot-lg pressable"
            :class="[themePreviewShotClass(theme), { blurred: !theme.available }]"
            :style="themePreviewVars(theme)"
            @tap="$emit('open-zoom')"
          >
            <image
              v-if="themeDetailSrc(theme)"
              class="shot-photo"
              :src="themeDetailSrc(theme)"
              mode="aspectFill"
              lazy-load
              @error="$emit('preview-error', `detail:${theme.id}`)"
            />
            <template v-else>
              <view class="shot-home">
                <view class="shot-nav" />
                <view class="shot-feed" />
                <view class="shot-feed thin" />
                <view class="shot-tab" />
              </view>
              <view class="shot-me preview-feed">
                <view class="shot-feed" />
                <view class="shot-feed thin" />
                <view class="shot-tab" />
              </view>
            </template>
          </view>
          <view class="preview-label">
            个人中心
          </view>
          <view
            class="shot shot-lg pressable"
            :class="[themePreviewShotClass(theme), { blurred: !theme.available }]"
            :style="themePreviewVars(theme)"
            @tap="$emit('open-zoom')"
          >
            <view class="shot-me">
              <view class="shot-avatar" />
              <view class="shot-line" />
              <view class="shot-line short" />
              <view class="shot-feed" />
            </view>
            <view class="shot-home">
              <view class="shot-nav" />
              <view class="shot-feed thin" />
              <view class="shot-tab" />
            </view>
          </view>
          <view
            v-if="catalogBadge(theme)"
            class="soon-overlay"
          >
            {{ catalogBadge(theme) }}
          </view>
          <view
            v-if="isMiniProgram"
            class="preview-corner"
          >
            ⚠️小程序部分原生组件为系统默认样式
          </view>
        </view>
        <view class="sheet-title">
          {{ theme.name }}
        </view>
        <view class="muted">
          {{ theme.blurb }}
        </view>
        <view class="muted">
          预览仅为模拟效果，不会修改你的界面
        </view>
        <view class="tag-row">
          <view
            v-for="tag in themeTags(theme)"
            :key="`detail-${tag.kind}-${tag.label}`"
            class="tag"
            :class="tag.className"
          >
            {{ tag.label }}
          </view>
        </view>
        <view
          class="social-stats pressable"
          @tap="$emit('like', 'theme', theme)"
        >
          {{ statsOf('theme', theme).liked ? '♥' : '♡' }}
          热度 {{ statsOf('theme', theme).likes }}
          · 收藏 {{ statsOf('theme', theme).favorites }}
        </view>
        <view class="muted">
          喜欢仅代表喜爱，不等于拥有该装扮
        </view>
        <view
          v-if="theme.available && themeAccess(theme).hint"
          class="hint-row"
        >
          {{ themeAccess(theme).hint }}
        </view>
        <view
          v-if="!isMiniProgram"
          class="hint-row"
        >
          H5网页版：该主题全部样式完整生效
        </view>
        <view
          v-else
          class="hint-row warn"
        >
          微信小程序：原生导航栏、底部Tab栏受微信限制，部分样式无法生效
        </view>
        <view class="feature-title">
          会修改的元素
        </view>
        <view
          v-for="item in themeFeatures"
          :key="item"
          class="feature-item"
        >
          {{ item }}
        </view>
        <view
          v-if="!theme.available"
          class="soon-line"
        >
          该主题暂未开放，敬请期待
        </view>
        <view class="sheet-actions">
          <BaseButton
            variant="ghost"
            size="small"
            @click="$emit('close')"
          >
            取消
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="small"
            :disabled="!theme.available"
            @click="$emit('toggle-favorite', 'theme', theme)"
          >
            {{ isItemFav('theme', theme.id) ? '取消收藏' : '加入收藏' }}
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="small"
            :disabled="!theme.available"
            @click="$emit('share', 'theme', theme)"
          >
            分享
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="small"
            :disabled="!canLivePreviewItem(theme)"
            @click="$emit('live-preview', 'theme', theme)"
          >
            实时预览
          </BaseButton>
          <BaseButton
            size="small"
            :variant="themeActionVariant(theme)"
            :disabled="themeActionDisabled(theme)"
            @click="$emit('enable', theme)"
          >
            {{ themeActionLabel(theme) }}
          </BaseButton>
        </view>
      </view>
    </view>

    <view
      v-if="zoomOpen"
      class="sheet-mask zoom-mask"
      @tap="$emit('close-zoom')"
    >
      <view class="sheet-mask-dim" />
      <view
        class="zoom-sheet"
        @tap.stop
      >
        <BaseButton
          class="preview-close"
          size="small"
          variant="ghost"
          aria-label="关闭主题大图"
          @click="$emit('close-zoom')"
        >
          关闭
        </BaseButton>
        <view class="muted">
          {{ zoomHint }}
        </view>
        <movable-area class="zoom-area">
          <movable-view
            class="zoom-view"
            direction="all"
            :scale="true"
            scale-min="1"
            scale-max="3"
          >
            <image
              v-if="themeDetailSrc(theme)"
              class="shot shot-xl shot-photo"
              :src="themeDetailSrc(theme)"
              mode="aspectFit"
            />
            <view
              v-else
              class="shot shot-xl"
              :class="themePreviewShotClass(theme)"
              :style="themePreviewVars(theme)"
            >
              <view class="shot-home">
                <view class="shot-nav" />
                <view class="shot-feed" />
                <view class="shot-feed thin" />
                <view class="shot-tab" />
              </view>
              <view class="shot-me">
                <view class="shot-avatar" />
                <view class="shot-line" />
                <view class="shot-line short" />
              </view>
            </view>
          </movable-view>
        </movable-area>
      </view>
    </view>
  </view>
</template>

<script>
/* eslint-disable vue/require-prop-types -- internal route contract */
import BaseButton from '@/components/BaseButton.vue';

export default {
  name: 'ThemeCenterThemeDetail',
  components: { BaseButton },
  props: [
    'canLivePreviewItem', 'catalogBadge', 'isItemFav', 'isMiniProgram', 'statsOf',
    'theme', 'themeAccess', 'themeActionDisabled', 'themeActionLabel',
    'themeActionVariant', 'themeDetailSrc', 'themeFeatures', 'themePreviewShotClass',
    'themePreviewVars', 'themeTags', 'zoomHint', 'zoomOpen',
  ],
  emits: [
    'close',
    'close-zoom',
    'enable',
    'like',
    'live-preview',
    'open-zoom',
    'preview-error',
    'share',
    'toggle-favorite',
  ],
};
</script>
