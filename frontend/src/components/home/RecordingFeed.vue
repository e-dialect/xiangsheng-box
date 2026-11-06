<template>
  <PlatformScroll
    variant="recording-feed"
    @scrolltolower="loadMore"
  >
    <view
      class="recording-feed__opening"
      :class="{ 'recording-feed__opening--expanded': featured || discoveryMessage }"
    >
      <view class="recording-feed__intro">
        <view class="recording-feed__intro-meta">
          <text class="recording-feed__kicker">
            听见真实使用
          </text>
          <text class="recording-feed__scope">
            {{ scopeText }}
          </text>
        </view>
        <text class="recording-feed__title">
          先听这一句
        </text>
      </view>

      <view
        v-if="tab === 'today' || tab === 'recommended'"
        class="recording-feed__intro recording-feed__discovery"
      >
        <view class="box-actions">
          <BaseButton
            size="small"
            variant="light"
            text="今日精选"
            :disabled="discovering"
            @click="discover('daily')"
          />
          <BaseButton
            size="small"
            variant="light"
            text="换一段"
            :disabled="discovering"
            @click="discover('random')"
          />
        </view>
        <text
          v-if="discoveryMessage"
          aria-live="polite"
        >
          {{ discoveryMessage }}
        </text>
        <EntryRecordingCard
          v-if="featured"
          :recording="featured"
          @attest="attest"
          @open-entry="goEntryDetail"
          @continue="continueChain"
        />
      </view>
    </view>
    <view
      v-if="loading && !items.length"
      class="recording-feed__state recording-feed__state--loading"
      data-feed-state="loading"
      aria-live="polite"
    >
      <view
        class="recording-feed__skeleton"
        aria-hidden="true"
      >
        <view class="recording-feed__skeleton-line recording-feed__skeleton-line--meta" />
        <view class="recording-feed__skeleton-line recording-feed__skeleton-line--title" />
        <view class="recording-feed__skeleton-line recording-feed__skeleton-line--copy" />
        <view class="recording-feed__skeleton-actions">
          <view class="recording-feed__skeleton-button" />
          <view class="recording-feed__skeleton-button" />
        </view>
      </view>
      <BaseLoading
        layout="horizontal"
        text="正在寻找乡音…"
      />
    </view>
    <view
      v-else-if="errorMessage && !items.length"
      class="recording-feed__state"
      data-feed-state="error"
      role="alert"
    >
      <text class="recording-feed__state-kicker">
        连接暂歇
      </text>
      <text class="recording-feed__state-title">
        {{ errorMessage }}
      </text>
      <text class="recording-feed__state-copy">
        检查网络后再试，已经加载过的内容不会受影响。
      </text>
      <BaseButton
        variant="light"
        text="重新加载"
        @click="reload"
      />
    </view>
    <view
      v-else-if="!items.length"
      class="recording-feed__state"
      data-feed-state="empty"
    >
      <text class="recording-feed__state-kicker">
        等你开声
      </text>
      <text class="recording-feed__state-title">
        这里还没有可听的录音
      </text>
      <text class="recording-feed__state-copy">
        录下一句你熟悉的乡音，让下一位来的人有声可听。
      </text>
      <BaseButton
        variant="light"
        text="录下第一段"
        @click="openRecorder"
      />
    </view>
    <view
      v-else
      class="recording-feed__list"
      data-feed-state="normal"
    >
      <view class="recording-feed__list-heading">
        <text class="recording-feed__list-title">
          正在听
        </text>
        <text class="recording-feed__list-count">
          已载入 {{ items.length }} 段
        </text>
      </view>
      <EntryRecordingCard
        v-for="recording in items"
        :key="recording.id"
        :recording="recording"
        :attested="attestedEntries.has(primaryEntryId(recording))"
        @open-entry="goEntryDetail"
        @attest="attest"
        @continue="continueChain"
      />
      <BaseLoading
        v-if="loadingMore"
        text="继续加载…"
      />
      <view
        v-else-if="!next && items.length"
        class="recording-feed__end"
      >
        已经听到这一页的末尾
      </view>
    </view>
  </PlatformScroll>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import PlatformScroll from '@/components/PlatformScroll.vue';
import { requireAuth } from '@/services/authGuard';
import {
  createUsageAttestation,
  listRecordings,
  pageResults,
  primaryEntryLink,
} from '@/services/entryRecording';
import { discoverRecording } from '@/services/recordingSocial';
import { notifySuccess } from '@/services/feedback';
import {
  goEntryDetail,
  goRecord,
} from '@/services/navigation';

export default {
  name: 'RecordingFeed',
  components: {
    BaseButton, BaseLoading, EntryRecordingCard, PlatformScroll,
  },
  props: {
    tab: { type: String, default: 'recommended' },
  },
  data() {
    return {
      items: [],
      featured: null,
      discovering: false,
      discoveryMessage: '',
      next: null,
      page: 1,
      loading: false,
      loadingMore: false,
      errorMessage: '',
      attestedEntries: new Set(),
    };
  },
  computed: {
    scopeText() {
      const labels = {
        today: '新近一段',
        following: '关注的声音',
        dialect: '我的本地',
        phrase: '短语片段',
        recommended: '全部乡音',
      };
      return labels[this.tab] || labels.recommended;
    },
  },
  created() {
    this.reload();
  },
  methods: {
    async discover(kind) {
      this.discovering = true; this.discoveryMessage = '';
      try { this.featured = await discoverRecording(kind); if (!this.featured) this.discoveryMessage = '还没有可听的公开录音'; } catch (error) { this.discoveryMessage = '暂时无法寻找乡音，请重试'; } finally { this.discovering = false; }
    },
    primaryEntryId(recording) {
      return primaryEntryLink(recording)?.entry?.id || null;
    },
    query(page = 1) {
      const params = { page, page_size: 12 };
      const app = typeof getApp === 'function' ? getApp() : null;
      const primaryDialect = app?.globalData?.userInfo?.primary_dialect;
      if (this.tab === 'following') params.following = true;
      if (this.tab === 'phrase') params.recording_type = 'phrase';
      if (this.tab === 'dialect' && primaryDialect?.id) {
        params.dialect_id = primaryDialect.id;
        params.dialect_scope = 'subtree';
      }
      return params;
    },
    async reload() {
      this.loading = true;
      this.errorMessage = '';
      try {
        const response = await listRecordings(this.query(1));
        this.items = pageResults(response);
        this.next = response?.next || null;
        this.page = 1;
      } catch (error) {
        this.errorMessage = '录音加载失败，请稍后重试';
      } finally {
        this.loading = false;
      }
    },
    async loadMore() {
      if (!this.next || this.loadingMore) return;
      this.loadingMore = true;
      try {
        const page = this.page + 1;
        const response = await listRecordings(this.query(page));
        this.items = [...this.items, ...pageResults(response)];
        this.next = response?.next || null;
        this.page = page;
      } catch (error) {
        uni.showToast({ title: '暂时无法继续加载', icon: 'none' });
      } finally {
        this.loadingMore = false;
      }
    },
    goEntryDetail,
    openRecorder() {
      if (!requireAuth('record_recording', { page: 'listen' })) return;
      goRecord();
    },
    continueChain(entryId) {
      if (!requireAuth('record_recording', { page: 'listen', entryId })) return;
      goRecord({ entry_id: entryId });
    },
    async attest({ entryId, dialectId }) {
      if (!entryId || !dialectId) return;
      if (!requireAuth('attest_usage', { page: 'listen', entryId })) return;
      try {
        await createUsageAttestation(entryId, dialectId);
        this.attestedEntries = new Set([...this.attestedEntries, entryId]);
        notifySuccess({ title: '已记下你这里也这么说' });
      } catch (error) {
        uni.showToast({ title: error.message || '确认失败，请稍后再试', icon: 'none' });
      }
    },
  },
};
</script>

<style scoped>
.recording-feed {
  height: 100%;
}

.recording-feed__intro {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: var(--space-2) var(--space-3);
  color: var(--on-immersive-color);
}

.recording-feed__intro-meta,
.recording-feed__list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.recording-feed__kicker {
  color: var(--immersive-accent-color);
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.recording-feed__scope {
  color: var(--on-immersive-faint-color);
  font-size: 18rpx;
  letter-spacing: 2rpx;
}

.recording-feed__title {
  font-size: 36rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.recording-feed__copy {
  color: var(--on-immersive-muted-color);
  font-size: 24rpx;
  line-height: 1.5;
}

.recording-feed__state {
  min-height: 400rpx;
  margin: 0 24rpx;
  padding: 52rpx 42rpx;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: var(--radius-lg);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 18rpx;
  background: var(--immersive-surface-color);
  color: var(--on-immersive-color);
}

.recording-feed__state-kicker {
  color: var(--immersive-accent-color);
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}

.recording-feed__state-title {
  font-family: STSong, SimSun, serif;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.35;
}

.recording-feed__state-copy {
  margin-bottom: 8rpx;
  color: var(--on-immersive-muted-color);
  font-size: 24rpx;
  line-height: 1.65;
}

.recording-feed__state--loading {
  justify-content: flex-start;
}

.recording-feed__state--loading :deep(.base-loading) {
  align-self: center;
  padding: 6rpx 0 0;
  color: var(--on-immersive-muted-color);
  --td-brand-color: var(--immersive-accent-color);
  --td-text-color-primary: var(--on-immersive-muted-color);
}

.recording-feed__skeleton {
  width: 100%;
  display: grid;
  gap: 20rpx;
}

.recording-feed__skeleton-line,
.recording-feed__skeleton-button {
  border-radius: var(--radius-pill);
  background: var(--immersive-surface-strong-color);
  animation: recording-feed-breathe 1.4s ease-in-out infinite;
}

.recording-feed__skeleton-line {
  height: 20rpx;
}

.recording-feed__skeleton-line--meta {
  width: 30%;
}

.recording-feed__skeleton-line--title {
  width: 56%;
  height: 42rpx;
}

.recording-feed__skeleton-line--copy {
  width: 88%;
  animation-delay: 0.12s;
}

.recording-feed__skeleton-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  margin-top: 18rpx;
}

.recording-feed__skeleton-button {
  height: 64rpx;
  animation-delay: 0.2s;
}

.recording-feed__list {
  display: grid;
  gap: 22rpx;
  padding: 0 24rpx 180rpx;
}

.recording-feed__list-heading {
  padding: 0 6rpx;
}

.recording-feed__list-title {
  color: var(--on-immersive-color);
  font-size: 24rpx;
  font-weight: 800;
}

.recording-feed__list-count {
  color: var(--on-immersive-faint-color);
  font-size: 20rpx;
}

.recording-feed__opening :deep(.recording-card),
.recording-feed__list :deep(.recording-card) {
  display: flex;
  flex-direction: column;
  background: var(--immersive-surface-color);
  border-color: var(--immersive-border-color);
  backdrop-filter: blur(18rpx);
}

.recording-feed__opening :deep(.recording-card__title),
.recording-feed__list :deep(.recording-card__title) {
  margin-top: 0;
  color: var(--on-immersive-color);
}

.recording-feed__opening :deep(.recording-card__meta),
.recording-feed__list :deep(.recording-card__meta) {
  justify-content: flex-start;
  margin-top: 18rpx;
}

.recording-feed__opening :deep(.recording-card__dialect),
.recording-feed__list :deep(.recording-card__dialect) {
  padding: 6rpx 14rpx;
  border-radius: var(--radius-pill);
  background: var(--immersive-surface-strong-color);
  color: var(--immersive-accent-color);
  font-weight: 800;
}

.recording-feed__opening :deep(.recording-card__type),
.recording-feed__list :deep(.recording-card__type),
.recording-feed__opening :deep(.recording-card__gloss),
.recording-feed__list :deep(.recording-card__gloss) {
  color: var(--on-immersive-muted-color);
}

.recording-feed__opening :deep(.recording-card__pronunciation),
.recording-feed__list :deep(.recording-card__pronunciation) {
  color: var(--immersive-accent-color);
}

.recording-feed__list :deep(.recording-card__playback-message) {
  color: var(--on-immersive-color);
}

.recording-feed__opening :deep(.recording-card__community),
.recording-feed__list :deep(.recording-card__community) {
  border-color: var(--immersive-border-color);
}

.recording-feed__opening :deep(.recording-card .base-button),
.recording-feed__list :deep(.base-button) {
  --td-brand-color: var(--immersive-accent-color);
  --td-brand-color-active: var(--immersive-wave-active-color);
  --td-text-color-anti: var(--immersive-bg-color);
}

.recording-feed__opening :deep(.recording-card .base-button--ghost),
.recording-feed__list :deep(.base-button--ghost) {
  --td-bg-color-container: transparent;
  --td-bg-color-container-active: var(--immersive-surface-strong-color);
}

.recording-feed__end {
  padding: 24rpx;
  color: var(--on-immersive-muted-color);
  text-align: center;
  font-size: 22rpx;
}

@keyframes recording-feed-breathe {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.42;
  }
}

@media (prefers-reduced-motion: reduce) {
  .recording-feed__skeleton-line,
  .recording-feed__skeleton-button {
    animation: none;
  }
}

/* #ifdef H5 */
@media screen and (min-width: 600px) and (max-height: 500px) and (orientation: landscape) {
  .recording-feed__opening:not(.recording-feed__opening--expanded) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }

  .recording-feed__intro {
    gap: 2px;
    padding: 8px 24px 6px;
  }

  .recording-feed__kicker,
  .recording-feed__scope {
    font-size: 12px;
    letter-spacing: 1px;
  }

  .recording-feed__title {
    font-size: 22px;
  }

  .recording-feed__copy {
    font-size: 14px;
    line-height: 1.3;
  }

  .recording-feed__state {
    min-height: 140px;
    margin: 0 24px;
    padding: 16px 24px;
  }

  .recording-feed__state:not(.recording-feed__state--loading) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: repeat(3, auto);
    align-content: center;
    align-items: center;
    column-gap: 24px;
    row-gap: 4px;
  }

  .recording-feed__state:not(.recording-feed__state--loading) :deep(.base-button) {
    grid-column: 2;
    grid-row: 1 / 4;
  }

  .recording-feed__state--loading {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 24px;
  }

  .recording-feed__state-kicker {
    font-size: 12px;
    letter-spacing: 2px;
  }

  .recording-feed__state-title {
    font-size: 22px;
  }

  .recording-feed__state-copy {
    margin-bottom: 0;
    font-size: 14px;
    line-height: 1.4;
  }

  .recording-feed__state--loading :deep(.base-loading) {
    padding: 0;
  }

  .recording-feed__skeleton {
    gap: 8px;
  }

  .recording-feed__skeleton-line {
    height: 8px;
  }

  .recording-feed__skeleton-line--title {
    height: 16px;
  }

  .recording-feed__skeleton-actions {
    gap: 8px;
    margin-top: 2px;
  }

  .recording-feed__skeleton-button {
    height: 24px;
  }

  .recording-feed__list {
    gap: 12px;
    padding: 0 24px 24px;
  }
}
/* #endif */
.box-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.recording-feed__discovery {
  padding-top: 0;
}
.recording-feed__discovery :deep(.recording-card) {
  width: 100%;
  box-sizing: border-box;
}
.recording-feed__opening :deep(.recording-card__author),
.recording-feed__list :deep(.recording-card__author),
.recording-feed__opening :deep(.recording-card__duration),
.recording-feed__list :deep(.recording-card__duration) {
  color: var(--on-immersive-muted-color);
}
.recording-feed :deep(.recording-context),
.recording-feed :deep(.recording-card__gloss-label) {
  color: var(--on-immersive-muted-color);
  border-color: var(--immersive-border-color);
}
.recording-feed :deep(.recording-context__states text) {
  color: var(--on-immersive-color);
  background: var(--immersive-surface-strong-color);
}
</style>
