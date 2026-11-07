<template>
  <PageShell title="贡献履历">
    <view class="archive-intro">
      <view class="eyebrow">
        可追溯的参与记录
      </view>
      <view class="intro-title">
        记录你留下了什么，不给人排权威高低
      </view>
      <view class="intro-copy">
        每段录音、每份依据和每次修订各自留痕；数量只帮助你找回参与过的资料。
      </view>
    </view>

    <BaseLoading
      v-if="loading"
      text="正在整理你的贡献记录…"
    />
    <EmptyState
      v-else-if="error"
      title="贡献履历暂时没有加载出来"
      :description="error"
      action-text="重新加载"
      @action="load"
    />
    <template v-else>
      <view
        class="metric-strip"
        aria-label="贡献概览"
      >
        <view
          v-for="item in metrics"
          :key="item.key"
          class="metric-item"
        >
          <view class="metric-number">
            {{ item.value }}
          </view>
          <view class="metric-label">
            {{ item.label }}
          </view>
        </view>
      </view>

      <view class="archive-section">
        <view class="section-heading">
          <view>
            <view class="section-kicker">
              地区足迹
            </view>
            <view class="section-title">
              你参与记录过的乡音
            </view>
          </view>
          <view class="section-count">
            {{ history.dialect_footprint?.length || 0 }} 处
          </view>
        </view>
        <view
          v-if="!history.dialect_footprint?.length"
          class="inline-empty"
        >
          还没有形成地区足迹；录音或确认本地用法后，会在这里留下记录。
        </view>
        <view
          v-for="item in history.dialect_footprint"
          :key="item.dialect.id"
          class="footprint-row"
        >
          <view class="footprint-copy">
            <view
              class="footprint-mark"
              aria-hidden="true"
            />
            <DialectLabel
              :dialect="item.dialect"
              mode="card"
            />
          </view>
          <text class="row-value">
            {{ item.contribution_count }} 次参与
          </text>
        </view>
      </view>

      <view class="archive-section activity-section">
        <view class="section-heading">
          <view>
            <view class="section-kicker">
              最近参与
            </view>
            <view class="section-title">
              按时间找回你的记录
            </view>
          </view>
          <view class="section-count">
            {{ history.recent_activity?.length || 0 }} 条
          </view>
        </view>
        <EmptyState
          v-if="!history.recent_activity?.length"
          title="还没有贡献记录"
          description="你可以先录下一段会说的乡音，写法和音标都可以以后补。"
          action-text="去录乡音"
          @action="goRecord"
        />
        <view
          v-for="event in history.recent_activity"
          :key="`${event.kind}-${event.target_id}-${event.created_at}`"
          class="activity-row"
        >
          <view
            class="activity-mark"
            aria-hidden="true"
          >
            {{ kindMark(event.kind) }}
          </view>
          <view class="activity-copy">
            <view class="activity-meta">
              <view class="activity-kind">
                {{ kindLabel(event.kind) }}
              </view>
              <view class="activity-date">
                {{ dateLabel(event.created_at) }}
              </view>
            </view>
            <view class="activity-label">
              {{ event.label }}
            </view>
            <BaseButton
              v-if="event.kind === 'recording'"
              size="small"
              variant="ghost"
              text="查看录音详情"
              @click="goRecordingDetail(event.target_id)"
            />
          </view>
        </view>
      </view>
    </template>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import DialectLabel from '@/components/DialectLabel.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import { getMyContributionHistory } from '@/services/entryRecording';
import { goRecord, goRecordingDetail } from '@/services/navigation';

export default {
  components: {
    BaseButton,
    BaseLoading,
    DialectLabel,
    EmptyState,
    PageShell,
  },
  data() { return { history: {}, loading: true, error: '' }; },
  computed: {
    metrics() {
      const summary = this.history.summary || {};
      return [
        { key: 'recordings', label: '录音', value: summary.recordings || 0 },
        { key: 'evidence', label: '补证', value: summary.evidence || 0 },
        { key: 'revisions', label: '修订', value: summary.revisions || 0 },
        { key: 'dialects', label: '地区足迹', value: summary.dialects || 0 },
      ];
    },
  },
  onLoad() { this.load(); },
  methods: {
    goRecordingDetail,
    goRecord,
    kindLabel(kind) {
      return ({
        recording: '录音', evidence: '补证', revision: '修订', attestation: '地区确认',
      })[kind] || '贡献';
    },
    kindMark(kind) {
      return ({
        recording: '音', evidence: '证', revision: '修', attestation: '认',
      })[kind] || '记';
    },
    dateLabel(value) { return value ? String(value).slice(0, 10) : '日期待补'; },
    async load() {
      this.loading = true;
      this.error = '';
      this.history = {};
      try {
        this.history = (await getMyContributionHistory()) || {};
      } catch (error) {
        this.error = error?.message || '请检查网络或登录状态后重试';
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.archive-intro {
  padding: var(--space-4);
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
}

.eyebrow,
.section-kicker,
.activity-kind {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
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
  line-height: 1.65;
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  overflow: hidden;
}

.metric-item {
  min-width: 0;
  padding: var(--space-3) var(--space-1);
  border-right: 1px solid var(--border-color);
  text-align: center;
}

.metric-item:last-child {
  border-right: 0;
}

.metric-number {
  color: var(--text-color);
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.metric-label,
.row-value,
.section-count,
.activity-date {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.metric-label {
  margin-top: var(--space-1);
}

.archive-section {
  margin-top: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.section-heading,
.activity-meta,
.footprint-row,
.footprint-copy {
  display: flex;
  align-items: center;
}

.section-heading,
.activity-meta,
.footprint-row {
  justify-content: space-between;
  gap: var(--space-2);
}

.section-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.section-count {
  flex: 0 0 auto;
}

.inline-empty {
  margin-top: var(--space-3);
  padding: var(--space-4) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
  text-align: center;
}

.footprint-row {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-color);
}

.section-heading + .footprint-row {
  margin-top: var(--space-2);
}

.footprint-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.footprint-copy {
  min-width: 0;
  gap: var(--space-2);
  color: var(--text-color);
  font-weight: 700;
}

.footprint-mark {
  width: 12rpx;
  height: 12rpx;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--accent-color);
}

.activity-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-color);
}

.section-heading + .activity-row {
  margin-top: var(--space-2);
}

.activity-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.activity-mark {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 800;
}

.activity-copy {
  min-width: 0;
  flex: 1;
}

.activity-kind {
  letter-spacing: 0;
}

.activity-date {
  flex: 0 0 auto;
}

.activity-label {
  margin-top: var(--space-1);
  color: var(--text-color);
  line-height: 1.55;
  overflow-wrap: anywhere;
}
</style>
