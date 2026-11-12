<template>
  <PageShell title="词条收藏">
    <view
      v-if="total || appliedSearch"
      class="bookmark-search"
    >
      <view class="bookmark-search__controls">
        <BaseField
          v-model="keyword"
          name="bookmarkKeyword"
          label="查我的收藏"
          placeholder="输入写法或意思"
          aria-role="searchbox"
          aria-label="查我的收藏"
          clearable
          :disabled="loading || removingId !== null"
          @blur="captureSearchInput"
          @confirm="confirmSearch"
        />
        <BaseButton
          class="bookmark-search__submit"
          text="查找"
          :disabled="loading || removingId !== null"
          @click="submitSearch"
        />
      </view>
    </view>

    <BaseLoading
      v-if="loading && !entries.length"
      text="正在读取你的词条收藏…"
    />
    <EmptyState
      v-else-if="error"
      title="收藏暂时没有加载出来"
      :description="error"
      action-text="重新加载"
      @action="load()"
    />
    <EmptyState
      v-else-if="!entries.length && appliedSearch"
      title="收藏里没有找到匹配词条"
      action-text="查看全部收藏"
      @action="resetSearch"
    />
    <EmptyState
      v-else-if="!entries.length"
      title="还没有收藏词条"
      description="查词时点「收藏词条」，就能在这里找回来。只有你能看到这些收藏。"
      action-text="去查词条"
      @action="goSearch"
    />
    <view
      v-else
      class="bookmark-archive"
    >
      <view class="section-heading">
        <text aria-live="polite">
          {{ appliedSearch ? `找到 ${total} 个收藏词条` : `已收藏 ${total} 个词条` }}
        </text>
        <BaseButton
          v-if="appliedSearch"
          size="small"
          variant="ghost"
          text="查看全部收藏"
          :disabled="loading || removingId !== null"
          @click="resetSearch"
        />
      </view>

      <view class="bookmark-list">
        <view
          v-for="entry in entries"
          :key="entry.id"
          class="bookmark-card"
        >
          <view class="bookmark-card__head">
            <view :class="['status-badge', entry.status]">
              {{ statusLabel(entry.status) }}
            </view>
          </view>
          <view class="bookmark-card__title">
            {{ entryTitle(entry) }}
          </view>
          <view class="bookmark-card__summary">
            {{ entry.summary || '大意待补充' }}
          </view>
          <view class="bookmark-card__meta">
            <view class="meta-chip">
              {{ dialectLabel(entry.usage_dialect) || '地区待补' }}
            </view>
            <view class="meta-chip">
              {{ entry.recording_count || 0 }} 段录音
            </view>
            <view
              v-if="entry.evidence_count"
              class="meta-chip"
            >
              {{ entry.evidence_count }} 份依据
            </view>
          </view>
          <view class="bookmark-card__actions">
            <BaseButton
              size="small"
              :disabled="removingId !== null"
              :aria-label="`查看词条：${entryTitle(entry)}`"
              text="查看词条"
              @click="goEntryDetail(entry.id)"
            />
            <BaseButton
              size="small"
              variant="ghost"
              :loading="removingId === entry.id"
              :disabled="loading || removingId !== null"
              :aria-label="`移出收藏：${entryTitle(entry)}`"
              text="移出收藏"
              @click="remove(entry.id)"
            />
          </view>
        </view>
      </view>
      <view
        v-if="next"
        class="bookmark-pagination"
      >
        <text
          v-if="paginationError"
          role="status"
        >
          更多收藏暂时没加载出来，已显示的词条仍可查看。
        </text>
        <BaseButton
          variant="ghost"
          :text="paginationError ? '重试加载更多收藏' : '查看更多收藏'"
          :loading="loading"
          :disabled="removingId !== null"
          @click="load(true)"
        />
      </view>
    </view>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import {
  dialectLabel,
  entryTitle,
  listEntryBookmarks,
  pageResults,
  unbookmarkEntry,
} from '@/services/entryRecording';
import { notify, notifySuccess } from '@/services/feedback';
import { goEntryDetail, goSearch } from '@/services/navigation';

export default {
  components: {
    BaseButton, BaseField, BaseLoading, EmptyState, PageShell,
  },
  data() {
    return {
      entries: [],
      loading: false,
      error: '',
      paginationError: false,
      removingId: null,
      keyword: '',
      appliedSearch: '',
      page: 1,
      total: 0,
      next: false,
    };
  },
  onLoad() { this.load(); },
  methods: {
    dialectLabel,
    entryTitle,
    goEntryDetail,
    goSearch,
    statusLabel(status) {
      return ({
        published: '已公开', disputed: '有争议', draft: '待整理', rejected: '已退回',
      })[status] || '整理中';
    },
    captureSearchInput(event) {
      const value = typeof event === 'string' ? event : event?.value;
      if (typeof value === 'string') this.keyword = value;
    },
    confirmSearch(event) {
      this.captureSearchInput(event);
      return this.submitSearch();
    },
    async submitSearch() {
      await this.$nextTick();
      if (this.loading || this.removingId !== null) return;
      this.appliedSearch = this.keyword.trim();
      await this.load();
    },
    resetSearch() {
      this.keyword = '';
      this.submitSearch();
    },
    async load(more = false) {
      if (this.loading || (more && !this.next)) return;
      const page = more ? this.page + 1 : 1;
      this.loading = true;
      this.error = '';
      this.paginationError = false;
      if (!more) {
        this.entries = [];
        this.next = false;
      }
      try {
        const response = await listEntryBookmarks({
          page,
          ...(this.appliedSearch ? { search: this.appliedSearch } : {}),
        });
        const results = pageResults(response);
        const loadedIds = new Set(this.entries.map((entry) => entry.id));
        this.entries = [...this.entries, ...results.filter((entry) => !loadedIds.has(entry.id))];
        this.page = page;
        this.total = response.count ?? this.entries.length;
        this.next = Boolean(response.next);
      } catch (error) {
        if (more) this.paginationError = true;
        else this.error = error?.message || '请检查网络或登录状态后重试';
      } finally {
        this.loading = false;
      }
    },
    async remove(id) {
      if (this.loading || this.removingId !== null) return;
      this.removingId = id;
      try {
        await unbookmarkEntry(id);
        this.entries = this.entries.filter((entry) => entry.id !== id);
        this.total = Math.max(0, this.total - 1);
        notifySuccess('已移出收藏');
        // Removing a row shifts the offset for pages that have not been loaded.
        if (this.next) await this.load();
      } catch (error) {
        notify({ title: error?.message || '暂时无法移出收藏' });
      } finally {
        this.removingId = null;
      }
    },
  },
};
</script>

<style scoped>
.bookmark-search {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.bookmark-search__controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--space-2);
}

.bookmark-search__submit {
  margin-bottom: var(--space-2);
}

.section-heading,
.bookmark-card__head,
.bookmark-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.section-heading {
  margin-bottom: var(--space-2);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
}

.bookmark-list {
  display: grid;
  gap: var(--space-2);
}

.bookmark-card {
  min-width: 0;
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.status-badge {
  display: inline-flex;
  flex: 0 0 auto;
  padding: 6rpx var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.status-badge.published {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.status-badge.rejected {
  background: var(--danger-subtle-color);
  color: var(--danger-color);
}

.bookmark-card__title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.bookmark-card__summary {
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.bookmark-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-3);
}

.meta-chip {
  padding: 6rpx var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.bookmark-card__actions {
  justify-content: flex-end;
  flex-wrap: wrap;
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-color);
}

.bookmark-pagination {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
}

@media (min-width: 720px) {
  .bookmark-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
