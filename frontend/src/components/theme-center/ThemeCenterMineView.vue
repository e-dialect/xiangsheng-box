<template>
  <view
    v-if="visible"
    class="pane"
  >
    <view class="section-title">
      我的装扮
    </view>

    <view class="current-card">
      <view class="current-copy">
        <view class="kicker">
          当前正在使用：{{ activeTheme.name }}
        </view>
        <view class="muted">
          全局主题会统一修改整套界面风格
        </view>
        <view class="tag-row">
          <view
            v-for="tag in themeTags(activeTheme)"
            :key="`mine-theme-${tag.kind}-${tag.label}`"
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
            class="theme-action"
            size="small"
            @click="$emit('change-theme')"
          >
            更换主题
          </BaseButton>
        </view>
      </view>
      <view
        class="shot shot-sm"
        :class="previewShotClass"
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

    <view class="outfit">
      <view class="note-title">
        已启用局部装扮
      </view>
      <ThemeStatusPane
        v-if="!hasAppliedDress"
        scene="dress_applied"
        @action="$emit('dress-empty')"
      />
      <view
        v-for="entry in appliedDress"
        :key="entry.group.id"
        class="dress-card"
        :class="{ disabled: entry.blocked, empty: entry.empty }"
      >
        <view
          class="thumb"
          :class="entry.item ? `thumb-${entry.item.preview}` : 'thumb-empty'"
        >
          <view class="thumb-bar" />
          <view class="thumb-card" />
        </view>
        <view class="dress-body">
          <view class="theme-name">
            {{ entry.group.name }}
          </view>
          <view class="muted">
            {{ entry.item ? entry.item.name : '暂未设置该组件装扮' }}
          </view>
          <view class="tag-row">
            <view
              v-for="tag in dressTags(entry)"
              :key="`${entry.group.id}-${tag.kind}-${tag.label}`"
              class="tag"
              :class="tag.className"
            >
              {{ tag.label }}
            </view>
          </view>
          <view
            class="status-line"
            :class="entry.effective ? 'status-ready' : 'status-blocked'"
          >
            {{ dressStatus(entry) }}
          </view>
          <view
            class="theme-action-wrap"
            @tap.stop
          >
            <BaseButton
              class="theme-action"
              size="small"
              variant="ghost"
              :disabled="entry.blocked"
              @click="$emit('edit-dress', entry.group, entry)"
            >
              修改
            </BaseButton>
            <BaseButton
              v-if="entry.item"
              class="theme-action"
              size="small"
              variant="ghost"
              @click="$emit('clear-dress', entry)"
            >
              关闭
            </BaseButton>
          </view>
        </view>
      </view>
    </view>

    <view class="outfit">
      <view class="note-title">
        装扮冲突设置
      </view>
      <view class="overlay-row">
        <view class="overlay-copy">
          <view>全局主题覆盖局部装扮</view>
          <view class="muted">
            开启后全站只用当前全局主题；已启用的局部装扮暂时失效，但不会被删除。关闭后，单独设置过的组件优先生效。
          </view>
        </view>
        <t-switch
          :value="overlay"
          @change="$emit('overlay-change', $event)"
        />
      </view>
    </view>

    <view class="action-stack">
      <BaseButton @click="$emit('open-save-outfit')">
        保存当前搭配
      </BaseButton>
      <BaseButton @click="$emit('open-preview')">
        预览装扮效果
      </BaseButton>
      <BaseButton
        variant="ghost"
        @click="$emit('reset-dress')"
      >
        重置全部装扮
      </BaseButton>
    </view>

    <view class="outfit">
      <view class="note-title">
        历史搭配
      </view>
      <ThemeStatusPane
        v-if="!savedOutfits.length"
        scene="mix"
        @action="$emit('open-save-outfit')"
      />
      <view
        v-for="outfit in savedOutfits"
        :key="outfit.id"
        class="dress-card"
      >
        <view
          class="shot shot-xs"
          :class="outfitPreviewShotClass(outfit)"
          :style="outfitPreviewVars(outfit)"
        >
          <view class="shot-home">
            <view class="shot-nav" />
            <view class="shot-feed" />
            <view class="shot-tab" />
          </view>
        </view>
        <view class="dress-body">
          <view class="theme-name">
            {{ outfit.name }}
          </view>
          <view class="muted">
            {{ outfitSummary(outfit) }}
          </view>
          <view
            class="theme-action-wrap"
            @tap.stop
          >
            <BaseButton
              class="theme-action"
              size="extra-small"
              @click="$emit('apply-outfit', outfit)"
            >
              一键应用
            </BaseButton>
            <BaseButton
              class="theme-action"
              size="extra-small"
              variant="ghost"
              @click="$emit('preview-outfit', outfit)"
            >
              预览
            </BaseButton>
            <BaseButton
              class="theme-action"
              size="extra-small"
              variant="ghost"
              @click="$emit('rename-outfit', outfit)"
            >
              重命名
            </BaseButton>
            <BaseButton
              class="theme-action"
              size="extra-small"
              variant="ghost"
              @click="$emit('delete-outfit', outfit)"
            >
              删除
            </BaseButton>
          </view>
        </view>
      </view>
    </view>

    <view class="outfit">
      <view class="note-title">
        已拥有未启用
      </view>
      <view
        v-if="!ownedUnused.themes.length && !ownedUnused.dresses.length"
        class="muted"
      >
        暂无已拥有但未启用的装扮
      </view>
      <view
        v-for="theme in ownedUnused.themes"
        :key="`owned-theme-${theme.id}`"
        class="dress-card"
      >
        <view class="dress-body">
          <view class="theme-name">
            {{ theme.name }}
          </view>
          <view
            class="tag"
            :class="tagClass(theme)"
          >
            {{ theme.tag }}
          </view>
          <view
            class="theme-action-wrap"
            @tap.stop
          >
            <BaseButton
              class="theme-action"
              size="small"
              @click="$emit('enable-theme', theme)"
            >
              应用
            </BaseButton>
          </view>
        </view>
      </view>
      <view
        v-for="entry in ownedUnused.dresses"
        :key="`owned-dress-${entry.item.id}`"
        class="dress-card"
        :class="{ disabled: entry.blocked }"
      >
        <view class="dress-body">
          <view class="theme-name">
            {{ entry.item.name }}
          </view>
          <view class="muted">
            {{ entry.group.name }}
          </view>
          <view
            class="tag"
            :class="tagClass(entry.item)"
          >
            {{ entry.item.tag }}
          </view>
          <view
            v-if="entry.blocked"
            class="status-line status-blocked"
          >
            拥有权限，但小程序暂不支持该装扮
          </view>
          <view
            class="theme-action-wrap"
            @tap.stop
          >
            <BaseButton
              class="theme-action"
              size="small"
              :disabled="entry.blocked"
              @click="$emit('apply-owned-dress', entry)"
            >
              应用
            </BaseButton>
          </view>
        </view>
      </view>
    </view>

    <view class="outfit">
      <view class="note-title">
        未拥有
      </view>
      <view
        v-if="!acquireOffers.themes.length && !acquireOffers.dresses.length"
        class="muted"
      >
        暂无可获取装扮
      </view>
      <view
        v-for="theme in acquireOffers.themes"
        :key="`offer-theme-${theme.id}`"
        class="dress-card"
      >
        <view class="dress-body">
          <view class="theme-name">
            {{ theme.name }}
          </view>
          <view
            class="tag"
            :class="tagClass(theme)"
          >
            {{ theme.tag }}
          </view>
          <view
            class="theme-action-wrap"
            @tap.stop
          >
            <BaseButton
              class="theme-action"
              size="small"
              :variant="themeActionVariant(theme)"
              :disabled="themeActionDisabled(theme)"
              @click="$emit('enable-theme', theme)"
            >
              去获取
            </BaseButton>
          </view>
        </view>
      </view>
      <view
        v-for="item in acquireOffers.dresses"
        :key="`offer-dress-${item.id}`"
        class="dress-card"
      >
        <view class="dress-body">
          <view class="theme-name">
            {{ item.name }}
          </view>
          <view
            class="tag"
            :class="tagClass(item)"
          >
            {{ item.tag }}
          </view>
          <view
            class="theme-action-wrap"
            @tap.stop
          >
            <BaseButton
              class="theme-action"
              size="small"
              :variant="dressActionVariant(item)"
              :disabled="dressActionDisabled(item)"
              @click="$emit('dress-offer', item)"
            >
              去获取
            </BaseButton>
          </view>
        </view>
      </view>
    </view>

    <view class="foot-note">
      提示：微信小程序部分原生组件不支持自定义装扮，该部分样式保持系统默认，不会受装扮影响。
    </view>
    <view class="foot-note">
      {{ accountSyncNote }}
    </view>
  </view>
</template>

<script>
/* eslint-disable vue/require-prop-types -- internal route contract */
import TSwitch from '@tdesign/uniapp/switch/switch.vue';
import BaseButton from '@/components/BaseButton.vue';
import ThemeStatusPane from '@/components/ThemeStatusPane.vue';

export default {
  name: 'ThemeCenterMineView',
  components: { BaseButton, ThemeStatusPane, TSwitch },
  props: [
    'accountSyncNote', 'acquireOffers', 'activeTheme', 'appliedDress',
    'dressActionDisabled', 'dressActionVariant', 'dressStatus', 'dressTags',
    'hasAppliedDress', 'outfitPreviewShotClass', 'outfitPreviewVars', 'outfitSummary',
    'outfitThemePreview',
    'overlay', 'ownedUnused', 'previewShotClass', 'savedOutfits', 'tagClass',
    'themeActionDisabled', 'themeActionVariant', 'themePreviewShotClass',
    'themePreviewVars', 'themeTags', 'visible',
  ],
  emits: [
    'apply-outfit',
    'apply-owned-dress',
    'change-theme',
    'clear-dress',
    'delete-outfit',
    'dress-empty',
    'dress-offer',
    'edit-dress',
    'enable-theme',
    'open-preview',
    'open-save-outfit',
    'overlay-change',
    'preview-outfit',
    'rename-outfit',
    'reset-dress',
  ],
};
</script>
