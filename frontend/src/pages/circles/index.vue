<template>
  <PageShell title="方言圈广场">
    <view class="circle-intro">
      <text class="circle-intro__eyebrow">
        地区社群
      </text>
      <text class="circle-intro__title">
        找到与你乡音相连的圈子
      </text>
      <text class="circle-intro__copy">
        按地区一起听、录和核对乡音；加入后也不会改变你的主方言设置。
      </text>
    </view>

    <view class="search-panel">
      <BaseField
        v-model="search"
        name="circle-search"
        label="搜索地区或方言"
        placeholder="例如：莆田、闽语"
        :disabled="loading"
        @blur="captureSearch"
        @confirm="refresh"
      />
      <BaseButton
        block
        text="搜索"
        :disabled="loading"
        @click="refresh"
      />
    </view>

    <BaseLoading
      v-if="loading && !circles.length"
      text="正在加载方言圈…"
    />
    <EmptyState
      v-else-if="error"
      :title="error"
      description="检查网络后再试，已经输入的搜索词会保留。"
      action-text="重新加载"
      @action="refresh"
    />
    <EmptyState
      v-else-if="!circles.length"
      title="还没有匹配的方言圈"
      description="换一个地区或方言名称，也可以先去听公开乡音。"
      action-text="去听乡音"
      @action="toListen"
    />
    <view
      v-else
      class="circle-directory"
      data-circle-state="results"
    >
      <view class="circle-directory__heading">
        <view>
          <view class="circle-directory__eyebrow">
            圈子目录
          </view>
          <view class="circle-directory__title">
            {{ appliedSearch ? '搜索结果' : '全部方言圈' }}
          </view>
        </view>
        <view class="circle-directory__count">
          {{ total }} 个
        </view>
      </view>
      <view class="circle-list">
        <view
          v-for="circle in circles"
          :key="circle.id"
          class="circle-card"
        >
          <view class="circle-card__heading">
            <view>
              <view class="circle-card__title">
                {{ circle.name }}
              </view>
              <view class="circle-card__dialect">
                {{ circle.dialect.name }}
              </view>
            </view>
            <view
              v-if="circle.is_member"
              class="circle-card__membership"
            >
              已加入
            </view>
          </view>
          <view class="circle-card__description">
            {{ circle.description || `一起记录${circle.dialect.name}乡音。` }}
          </view>
          <view class="circle-card__stats">
            <text>{{ circle.member_count }} 位成员</text>
            <text>{{ circle.recording_count }} 段公开录音</text>
          </view>
          <view class="circle-card__actions">
            <BaseButton
              size="small"
              variant="ghost"
              text="查看圈子"
              @click="toDetail(circle.id)"
            />
            <BaseButton
              size="small"
              variant="ghost"
              :disabled="membershipBusyId === circle.id"
              :loading="membershipBusyId === circle.id"
              :text="circle.is_member ? '退出圈子' : '加入圈子'"
              @click="toggleMembership(circle)"
            />
          </view>
        </view>
      </view>
      <view
        v-if="next"
        class="circle-pagination"
      >
        <text
          v-if="moreError"
          role="status"
        >
          更多地区暂时没加载出来，已显示的圈子仍可打开。
        </text>
        <BaseButton
          variant="ghost"
          :loading="loading"
          :text="moreError ? '重试加载更多地区' : '查看更多地区'"
          @click="loadMore"
        />
      </view>
    </view>
  </PageShell>
</template>

<script>
import EmptyState from '@/components/EmptyState.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import PageShell from '@/components/PageShell.vue';
import { requireAuth } from '@/services/authGuard';
import { pageResults } from '@/services/entryRecording';
import { goCircleDetail, goHome } from '@/services/navigation';
import {
  joinCircle, leaveCircle, listCircles,
} from '@/services/guantou';

export default {
  components: {
    BaseButton, BaseField, BaseLoading, EmptyState, PageShell,
  },
  data() {
    return {
      circles: [],
      error: '',
      loading: false,
      membershipBusyId: null,
      search: '',
      appliedSearch: '',
      total: 0,
      page: 1,
      next: false,
      moreError: false,
    };
  },
  onLoad() {
    this.refresh();
  },
  methods: {
    captureSearch(event) {
      const value = typeof event === 'string' ? event : event?.value;
      if (typeof value === 'string') this.search = value;
    },
    async refresh(event) {
      this.captureSearch(event);
      await this.$nextTick();
      if (this.loading) return;
      this.appliedSearch = this.search.trim();
      this.circles = [];
      this.next = false;
      await this.load(1);
    },
    loadMore() {
      if (this.next) return this.load(this.page + 1);
      return undefined;
    },
    async load(page) {
      if (this.loading) return;
      const more = page > 1;
      this.loading = true;
      this.error = '';
      this.moreError = false;
      try {
        const response = await listCircles({ page, search: this.appliedSearch }, true);
        const loadedIds = new Set(this.circles.map((circle) => circle.id));
        this.circles = [
          ...this.circles, ...pageResults(response).filter((circle) => !loadedIds.has(circle.id)),
        ];
        this.total = Number(response.count ?? this.circles.length);
        this.page = page;
        this.next = Boolean(response.next);
      } catch (error) {
        if (more) this.moreError = true;
        else this.error = error.message || '方言圈加载失败';
      } finally {
        this.loading = false;
      }
    },
    async toggleMembership(circle) {
      if (!requireAuth('circle_join', { page: 'circle_index', circleId: circle.id })) return;
      if (this.membershipBusyId === circle.id) return;
      this.membershipBusyId = circle.id;
      try {
        const result = circle.is_member
          ? await leaveCircle(circle.id)
          : await joinCircle(circle.id);
        this.circles = this.circles.map((item) => (item.id === circle.id
          ? { ...item, ...result }
          : item));
      } finally {
        this.membershipBusyId = null;
      }
    },
    toDetail(id) {
      goCircleDetail(id);
    },
    toListen() {
      goHome(true);
    },
  },
};
</script>

<style scoped>
.circle-pagination {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
}

.circle-intro,
.search-panel,
.circle-card {
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.circle-intro {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  background: var(--accent-subtle-color);
  border-color: transparent;
}

.circle-intro__eyebrow,
.circle-directory__eyebrow {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 800;
  letter-spacing: 2rpx;
}

.circle-intro__title,
.circle-directory__title {
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-weight: 900;
}

.circle-intro__title {
  font-size: var(--font-size-xl);
}

.circle-intro__copy {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
}

.search-panel {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
  background: var(--surface-color);
}

.circle-directory {
  margin-top: var(--space-4);
}

.circle-directory__heading,
.circle-card__heading,
.circle-card__stats,
.circle-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.circle-directory__title {
  margin-top: 4rpx;
  font-size: var(--font-size-lg);
}

.circle-directory__count,
.circle-card__membership,
.circle-card__dialect,
.circle-card__stats text {
  padding: 6rpx 12rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: 22rpx;
}

.circle-list {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.circle-card {
  background: var(--surface-color);
}

.circle-card__title {
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.circle-card__dialect {
  display: inline-flex;
  margin-top: var(--space-1);
}

.circle-card__membership {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-weight: 700;
}

.circle-card__description {
  margin-top: var(--space-2);
  color: var(--text-secondary-color);
  line-height: 1.6;
}

.circle-card__stats {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: var(--space-2);
}

.circle-card__actions {
  justify-content: flex-end;
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-color);
}

.search-panel + :deep(.base-loading),
.search-panel + :deep(.empty-state) {
  margin-top: var(--space-4);
}
</style>
