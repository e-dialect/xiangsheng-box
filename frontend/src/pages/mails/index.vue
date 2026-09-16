<template>
  <PageShell
    title="消息"
    :scroll="false"
    content-class="mailbox-content"
    :action-text="headerActionText"
    @action="markAllRead"
  >
    <scroll-view
      scroll-y
      class="mailbox-scroll"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="refresh"
      @scrolltolower="loadMore"
    >
      <view class="mailbox-layout">
        <view class="mailbox-intro">
          <view class="eyebrow">
            与你有关
          </view>
          <view class="intro-title">
            {{ introTitle }}
          </view>
          <view class="intro-copy">
            补证、审核和同乡来信都会汇总在这里。
          </view>
        </view>

        <view
          class="filters"
          role="tablist"
          aria-label="消息筛选"
        >
          <button
            v-for="option in filterOptions"
            :key="option.key"
            :class="['filter', { active: filter === option.key }]"
            role="tab"
            :aria-selected="filter === option.key"
            :disabled="loading"
            hover-class="filter--pressed"
            @tap="setFilter(option.key)"
          >
            {{ option.label }}
            <text
              v-if="option.key === 'unread' && unreadCount"
              class="filter-count"
            >
              {{ unreadCount }}
            </text>
          </button>
        </view>

        <BaseLoading
          v-if="loading && !notifications.length"
          text="正在整理消息…"
        />
        <EmptyState
          v-else-if="error && !notifications.length"
          title="消息暂时没有加载出来"
          :description="error"
          action-text="重新加载"
          @action="refresh"
        />
        <EmptyState
          v-else-if="!notifications.length"
          :title="filter === 'all' ? '还没有消息' : `没有${activeFilterLabel}消息`"
          :description="filter === 'all'
            ? '词条补证、地区确认和审核结果会出现在这里。'
            : '新的提醒会继续出现在这里。'"
        />
        <view
          v-else
          class="notification-list"
        >
          <view
            v-for="item in notifications"
            :key="item.id"
            :class="['notification-card', { unread: item.unread }]"
            role="button"
            :aria-label="`${item.unread ? '未读消息' : '消息'}：${item.title}`"
            hover-class="notification-card--pressed"
            @tap="openNotification(item)"
          >
            <view class="notification-leading">
              <image
                v-if="item.from.avatar"
                :src="item.from.avatar"
                class="avatar"
                mode="aspectFill"
              />
              <view
                v-else
                class="avatar avatar-fallback"
                aria-hidden="true"
              >
                {{ senderInitial(item) }}
              </view>
              <view
                v-if="item.unread"
                class="unread-dot"
                aria-hidden="true"
              />
            </view>

            <view class="notification-body">
              <view class="notification-meta">
                <text class="actor">
                  {{ item.from.nickname || '乡声集盒' }}
                </text>
                <text class="time">
                  {{ item.time }}
                </text>
              </view>
              <view class="title">
                {{ item.title }}
              </view>
              <view
                v-if="item.content"
                class="description"
              >
                {{ item.content }}
              </view>
              <view class="notification-next">
                <text>{{ item.target?.url ? '查看相关内容' : '阅读消息' }}</text>
                <text aria-hidden="true">
                  ›
                </text>
              </view>
            </view>
          </view>

          <view
            v-if="error"
            class="load-error"
          >
            <text>{{ error }}</text>
            <BaseButton
              size="small"
              variant="ghost"
              text="重试"
              @click="loadMore"
            />
          </view>
          <BaseLoading
            v-else-if="loadStatus === 'loading'"
            :delay="0"
            layout="horizontal"
            text="正在加载更多…"
          />
          <view
            v-else
            class="pagination-status"
            role="status"
          >
            {{ loadStatus === 'more' ? '上拉继续加载' : '没有更多消息了' }}
          </view>
        </view>
      </view>
    </scroll-view>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import { openPage } from '@/services/navigation';
import { toMailDetailsPage } from '@/routers/mail';
import { listNotifications, markNotificationsRead } from '@/services/mail';

const FILTER_OPTIONS = Object.freeze([
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'reply', label: '回复' },
  { key: 'like', label: '点赞' },
  { key: 'bookmark', label: '收藏' },
]);

const VERB_FILTERS = Object.freeze({
  reply: ['entry.comment', 'entry.reply', 'recording.comment', 'recording.reply'],
  like: ['recording.like', 'entry.comment_like', 'recording.comment_like'],
  bookmark: ['entry.bookmark'],
});

export default {
  components: {
    BaseButton, BaseLoading, EmptyState, PageShell,
  },
  data() {
    return {
      error: '',
      filter: 'all',
      loadStatus: 'more',
      loading: false,
      markingAll: false,
      notifications: [],
      page: 1,
      refreshing: false,
      filterOptions: FILTER_OPTIONS,
    };
  },
  computed: {
    activeFilterLabel() {
      return (this.filterOptions.find((option) => option.key === this.filter) || {}).label || '全部';
    },
    unreadCount() {
      return this.notifications.filter((item) => item.unread).length;
    },
    headerActionText() {
      if (!this.unreadCount) return '';
      return this.markingAll ? '处理中…' : '全部已读';
    },
    introTitle() {
      if (this.loading && !this.notifications.length) return '正在整理你的消息';
      if (this.filter !== 'all') {
        return this.notifications.length
          ? `${this.notifications.length} 条${this.activeFilterLabel}消息`
          : `没有${this.activeFilterLabel}消息`;
      }
      if (this.unreadCount) return `${this.unreadCount} 条消息待查看`;
      if (this.notifications.length) return '消息都看过了';
      return '重要进展，不错过';
    },
  },
  onLoad() {
    this.refresh();
  },
  methods: {
    senderInitial(item) {
      return String(item?.from?.nickname || '乡').trim().slice(0, 1) || '乡';
    },
    setFilter(filter) {
      if (this.filter === filter || this.loading) return;
      this.filter = filter;
      this.refresh();
    },
    async refresh() {
      if (this.loading) return;
      this.page = 1;
      this.notifications = [];
      this.error = '';
      this.loadStatus = 'more';
      this.refreshing = true;
      await this.fetchPage(1);
      this.refreshing = false;
    },
    async fetchPage(page) {
      if (this.loading || this.loadStatus === 'noMore') return;
      this.loading = true;
      this.loadStatus = 'loading';
      try {
        const verbs = VERB_FILTERS[this.filter];
        const response = await listNotifications({
          page,
          pageSize: 20,
          ...(this.filter === 'unread' ? { unread: true } : {}),
          ...(verbs ? { verb: verbs.join(',') } : {}),
        });
        this.notifications = this.notifications.concat(response.notifications || []);
        this.page = page;
        this.loadStatus = page < response.pages ? 'more' : 'noMore';
      } catch (error) {
        this.error = error.message || '消息加载失败';
        this.loadStatus = 'more';
      } finally {
        this.loading = false;
      }
    },
    loadMore() {
      if (this.loadStatus === 'more') this.fetchPage(this.page + 1);
    },
    async markAllRead() {
      if (!this.unreadCount || this.markingAll) return;
      this.markingAll = true;
      try {
        await markNotificationsRead();
        this.notifications = this.notifications.map((item) => ({ ...item, unread: false }));
        if (this.filter === 'unread') this.notifications = [];
        uni.showToast({ title: '消息已全部读过', icon: 'success' });
      } catch {
        // The request layer owns the visible failure feedback. Keep local state unchanged.
      } finally {
        this.markingAll = false;
      }
    },
    async openNotification(item) {
      if (item.unread) {
        try {
          await markNotificationsRead([item.id]);
          this.notifications = this.notifications.map((existing) => (existing.id === item.id
            ? { ...existing, unread: false }
            : existing));
        } catch {
          // Reading the message is still useful when the read-state request fails.
        }
      }
      if (item.target?.url) {
        openPage(item.target.url);
        return;
      }
      toMailDetailsPage(item.id);
    },
  },
};
</script>

<style scoped>
:deep(.mailbox-content) {
  height: calc(100vh - 104rpx - env(safe-area-inset-top));
  min-height: 0;
  padding: 0;
}

.mailbox-scroll {
  height: 100%;
}

.mailbox-layout {
  padding: var(--space-3) 28rpx 60rpx;
}

.mailbox-intro {
  padding: var(--space-4);
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
}

.eyebrow {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
}

.intro-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-xl);
  font-weight: 900;
  line-height: 1.35;
}

.intro-copy {
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.filters {
  display: flex;
  gap: var(--space-2);
  margin: var(--space-3) 0;
  overflow-x: auto;
}

.filter {
  flex: 0 0 auto;
  width: auto;
  min-width: 112rpx;
  margin: 0;
  padding: 0 var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 60rpx;
  white-space: nowrap;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.filter.active {
  border-color: var(--accent-color);
  background: var(--accent-color);
  color: var(--on-accent-color);
}

.filter[disabled] {
  opacity: 0.58;
}

.filter::after {
  border: 0;
}

.filter--pressed {
  transform: scale(0.98);
  opacity: 0.85;
}

.filter-count {
  margin-left: 6rpx;
  font-size: var(--font-size-xs);
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.notification-card {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.notification-card.unread {
  border-color: var(--accent-color);
  box-shadow: inset 6rpx 0 0 var(--accent-color);
}

.notification-card--pressed {
  transform: scale(0.99);
  opacity: 0.85;
}

.notification-leading {
  position: relative;
  flex: 0 0 auto;
}

.avatar {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-subtle-color);
}

.avatar-fallback {
  color: var(--accent-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-lg);
  font-weight: 900;
}

.unread-dot {
  position: absolute;
  top: -2rpx;
  right: -2rpx;
  width: 16rpx;
  height: 16rpx;
  border: 4rpx solid var(--surface-color);
  border-radius: 50%;
  background: var(--danger-color);
}

.notification-body {
  min-width: 0;
  flex: 1;
}

.notification-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.actor {
  min-width: 0;
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  flex: 0 0 auto;
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.title {
  margin-top: 6rpx;
  color: var(--text-color);
  font-size: var(--font-size-base);
  font-weight: 800;
  line-height: 1.45;
}

.description {
  display: -webkit-box;
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.55;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.notification-next {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-color);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--danger-subtle-color);
  color: var(--danger-color);
  font-size: var(--font-size-xs);
}

.pagination-status {
  padding: var(--space-2) var(--space-3);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .filter,
  .notification-card {
    transition: none;
  }
}
</style>
