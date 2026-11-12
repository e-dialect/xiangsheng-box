<template>
  <AppShell
    title="查找词条"
    active="search"
    @scrolltolower="loadMore"
  >
    <view class="entry-search">
      <view class="entry-search__bar">
        <BaseField
          v-model="filters.keyword"
          name="keyword"
          label="写法、意思或读音"
          aria-role="searchbox"
          aria-label="写法、意思或读音"
          clearable
          placeholder="例如：行、害怕、hiŋ"
          @confirm="search"
        />
        <BaseButton
          block
          text="查词条"
          :loading="loading"
          @click="search"
        />
      </view>

      <view
        v-if="suggestions.length"
        class="entry-search__suggestions"
        aria-label="词条联想"
      >
        <BaseButton
          v-for="entry in suggestions"
          :key="entry.id"
          size="small"
          variant="ghost"
          :text="`${entryTitle(entry)} · ${entry.summary || ''}`"
          @click="goEntryDetail(entry.id)"
        />
      </view>
      <view
        v-if="!filters.keyword"
        class="entry-search__suggestions"
        aria-label="搜索辅助"
      >
        <BaseButton
          variant="ghost"
          text="逛主题集盒"
          @click="goCollections()"
        />
        <text v-if="history.length">
          最近查过
        </text>
        <BaseButton
          v-for="term in history"
          :key="term"
          size="small"
          variant="ghost"
          :text="term"
          @click="quickSearch(term)"
        />
        <BaseButton
          v-if="history.length"
          size="small"
          variant="ghost"
          text="清空历史"
          @click="clearHistory"
        />
        <text v-if="popular.length">
          大家在听
        </text>
        <BaseButton
          v-for="entry in popular"
          :key="entry.id"
          size="small"
          variant="ghost"
          :text="entryTitle(entry)"
          @click="goEntryDetail(entry.id)"
        />
      </view>
      <DialectSelector
        v-model:visible="dialectPickerVisible"
        :value="filters.dialectId"
        :dialects="dialects"
        :default-dialect="primaryDialect"
        :owner-scope="dialectOwnerScope"
        title="选择地区范围"
        @change="onDialectChange"
      />

      <t-picker
        :visible="writingPickerVisible"
        :value="[filters.writingType]"
        title="选择写法类型"
        @change="onWritingTypeChange"
        @close="writingPickerVisible = false"
      >
        <t-picker-item :options="writingTypes" />
      </t-picker>

      <t-picker
        :visible="sourcePickerVisible"
        :value="[filters.sourceType]"
        title="选择证据来源"
        @change="onSourceTypeChange"
        @close="sourcePickerVisible = false"
      >
        <t-picker-item :options="sourceTypes" />
      </t-picker>

      <view
        v-if="loading && !entries.length"
        class="entry-search__state"
        data-search-state="loading"
        aria-live="polite"
      >
        <BaseLoading text="正在查找词条…" />
      </view>
      <view
        v-else-if="errorMessage && !entries.length"
        class="entry-search__state"
        data-search-state="error"
        role="alert"
      >
        <EmptyState
          :title="errorMessage"
          :description="errorDescription"
          :action-text="errorActionText"
          @action="handleErrorAction"
        />
      </view>
      <view
        v-else-if="searched && !entries.length"
        class="entry-search__state"
        data-search-state="empty"
      >
        <EmptyState
          title="没有找到匹配词条"
          description="换一个写法、意思或读音再试；也可以先录下你听到的说法。"
          action-text="录一段，让大家帮忙整理"
          @action="goRecord"
        />
      </view>
      <view
        v-else-if="!searched"
        class="entry-search__prompt"
        data-search-state="initial"
      >
        <text class="entry-search__prompt-kicker">
          不必先知道正字
        </text>
        <text class="entry-search__prompt-title">
          从一个线索开始
        </text>
        <text class="entry-search__prompt-copy">
          汉字、意思、读音都可以。同一个“行”若有不同意思，会分别列出，不会混成一条。
        </text>
        <view class="entry-search__suggestions">
          <BaseButton
            v-for="suggestion in searchSuggestions"
            :key="suggestion"
            size="small"
            variant="ghost"
            :text="`试试：${suggestion}`"
            @click="quickSearch(suggestion)"
          />
        </view>
      </view>
      <view
        v-else-if="entries.length"
        class="entry-results__summary"
        data-search-state="summary"
        aria-live="polite"
      >
        <text class="entry-results__summary-title">
          找到 {{ total }} 个独立词条
        </text>
        <text class="entry-results__summary-copy">
          相同写法的不同意思会各自保留，点开后再看地区、读音和证据。
        </text>
        <BaseButton
          v-if="keywordShare"
          class="entry-results__share"
          size="small"
          variant="ghost"
          :open-type="shareType"
          :text="shareType || canSystemShare ? '分享查词结果' : '复制关键词链接'"
          @click="shareKeyword"
        />
      </view>

      <t-collapse
        v-model:value="openSections"
        class="entry-search__advanced"
        theme="card"
      >
        <t-collapse-panel
          value="advanced"
          :header="advancedHeader"
          :header-right-content="advancedHint"
        >
          <view class="filter-stack">
            <view
              v-if="activeFilters"
              class="filter-stack__summary"
            >
              <text>已选 {{ activeFilters }} 项条件</text>
              <BaseButton
                size="extra-small"
                variant="ghost"
                text="清空筛选"
                @click="resetAdvancedFilters"
              />
            </view>
            <t-cell
              title="地区范围"
              :note="selectedDialectLabel"
              arrow
              hover
              @click="dialectPickerVisible = true"
            />
            <view
              v-if="filters.dialectId"
              class="filter-choice"
            >
              <BaseButton
                size="small"
                :variant="filters.dialectMatch === 'subtree' ? 'primary' : 'ghost'"
                text="包含下级地区"
                @click="filters.dialectMatch = 'subtree'"
              />
              <BaseButton
                size="small"
                :variant="filters.dialectMatch === 'exact' ? 'primary' : 'ghost'"
                text="仅这个范围"
                @click="filters.dialectMatch = 'exact'"
              />
              <BaseButton
                size="small"
                variant="ghost"
                text="清除地区"
                @click="clearDialect"
              />
            </view>

            <view class="filter-group">
              <text class="filter-group__label">
                录音状态
              </text>
              <view class="filter-choice">
                <BaseButton
                  v-for="item in audioOptions"
                  :key="item.label"
                  size="small"
                  :variant="filters.hasRecording === item.value ? 'primary' : 'ghost'"
                  :text="item.label"
                  @click="filters.hasRecording = item.value"
                />
              </view>
            </view>

            <view class="filter-group">
              <text class="filter-group__label">
                整理状态
              </text>
              <view class="filter-choice">
                <BaseButton
                  v-for="item in statusOptions"
                  :key="item.value"
                  size="small"
                  :variant="filters.status === item.value ? 'primary' : 'ghost'"
                  :text="item.label"
                  @click="filters.status = item.value"
                />
              </view>
            </view>

            <t-cell
              title="写法类型"
              :note="writingTypeLabel"
              arrow
              hover
              @click="writingPickerVisible = true"
            />
            <t-cell
              title="证据来源"
              :note="sourceTypeLabel"
              arrow
              hover
              @click="sourcePickerVisible = true"
            />

            <BaseField
              v-model="filters.ipa"
              name="ipa"
              label="IPA"
              placeholder="输入完整或部分 IPA"
            />
            <BaseField
              v-model="filters.romanization"
              name="romanization"
              label="罗马字"
              placeholder="输入真实记录的罗马字"
            />
            <BaseField
              v-model="filters.source"
              name="source"
              label="来源"
              placeholder="方言志、田野记录或贡献说明"
            />
            <BaseField
              v-model="filters.concept"
              name="concept"
              label="概念"
              placeholder="例如 WALK；只发现关联词条，不自动合并"
            />
            <BaseButton
              block
              text="应用筛选"
              :loading="loading"
              @click="applyAdvancedFilters"
            />
          </view>
        </t-collapse-panel>
      </t-collapse>

      <view
        v-if="entries.length"
        class="entry-results"
        data-search-state="results"
        :aria-busy="loading || loadingMore ? 'true' : 'false'"
      >
        <view
          v-for="entry in entries"
          :key="entry.id"
          class="entry-result"
          role="button"
          tabindex="0"
          :aria-label="`查看词条：${entryTitle(entry)}`"
          @tap="goEntryDetail(entry.id)"
          @keydown.enter="goEntryDetail(entry.id)"
        >
          <view class="entry-result__heading">
            <text class="entry-result__title">
              {{ entryTitle(entry) }}
            </text>
            <text class="entry-result__status">
              {{ statusLabel(entry.status) }}
            </text>
          </view>
          <view class="entry-result__summary">
            {{ entry.summary || '大意待补充' }}
          </view>
          <view class="entry-result__meta">
            <text class="entry-result__meta-item">
              {{ dialectLabel(entry.usage_dialect) }}
            </text>
            <text class="entry-result__meta-item">
              {{ entry.recording_count }} 段录音
            </text>
            <text
              v-if="entry.needs_audio"
              class="entry-result__meta-item entry-result__meta-item--attention"
            >
              待补音
            </text>
          </view>
          <view
            v-if="entry.concepts?.length"
            class="entry-result__concepts"
          >
            概念：{{ entry.concepts.map((item) => item.label || item.code).join('、') }}
          </view>
          <view class="entry-result__action">
            查看词条
            <text aria-hidden="true">
              ›
            </text>
          </view>
        </view>
        <BaseLoading
          v-if="loadingMore"
          text="继续查找…"
        />
      </view>
    </view>
  </AppShell>
</template>

<script>
import TCell from '@tdesign/uniapp/cell/cell.vue';
import TCollapse from '@tdesign/uniapp/collapse/collapse.vue';
import TCollapsePanel from '@tdesign/uniapp/collapse-panel/collapse-panel.vue';
import TPicker from '@tdesign/uniapp/picker/picker.vue';
import TPickerItem from '@tdesign/uniapp/picker-item/picker-item.vue';
import AppShell from '@/components/AppShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import {
  buildEntrySearchParams,
  dialectLabel,
  entryTitle,
  listEntries,
  pageResults,
} from '@/services/entryRecording';
import {
  suggestEntries, popularEntries, searchHistory, rememberSearch, clearSearchHistory,
} from '@/services/entrySearchAssist';
import { listAllDialects } from '@/services/guantou';
import {
  goCollections, goEntryDetail, goHome, goRecord, pageUrl, ROUTES,
} from '@/services/navigation';
import { APP_NAME } from '@/const/branding';
import { isWechatMiniProgram } from '@/services/platform';
import {
  canUseSystemShare, hasShareTarget, sharePage, showWechatShareMenu, WECHAT_SHARE_IMAGE,
} from '@/services/pageShare';
import { dialectBreadcrumb } from '@/utils/dialectTree';
import { CAPABILITIES, ensureCapability } from '@/services/capabilities';
import { PRODUCT_EVENTS, trackProductEvent } from '@/services/productAnalytics';

const WRITING_TYPES = [
  { label: '不限', value: '' },
  { label: '汉字正字', value: 'orthographic' },
  { label: '俗写', value: 'popular' },
  { label: '借字', value: 'loan' },
  { label: '拟音', value: 'phonetic' },
  { label: '罗马字', value: 'romanization' },
  { label: '待考写法', value: 'uncertain' },
];

const SOURCE_TYPES = [
  { label: '不限', value: '' },
  { label: '用户原话', value: 'user_statement' },
  { label: '口述', value: 'oral' },
  { label: '田野记录', value: 'fieldwork' },
  { label: '书籍', value: 'book' },
  { label: '论文或文章', value: 'article' },
  { label: '档案', value: 'archive' },
  { label: '网页', value: 'web' },
  { label: '旧库原文', value: 'legacy' },
  { label: '其他', value: 'other' },
];

function defaultFilters() {
  return {
    keyword: '',
    dialectId: '',
    dialectMatch: 'subtree',
    writingType: '',
    sourceType: '',
    status: '',
    ipa: '',
    romanization: '',
    source: '',
    concept: '',
    hasRecording: '',
  };
}

function resultBucket(count) {
  if (count <= 0) return '0';
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  return '21+';
}

function activeFilterCount(filters) {
  const advancedKeys = [
    'dialectId',
    'writingType',
    'sourceType',
    'status',
    'ipa',
    'romanization',
    'source',
    'concept',
    'hasRecording',
  ];
  return advancedKeys.filter((key) => (
    filters[key] !== '' && filters[key] !== null && filters[key] !== undefined
  )).length;
}

export default {
  components: {
    AppShell,
    BaseButton,
    BaseField,
    BaseLoading,
    EmptyState,
    DialectSelector,
    TCell,
    TCollapse,
    TCollapsePanel,
    TPicker,
    TPickerItem,
  },
  data() {
    return {
      filters: defaultFilters(),
      appliedFilters: null,
      openSections: [],
      entries: [],
      total: 0,
      page: 1,
      next: null,
      searched: false,
      loading: false,
      loadingMore: false,
      errorMessage: '',
      searchUnavailable: false,
      searchRequestId: 0,
      dialects: [],
      dialectPickerVisible: false,
      writingPickerVisible: false,
      sourcePickerVisible: false,
      writingTypes: WRITING_TYPES,
      sourceTypes: SOURCE_TYPES,
      searchSuggestions: ['行', '害怕', 'hiŋ'],
      history: [],
      popular: [],
      suggestions: [],
      suggestTimer: null,
      suggestSequence: 0,
      submittedKeyword: '',
      audioOptions: [
        { label: '不限', value: '' },
        { label: '有录音', value: true },
        { label: '待补音', value: false },
      ],
      statusOptions: [
        { label: '不限', value: '' },
        { label: '初稿', value: 'draft' },
        { label: '已整理', value: 'reviewed' },
        { label: '有分歧', value: 'disputed' },
      ],
    };
  },
  computed: {
    shareType() { return isWechatMiniProgram() ? 'share' : ''; },
    canSystemShare: canUseSystemShare,
    keywordShare() {
      if (!hasShareTarget() || this.loading || this.errorMessage
        || !this.entries.length || !this.submittedKeyword) {
        return null;
      }
      const characters = Array.from(this.submittedKeyword);
      const keyword = characters.length > 24
        ? `${characters.slice(0, 23).join('')}…` : this.submittedKeyword;
      const path = pageUrl(ROUTES.search, { key: this.submittedKeyword });
      return {
        title: `查词｜${keyword} · ${APP_NAME}`,
        path,
        query: `sharedKeyword=${encodeURIComponent(this.submittedKeyword)}`,
      };
    },
    primaryDialect() {
      return getApp()?.globalData?.userInfo?.primary_dialect || null;
    },
    dialectOwnerScope() {
      return getApp()?.globalData?.userInfo?.id || 'guest';
    },
    selectedDialectLabel() {
      const dialect = this.dialects.find(
        (item) => String(item.id) === String(this.filters.dialectId),
      );
      return dialect ? dialectBreadcrumb(dialect, this.dialects) : '不限地区';
    },
    writingTypeLabel() {
      return WRITING_TYPES.find((item) => item.value === this.filters.writingType)?.label || '不限';
    },
    sourceTypeLabel() {
      return SOURCE_TYPES.find((item) => item.value === this.filters.sourceType)?.label || '不限';
    },
    activeFilters() {
      return activeFilterCount(this.filters);
    },
    advancedHeader() {
      return this.activeFilters ? `筛选条件 · ${this.activeFilters}` : '高级筛选';
    },
    advancedHint() {
      return this.activeFilters ? '可继续调整' : '地区 · 录音 · 证据';
    },
    errorActionText() {
      return this.searchUnavailable ? '返回听乡音' : '重新查询';
    },
    errorDescription() {
      return this.searchUnavailable
        ? '听乡音和个人资料仍可正常使用。'
        : '检查网络后再试，已经输入的关键词和筛选条件都会保留。';
    },
  },
  watch: {
    'filters.keyword': function suggestKeyword(value) {
      clearTimeout(this.suggestTimer);
      this.suggestSequence += 1;
      const sequence = this.suggestSequence;
      this.suggestions = [];
      if (!String(value || '').trim() || String(value).trim() === this.submittedKeyword) return;
      this.suggestTimer = setTimeout(async () => {
        try {
          const items = await suggestEntries(value);
          if (sequence === this.suggestSequence) this.suggestions = pageResults(items);
        } catch (error) {
          if (sequence === this.suggestSequence) this.suggestions = [];
        }
      }, 250);
    },
  },
  onShow() { this.history = searchHistory(); },
  onUnload() { clearTimeout(this.suggestTimer); this.suggestSequence += 1; },
  async onLoad(options = {}) {
    // #ifdef MP-WEIXIN
    if (isWechatMiniProgram()) showWechatShareMenu();
    // #endif
    this.history = searchHistory();
    popularEntries()
      .then((items) => { this.popular = pageResults(items); })
      .catch(() => { this.popular = []; });
    this.filters.keyword = options.keywords || options.key || '';
    // #ifdef MP-WEIXIN
    if (typeof options.sharedKeyword === 'string') {
      try {
        this.filters.keyword = decodeURIComponent(options.sharedKeyword);
      } catch (error) {
        this.filters.keyword = '';
      }
    }
    // #endif
    try {
      this.dialects = await listAllDialects();
    } catch (error) {
      this.dialects = [];
    }
    if (this.filters.keyword) await this.search();
  },
  // #ifdef MP-WEIXIN
  onShareAppMessage() {
    const { title = `查找词条｜${APP_NAME}`, query } = this.keywordShare || {};
    const path = query ? `${ROUTES.search}?${query}` : ROUTES.search;
    return { title, path, imageUrl: WECHAT_SHARE_IMAGE };
  },
  onShareTimeline() {
    const { title = `查找词条｜${APP_NAME}`, query = 'sharedKeyword=' } = this.keywordShare || {};
    return { title, query, imageUrl: WECHAT_SHARE_IMAGE };
  },
  // #endif
  methods: {
    goCollections,
    shareKeyword() {
      // #ifdef H5 || APP-PLUS
      return sharePage(this.keywordShare, '关键词链接已复制');
      // #endif
    },
    clearHistory() { clearSearchHistory(); this.history = []; },
    dialectLabel,
    entryTitle,
    goEntryDetail,
    goRecord,
    statusLabel(status) {
      return {
        draft: '初稿',
        reviewed: '已整理',
        disputed: '有分歧',
        redirected: '已合并',
      }[status] || '待整理';
    },
    requestParams(page, filters = this.filters) {
      return buildEntrySearchParams({ ...filters, page, pageSize: 20 });
    },
    quickSearch(keyword) {
      this.filters.keyword = keyword;
      this.search();
    },
    resetAdvancedFilters() {
      const { keyword } = this.filters;
      this.filters = { ...defaultFilters(), keyword };
      this.search();
    },
    applyAdvancedFilters() {
      this.openSections = [];
      return this.search();
    },
    handleErrorAction() {
      if (this.searchUnavailable) {
        goHome(true);
        return;
      }
      this.search();
    },
    async search() {
      const filters = { ...this.filters };
      const requestId = this.searchRequestId + 1;
      this.searchRequestId = requestId;
      this.loadingMore = false;
      this.submittedKeyword = String(this.filters.keyword || '').trim();
      rememberSearch(this.filters.keyword);
      this.history = searchHistory();
      this.suggestions = [];
      clearTimeout(this.suggestTimer);
      this.suggestSequence += 1;
      if (!ensureCapability(CAPABILITIES.ENTRY_SEARCH, 'search')) {
        this.searched = true;
        this.entries = [];
        this.total = 0;
        this.next = null;
        this.loading = false;
        this.searchUnavailable = true;
        this.errorMessage = '词条查询正在维护，请稍后再试';
        return;
      }
      this.searchUnavailable = false;
      this.loading = true;
      this.errorMessage = '';
      this.searched = true;
      try {
        const response = await listEntries(this.requestParams(1, filters));
        if (requestId !== this.searchRequestId) return;
        this.entries = pageResults(response);
        this.total = Number(response?.count ?? this.entries.length);
        this.next = response?.next || null;
        this.page = 1;
        this.appliedFilters = filters;
        trackProductEvent(PRODUCT_EVENTS.ENTRY_SEARCH, {
          surface: 'search',
          result: this.total ? 'success' : 'empty',
          metadata: {
            result_bucket: resultBucket(this.total),
            filter_count: activeFilterCount(filters),
          },
        });
      } catch (error) {
        if (requestId !== this.searchRequestId) return;
        this.entries = [];
        this.total = 0;
        this.next = null;
        this.errorMessage = '词条查询失败，请稍后重试';
        trackProductEvent(PRODUCT_EVENTS.ENTRY_SEARCH, {
          surface: 'search',
          result: 'error',
          metadata: {
            result_bucket: '0',
            filter_count: activeFilterCount(filters),
          },
        });
      } finally {
        if (requestId === this.searchRequestId) this.loading = false;
      }
    },
    async loadMore() {
      if (!this.next || this.loading || this.loadingMore || !this.appliedFilters) return;
      const requestId = this.searchRequestId;
      this.loadingMore = true;
      try {
        const page = this.page + 1;
        const response = await listEntries(this.requestParams(page, this.appliedFilters));
        if (requestId !== this.searchRequestId) return;
        this.entries = [...this.entries, ...pageResults(response)];
        this.next = response?.next || null;
        this.page = page;
      } catch (error) {
        if (requestId === this.searchRequestId) {
          uni.showToast({ title: '暂时无法继续加载', icon: 'none' });
        }
      } finally {
        if (requestId === this.searchRequestId) this.loadingMore = false;
      }
    },
    onDialectChange(context = {}) {
      this.filters.dialectId = context.value || '';
    },
    clearDialect() {
      this.filters.dialectId = '';
      this.filters.dialectMatch = 'subtree';
    },
    onWritingTypeChange(context = {}) {
      this.filters.writingType = context.value?.[0] || '';
      this.writingPickerVisible = false;
    },
    onSourceTypeChange(context = {}) {
      this.filters.sourceType = context.value?.[0] || '';
      this.sourcePickerVisible = false;
    },
  },
};
</script>

<style scoped>
.entry-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  gap: 24rpx;
  overflow-wrap: anywhere;
}

.entry-search__prompt,
.entry-search__state,
.entry-results__summary,
.entry-result {
  padding: 26rpx;
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  border: 1rpx solid var(--border-color);
}

.entry-search__prompt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
  background: var(--accent-subtle-color);
}

.entry-search__prompt-kicker {
  color: var(--accent-color);
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.entry-search__prompt-title,
.entry-results__summary-title {
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-weight: 900;
}

.entry-search__prompt-title {
  font-size: 34rpx;
}

.entry-search__prompt-copy,
.entry-results__summary-copy {
  color: var(--text-secondary-color);
  font-size: 24rpx;
  line-height: 1.65;
}

.entry-search__suggestions,
.filter-stack__summary {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.entry-search__suggestions {
  min-width: 0;
  margin-top: 6rpx;
}

.entry-search :deep(.base-button) {
  max-width: 100%;
  min-width: 0;
  height: auto;
  min-height: 44px;
  padding-block: 8px;
  box-sizing: border-box;
  white-space: normal;
}

.entry-search :deep(.t-button__content) {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}

.entry-search :deep(.t-cell__note) {
  min-width: 0;
  overflow-wrap: anywhere;
}

.entry-search__state {
  min-height: 260rpx;
}

.entry-search__state :deep(.empty-state) {
  padding: 34rpx 12rpx;
}

.entry-results__summary {
  display: grid;
  gap: 8rpx;
  background: var(--accent-subtle-color);
}

.entry-results__summary-title {
  font-size: 30rpx;
}

.entry-results__share {
  justify-self: start;
}

.entry-search__bar,
.filter-stack,
.entry-results {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  gap: 18rpx;
}

/* Keep ranked results in reading order; use available width for search controls. */
@media (min-width: 600px) {
  .entry-search__bar {
    grid-template-columns: minmax(0, 1fr) minmax(120px, 160px);
    align-items: end;
  }

  .entry-search__bar > :deep(.base-button) {
    margin-bottom: var(--space-2);
  }
}

@media (min-width: 768px) {
  .filter-stack {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-stack > :not(.base-field) {
    grid-column: 1 / -1;
  }
}

.filter-stack__summary {
  justify-content: space-between;
  padding: 4rpx 8rpx 14rpx;
  color: var(--text-secondary-color);
  font-size: 23rpx;
}

.filter-group {
  display: grid;
  gap: 12rpx;
}

.filter-group__label {
  color: var(--muted-color);
  font-size: 23rpx;
}

.filter-choice,
.entry-result__meta {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.entry-result__heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20rpx;
}

.entry-result__title {
  min-width: 0;
  font-size: 36rpx;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.entry-result__status {
  flex: 0 0 auto;
  padding: 6rpx 12rpx;
  border-radius: var(--radius-pill);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: 20rpx;
  font-weight: 700;
}

.entry-result__summary {
  margin-top: 12rpx;
  color: var(--text-secondary-color);
  line-height: 1.6;
}

.entry-result__meta,
.entry-result__concepts {
  margin-top: 16rpx;
  color: var(--muted-color);
  font-size: 22rpx;
}

.entry-result__meta-item {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  padding: 6rpx 12rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
}

.entry-result__meta-item--attention {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-weight: 700;
}

.entry-result__action {
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  color: var(--accent-color);
  font-size: 23rpx;
  font-weight: 800;
}
</style>
