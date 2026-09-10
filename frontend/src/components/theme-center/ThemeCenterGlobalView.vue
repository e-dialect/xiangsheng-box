<template>
  <view
    v-if="visible"
    class="pane"
  >
    <view class="current-card">
      <view class="current-copy">
        <view class="kicker">
          当前使用
        </view>
        <view class="current-name">
          {{ activeTheme.name }}
        </view>
        <view class="muted">
          全局主题将统一改变导航栏、按钮、卡片、背景、文字色彩。
        </view>
        <view class="filters appearance">
          <view
            v-for="item in appearanceOptions"
            :key="item.value"
            class="chip pressable"
            :class="{ active: appearance === item.value }"
            @tap="$emit('appearance', item.value)"
          >
            {{ item.label }}
          </view>
        </view>
      </view>
      <view
        class="shot shot-sm"
        :class="themePreviewShotClass(activeTheme)"
        :style="themePreviewVars(activeTheme)"
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
    </view>

    <view
      v-if="!themes.length"
      class="empty-wrap"
    >
      <ThemeStatusPane
        :scene="emptyScene"
        @action="$emit('empty-action')"
      />
    </view>
    <view
      v-else
      class="theme-grid"
    >
      <view
        v-for="theme in themes"
        :key="theme.id"
        class="theme-card pressable"
        :class="{
          placeholder: isGreyTheme(theme),
          active: theme.id === activeTheme.id,
        }"
        @tap="$emit('preview', theme)"
      >
        <view class="shot-wrap">
          <image
            v-if="themeCoverSrc(theme)"
            class="shot shot-photo"
            :class="{ blurred: !theme.available }"
            :src="themeCoverSrc(theme)"
            mode="aspectFill"
            lazy-load
            @error="$emit('preview-error', theme.id)"
          />
          <view
            v-else
            class="shot"
            :class="[themePreviewShotClass(theme), { blurred: !theme.available }]"
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
          <view
            v-if="catalogBadge(theme)"
            class="soon-overlay"
          >
            {{ catalogBadge(theme) }}
          </view>
        </view>
        <view
          class="theme-name"
          @tap.stop="$emit('open-detail', theme)"
        >
          {{ theme.name }}
        </view>
        <view class="muted">
          {{ theme.description }}
        </view>
        <view class="theme-foot">
          <view class="tag-row">
            <view
              v-for="tag in themeTags(theme)"
              :key="`${theme.id}-${tag.kind}-${tag.label}`"
              class="tag"
              :class="tag.className"
            >
              {{ tag.label }}
            </view>
          </view>
          <view
            class="theme-action-wrap"
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
            <BaseButton
              class="theme-action"
              size="extra-small"
              :variant="themeActionVariant(theme)"
              :disabled="themeActionDisabled(theme)"
              @click="$emit('enable', theme)"
            >
              {{ themeActionLabel(theme) }}
            </BaseButton>
          </view>
        </view>
        <view class="heat-line">
          热度 {{ statsOf('theme', theme).likes }}
        </view>
      </view>
      <view class="coming-card">
        敬请期待
      </view>
    </view>

    <view class="foot-note">
      全局主题会带轻微地域纹理，不会改变录音播放内容；部分组件在微信小程序存在限制。
    </view>
    <view
      v-for="line in footerLines"
      :key="line"
      class="foot-note"
    >
      {{ line }}
    </view>
  </view>
</template>

<script>
/* eslint-disable vue/require-prop-types -- internal route contract */
import BaseButton from '@/components/BaseButton.vue';
import ThemeStatusPane from '@/components/ThemeStatusPane.vue';

export default {
  name: 'ThemeCenterGlobalView',
  components: { BaseButton, ThemeStatusPane },
  props: [
    'activeTheme', 'appearance', 'appearanceOptions', 'catalogBadge', 'emptyScene',
    'footerLines', 'isGreyTheme', 'isItemFav', 'statsOf', 'themeActionDisabled',
    'themeActionLabel', 'themeActionVariant', 'themeCoverSrc', 'themePreviewShotClass',
    'themePreviewVars', 'themeTags', 'themes', 'visible',
  ],
  emits: [
    'appearance',
    'empty-action',
    'enable',
    'open-detail',
    'preview',
    'preview-error',
    'share',
    'toggle-favorite',
  ],
};
</script>
