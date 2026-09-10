<template>
  <view>
    <view class="search-bar">
      <BaseForm
        class="search-form"
        :data="searchForm"
      >
        <BaseField
          :model-value="searchForm.keyword"
          name="keyword"
          aria-label="搜索主题、装扮名称、方言风格"
          placeholder="搜索主题、装扮名称、方言风格"
          clearable
          :maxlength="64"
          confirm-type="search"
          @update:model-value="$emit('update-keyword', $event)"
          @confirm="$emit('submit-search')"
        />
      </BaseForm>
      <BaseButton
        class="search-go"
        size="small"
        @click="$emit('submit-search')"
      >
        搜索
      </BaseButton>
    </view>

    <view
      v-if="memberSyncing"
      class="stale-note"
    >
      会员状态正在同步，请稍候
    </view>
    <view
      v-if="catalogStale && !catalogFail"
      class="stale-note"
    >
      当前展示为缓存数据，部分内容可能不是最新
    </view>
    <BaseLoading
      v-if="catalogLoading && !catalogFail"
      :delay="200"
      text="装扮目录加载中…"
      layout="horizontal"
    />
    <view
      v-if="catalogFail"
      class="empty-wrap"
    >
      <ThemeStatusPane
        scene="catalog_fail"
        @action="$emit('retry-catalog')"
      />
    </view>

    <scroll-view
      v-if="!catalogFail && !searching && hotKeywords.length"
      scroll-x
      class="filter-scroll hot-scroll"
      :show-scrollbar="false"
    >
      <view class="hot-copy">
        热门搜索词
      </view>
      <view class="filter-row">
        <view
          v-for="tag in hotKeywords"
          :key="tag"
          class="chip pressable"
          @tap="$emit('hot-keyword', tag)"
        >
          {{ tag }}
        </view>
      </view>
    </scroll-view>

    <t-cell
      v-if="!catalogFail && showFilterBar"
      class="filter-toolbar"
      arrow
      hover
      :bordered="false"
      :note-style="filterNoteStyle"
      :aria-label="`筛选与排序，当前${filterSummary}`"
      role="button"
      tabindex="0"
      @click="$emit('open-filter')"
      @keydown.enter.space.prevent="$emit('open-filter')"
    >
      <template #title>
        筛选与排序
      </template>
      <template #note>
        {{ filterSummary }}
      </template>
    </t-cell>

    <view
      v-if="!catalogFail && searching"
      class="pane"
    >
      <view class="tabs">
        <view
          v-for="item in searchTabs"
          :key="item.value"
          class="tab pressable"
          :class="{ active: resultTab === item.value }"
          @tap="$emit('result-tab', item.value)"
        >
          {{ item.label }}
        </view>
      </view>
      <ThemeStatusPane
        v-if="!searchRows.length"
        scene="search"
        @action="$emit('exit-search')"
      />
      <view
        v-for="entry in searchRows"
        :key="`${entry.kind}-${entry.item.id}`"
        class="dress-card pressable"
        :class="{
          placeholder: isGreyEntry(entry),
          disabled: entry.blocked,
        }"
        @tap="$emit('open-entry', entry)"
      >
        <view
          v-if="entry.kind === 'theme'"
          class="shot shot-sm"
          :class="[themePreviewShotClass(entry.item), { blurred: !entry.item.available }]"
          :style="themePreviewVars(entry.item)"
        >
          <view class="shot-home">
            <view class="shot-nav" />
            <view class="shot-feed" />
            <view class="shot-tab" />
          </view>
        </view>
        <view
          v-else
          class="thumb"
          :class="`thumb-${entry.item.preview}`"
        >
          <view class="thumb-bar" />
          <view class="thumb-card" />
        </view>
        <view class="dress-body">
          <view class="theme-name">
            {{ entry.item.name }}
          </view>
          <view class="muted">
            {{ entry.kind === 'theme' ? '全局主题' : (entry.group?.name || '局部装扮') }}
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
            小程序暂不支持
          </view>
          <view
            class="theme-action-wrap"
            @tap.stop
          >
            <BaseButton
              class="theme-action"
              size="small"
              :variant="searchActionVariant(entry)"
              :disabled="searchActionDisabled(entry)"
              @click="$emit('enable-entry', entry)"
            >
              {{ searchActionLabel(entry) }}
            </BaseButton>
          </view>
        </view>
      </view>
      <view class="theme-action-wrap">
        <BaseButton
          variant="ghost"
          size="small"
          @click="$emit('exit-search')"
        >
          返回列表
        </BaseButton>
      </view>
    </view>

    <view
      v-if="!catalogFail && !searching"
      class="tabs"
    >
      <view
        v-for="item in tabs"
        :key="item.value"
        class="tab pressable"
        :class="{ active: tab === item.value }"
        @tap="$emit('tab-switch', item.value)"
      >
        {{ item.label }}
      </view>
    </view>

    <view
      v-if="!catalogFail && !searching"
      class="acquire-bar pressable"
      @tap="$emit('acquire')"
    >
      <view class="acquire-copy">
        <view class="acquire-title">
          装扮获取
        </view>
        <view class="muted">
          活动、会员与方言创作任务
        </view>
      </view>
      <view class="acquire-go">
        去看看
      </view>
    </view>
  </view>
</template>

<script>
/* eslint-disable vue/require-prop-types -- internal route contract */
import TCell from '@tdesign/uniapp/cell/cell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import ThemeStatusPane from '@/components/ThemeStatusPane.vue';

const FILTER_NOTE_STYLE = [
  'max-width: 56%',
  'min-width: 0',
  'overflow: hidden',
  'text-align: right',
  'text-overflow: ellipsis',
  'white-space: nowrap',
].join('; ');

export default {
  name: 'ThemeCenterDiscoveryView',
  components: {
    BaseButton,
    BaseField,
    BaseForm,
    BaseLoading,
    TCell,
    ThemeStatusPane,
  },
  props: [
    'catalogFail', 'catalogLoading', 'catalogStale', 'filterSummary', 'hotKeywords',
    'isGreyEntry', 'memberSyncing', 'resultTab', 'searchActionDisabled',
    'searchActionLabel', 'searchActionVariant', 'searchForm', 'searching', 'searchRows',
    'searchTabs', 'showFilterBar', 'tab', 'tagClass', 'themePreviewShotClass',
    'themePreviewVars',
  ],
  emits: [
    'acquire',
    'enable-entry',
    'exit-search',
    'hot-keyword',
    'open-entry',
    'open-filter',
    'result-tab',
    'retry-catalog',
    'submit-search',
    'tab-switch',
    'update-keyword',
  ],
  data() {
    return {
      filterNoteStyle: FILTER_NOTE_STYLE,
      tabs: [
        { value: 'global', label: '全局主题' },
        { value: 'local', label: '局部装扮' },
        { value: 'favorites', label: '我的收藏' },
        { value: 'mine', label: '我的装扮' },
      ],
    };
  },
};
</script>
