<template>
  <PageShell
    :title="circle ? circle.name : '方言圈'"
    content-class="circle-detail-content"
  >
    <BaseLoading
      v-if="loadingCircle"
      text="正在进入方言圈…"
    />
    <EmptyState
      v-else-if="error"
      :title="error"
      description="检查网络后再试，或返回方言圈广场选择其他地区。"
      action-text="重新加载"
      @action="loadCircle"
    />
    <view
      v-else-if="circle"
      class="circle-detail"
    >
      <view class="circle-hero">
        <view class="circle-hero__heading">
          <view>
            <view class="circle-hero__eyebrow">
              地区圈
            </view>
            <view class="circle-hero__dialect">
              {{ circle.dialect.name }}
            </view>
          </view>
          <view
            v-if="circle.is_member"
            class="membership-badge"
          >
            已加入
          </view>
        </view>
        <view class="circle-hero__description">
          {{ circle.description || `一起记录${circle.dialect.name}乡音。` }}
        </view>
        <view class="circle-hero__stats">
          <text>{{ circle.member_count }} 位成员</text>
          <text>{{ circle.recording_count }} 段公开录音</text>
        </view>
        <BaseButton
          class="membership-action"
          size="small"
          variant="ghost"
          :disabled="membershipBusy"
          :loading="membershipBusy"
          :text="circle.is_member ? '退出这个圈子' : '加入这个圈子'"
          @click="toggleMembership"
        />
      </view>

      <view class="recording-section">
        <view class="recording-section__heading">
          <view>
            <view class="recording-section__eyebrow">
              真实乡音
            </view>
            <view class="recording-section__title">
              圈内录音
            </view>
            <view class="recording-section__copy">
              每段录音保留自己的地区、读音和词条关联。
            </view>
          </view>
          <BaseButton
            v-if="recordings.length"
            size="small"
            text="录一段"
            @click="recordHere"
          />
        </view>
        <BaseLoading
          v-if="loadingRecordings && !recordings.length"
          text="正在寻找圈内乡音…"
        />
        <EmptyState
          v-else-if="recordingsError"
          :title="recordingsError"
          description="圈子资料已经载入，可以只重新获取公开录音。"
          action-text="重新获取录音"
          @action="loadRecordings()"
        />
        <EmptyState
          v-else-if="!recordings.length"
          title="圈里还没有公开录音"
          description="录下第一段乡音，邀请同乡一起补充词条和地区差异。"
          action-text="录第一段"
          @action="recordHere"
        />
        <view
          v-else
          class="recording-list"
        >
          <EntryRecordingCard
            v-for="recording in recordings"
            ref="recordingCards"
            :key="recording.id"
            :recording="recording"
            @open-entry="goEntryDetail"
            @continue="continueChain"
          />
        </view>
        <view
          v-if="hasMoreRecordings"
          class="recording-pagination"
        >
          <text
            v-if="moreError"
            role="status"
          >
            更多乡音暂时没加载出来，已显示的录音仍可听。
          </text>
          <BaseButton
            variant="ghost"
            :text="moreError ? '重试加载更多乡音' : '听更多乡音'"
            :loading="loadingRecordings"
            @click="loadRecordings(true)"
          />
        </view>
      </view>
    </view>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import PageShell from '@/components/PageShell.vue';
import { requireAuth } from '@/services/authGuard';
import { goEntryDetail, goRecord } from '@/services/navigation';
import {
  getCircle, joinCircle, leaveCircle, listCircleRecordings,
} from '@/services/guantou';
import { pageResults } from '@/services/entryRecording';

export default {
  components: {
    BaseButton, BaseLoading, EmptyState, EntryRecordingCard, PageShell,
  },
  data() {
    return {
      circle: null,
      circleId: null,
      error: '',
      loadingCircle: true,
      loadingRecordings: false,
      membershipBusy: false,
      recordings: [],
      recordingsError: '',
      recordingPage: 1,
      hasMoreRecordings: false,
      moreError: false,
    };
  },
  onLoad(options) {
    this.circleId = Number(options.id);
    this.loadCircle();
  },
  onHide() {
    this.stopRecordingPlayback();
  },
  onUnload() {
    this.stopRecordingPlayback();
  },
  methods: {
    stopRecordingPlayback() {
      [this.$refs.recordingCards].flat().forEach((card) => {
        card?.stopPlayback();
      });
    },
    async loadCircle() {
      this.loadingCircle = true;
      this.error = '';
      try {
        this.circle = await getCircle(this.circleId);
        this.loadingCircle = false;
        await this.loadRecordings();
      } catch (error) {
        this.error = error.message || '方言圈加载失败';
      } finally {
        this.loadingCircle = false;
      }
    },
    async loadRecordings(more = false) {
      if (this.loadingRecordings || (more && !this.hasMoreRecordings)) return;
      const page = more ? this.recordingPage + 1 : 1;
      this.loadingRecordings = true;
      this.recordingsError = '';
      this.moreError = false;
      try {
        const response = await listCircleRecordings(this.circleId, {
          page,
          page_size: 50,
        });
        const existing = more ? this.recordings : [];
        const loadedIds = new Set(existing.map((recording) => recording.id));
        this.recordings = [
          ...existing, ...pageResults(response).filter((recording) => !loadedIds.has(recording.id)),
        ];
        this.recordingPage = page;
        this.hasMoreRecordings = Boolean(response.next);
      } catch (error) {
        if (more) this.moreError = true;
        else this.recordingsError = error.message || '圈内录音暂时无法读取';
      } finally {
        this.loadingRecordings = false;
      }
    },
    async toggleMembership() {
      if (!this.circle) return;
      if (!requireAuth('circle_join', { page: 'circle_detail', circleId: this.circle.id })) return;
      if (this.membershipBusy) return;
      this.membershipBusy = true;
      try {
        const result = this.circle.is_member
          ? await leaveCircle(this.circle.id)
          : await joinCircle(this.circle.id);
        this.circle = { ...this.circle, ...result };
      } finally {
        this.membershipBusy = false;
      }
    },
    recordHere() {
      if (!requireAuth('record_recording', {
        page: 'circle_detail',
        circleId: this.circle.id,
        dialectId: this.circle.dialect.id,
      })) return;
      goRecord({ dialect_id: this.circle.dialect.id });
    },
    goEntryDetail,
    continueChain(entryId) {
      if (!requireAuth('record_recording', {
        page: 'circle_detail', entryId, dialectId: this.circle.dialect.id,
      })) return;
      goRecord({ entry_id: entryId, dialect_id: this.circle.dialect.id });
    },
  },
};
</script>

<style scoped>
.recording-pagination {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
}

:deep(.circle-detail-content) {
  padding: var(--space-3) 28rpx var(--space-5);
}

.circle-detail,
.recording-list {
  display: grid;
  gap: var(--space-3);
}

.circle-hero,
.recording-section {
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.circle-hero {
  background: var(--accent-subtle-color);
  border-color: transparent;
}

.circle-hero__heading,
.circle-hero__stats,
.recording-section__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.circle-hero__eyebrow,
.recording-section__eyebrow {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 800;
  letter-spacing: 2rpx;
}

.circle-hero__dialect,
.recording-section__title {
  margin-top: 4rpx;
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-xl);
  font-weight: 900;
}

.circle-hero__description {
  margin-top: var(--space-2);
  color: var(--text-secondary-color);
  line-height: 1.65;
}

.circle-hero__stats {
  justify-content: flex-start;
  margin-top: var(--space-2);
}

.circle-hero__stats text,
.membership-badge {
  padding: 6rpx 12rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: 22rpx;
}

.membership-badge {
  background: var(--surface-color);
  color: var(--accent-color);
  font-weight: 700;
}

.membership-action {
  margin-top: var(--space-3);
}

.recording-section {
  background: var(--surface-color);
}

.recording-section__copy {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.55;
}

.recording-section > :deep(.base-loading),
.recording-section > :deep(.empty-state),
.recording-list {
  margin-top: var(--space-3);
}

.recording-list :deep(.recording-card) {
  background: var(--surface-subtle-color);
}
</style>
