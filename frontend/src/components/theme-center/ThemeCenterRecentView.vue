<template>
  <view
    v-if="visible"
    class="recent-block"
  >
    <view class="note-title">
      最近使用
    </view>
    <ThemeStatusPane
      v-if="!rows.length"
      compact
      scene="recent"
    />
    <scroll-view
      v-else
      scroll-x
      class="recent-scroll"
      :show-scrollbar="false"
    >
      <view class="recent-row">
        <view
          v-for="row in rows"
          :key="`${row.kind}-${row.id}`"
          class="recent-card"
          :class="{ disabled: row.disabled }"
          @tap="$emit('open', row)"
        >
          <image
            v-if="row.kind === 'theme' && themeCoverSrc(row.item)"
            class="shot shot-xs shot-photo"
            :src="themeCoverSrc(row.item)"
            mode="aspectFill"
            lazy-load
            @error="$emit('preview-error', row.id)"
          />
          <view
            v-else-if="row.kind === 'theme'"
            class="shot shot-xs"
            :class="themePreviewShotClass(row.item)"
            :style="themePreviewVars(row.item)"
          >
            <view class="shot-home">
              <view class="shot-nav" />
              <view class="shot-feed" />
              <view class="shot-tab" />
            </view>
          </view>
          <image
            v-else-if="themeCoverSrc(row.item)"
            class="thumb thumb-xs shot-photo"
            :src="themeCoverSrc(row.item)"
            mode="aspectFill"
            lazy-load
            @error="$emit('preview-error', row.id)"
          />
          <view
            v-else
            class="thumb thumb-xs"
            :class="`thumb-${row.preview}`"
          >
            <view class="thumb-bar" />
            <view class="thumb-card" />
          </view>
          <view class="recent-name">
            {{ row.name }}
          </view>
          <view
            class="tag"
            :class="recentTagClass(row)"
          >
            {{ row.label }}
          </view>
          <view
            v-if="row.hint"
            class="recent-hint"
          >
            {{ row.hint }}
          </view>
          <view
            class="theme-action-wrap"
            @tap.stop
          >
            <BaseButton
              class="theme-action"
              size="extra-small"
              :variant="row.disabled ? 'ghost' : 'primary'"
              :disabled="row.disabled"
              @click="$emit('apply', row)"
            >
              应用
            </BaseButton>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
/* eslint-disable vue/require-prop-types -- internal route contract */
import BaseButton from '@/components/BaseButton.vue';
import ThemeStatusPane from '@/components/ThemeStatusPane.vue';

export default {
  name: 'ThemeCenterRecentView',
  components: { BaseButton, ThemeStatusPane },
  props: ['recentTagClass', 'rows', 'themeCoverSrc', 'themePreviewShotClass', 'themePreviewVars', 'visible'],
  emits: ['apply', 'open', 'preview-error'],
};
</script>
