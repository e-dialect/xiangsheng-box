<template>
  <PageShell title="一段乡音">
    <BaseLoading
      v-if="loading"
      text="正在读取乡音…"
    />
    <EmptyState
      v-else-if="error"
      :title="error"
      action-text="重试"
      @action="load"
    />
    <view
      v-else-if="recording"
      class="box-stack"
    >
      <view class="box-cover">
        <text class="box-kicker">
          乡声集盒 · 听见一个地方
        </text>
        <text class="box-title">
          {{ recording.original_gloss || '一段待整理的乡音' }}
        </text>
        <text>{{ dialectLabel(recording.usage_dialect) }} · {{ recorderName }}</text>
        <text class="box-note">
          {{ recording.rights_statement || '录制者暂未补充引用授权说明' }}
        </text>
      </view>
      <view class="box-panel">
        <EntryRecordingCard
          :detail-link="false"
          :community="false"
          :recording="recording"
          @open-entry="goEntryDetail"
          @continue="recordFor"
        />
        <view class="box-actions">
          <BaseButton
            :variant="recording.liked ? 'primary' : 'ghost'"
            :text="`${recording.liked ? '已赞' : '赞'} · ${recording.like_count || 0}`"
            :disabled="busy"
            @click="toggleLike"
          />
          <BaseButton
            v-if="recording.visibility"
            variant="ghost"
            :open-type="shareType"
            text="分享乡音"
            @click="share"
          />
        </view>
        <CollectionPicker :recording="recording" />
      </view>
      <view class="box-panel">
        <text class="box-heading">
          关联词条
        </text>
        <text
          v-if="!recording.entry_links?.length"
          class="box-note"
        >
          写法还在整理中，先听听贡献者的原话。
        </text>
        <BaseButton
          v-for="link in recording.entry_links"
          :key="link.id"
          variant="ghost"
          :text="`${entryTitle(link.entry)} · ${linkLabel(link)}`"
          @click="goEntryDetail(link.entry.id)"
        />
      </view>
      <DiscussionSummary
        ref="summary"
        :target-id="id"
        @open="openPanel"
      />
    </view>
    <DiscussionPanel
      v-if="panelOpen"
      :scopes="discussionScopes"
      :initial-root="panelRoot"
      :initial-comment="panelComment"
      @close="panelOpen = false"
      @sent="refreshSummary"
    />
  </PageShell>
</template>
<script>
import DiscussionSummary from '@/components/DiscussionSummary.vue';
import DiscussionPanel from '@/components/DiscussionPanel.vue';
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import CollectionPicker from '@/components/CollectionPicker.vue';
import {
  getRecording, entryTitle, dialectLabel,
} from '@/services/entryRecording';
import {
  likeRecording,
} from '@/services/recordingSocial';
import {
  goEntryDetail, goRecord, ROUTES, pageUrl,
} from '@/services/navigation';
import { requireAuth } from '@/services/authGuard';
import { notify } from '@/services/feedback';

export default {
  components: {
    DiscussionSummary,
    DiscussionPanel,
    PageShell,
    BaseButton,
    BaseLoading,
    EmptyState,
    EntryRecordingCard,
    CollectionPicker,
  },
  data: () => ({
    id: null,
    recording: null,
    loading: true,
    error: '',
    busy: false,
    panelOpen: false,
    panelRoot: null,
    panelComment: null,
  }),
  computed: {
    recorderName() {
      return this.recording?.recorder?.nickname || this.recording?.recorder?.username || '乡音贡献者';
    },
    shareType() {
      return typeof window === 'undefined' ? 'share' : '';
    },
    /* 录音详情默认只讨论这段录音 */
    discussionScopes() {
      return [{
        type: 'recording',
        id: this.id,
        label: this.recording?.original_gloss || '乡音留言',
      }];
    },
  },
  onLoad(options) {
    this.id = options.id;
    this.panelComment = Number(options.comment) || null;
    this.panelRoot = Number(options.root) || null;
  },
  onShow() {
    this.load();
  },
  onBackPress() {
    if (!this.panelOpen) return false;
    this.panelOpen = false;
    return true;
  },
  onHide() {
    this.panelOpen = false;
  },
  onShareAppMessage() {
    return this.shareMessage();
  },
  onShareTimeline() {
    return this.shareMessage();
  },
  methods: {
    entryTitle,
    dialectLabel,
    goEntryDetail,
    recordFor(id) {
      goRecord({
        entry_id: id,
      });
    },
    linkLabel(link) {
      return {
        primary: '主要词条',
        mention: '句中词',
        competing: '另一种解释',
      }[link.role] || '关联词条';
    },
    auth() {
      return requireAuth('interact_recording', {
        recordingId: this.id,
      });
    },
    openPanel() {
      this.panelOpen = true;
    },
    refreshSummary() {
      if (this.$refs.summary) this.$refs.summary.reload();
    },
    async load() {
      this.loading = true;
      this.error = '';
      try {
        this.recording = await getRecording(this.id);
        /* 通知深链：直接打开这条讨论并高亮被回复的留言 */
        if (this.panelComment || this.panelRoot) this.openPanel();
      } catch (error) {
        this.recording = null;
        this.error = '录音不存在、未公开或暂时无法读取';
      } finally {
        this.loading = false;
      }
    },
    async toggleLike() {
      if (this.busy || !this.auth()) return;
      this.busy = true;
      try {
        Object.assign(this.recording, await likeRecording(this.id, !this.recording.liked));
      } catch (error) {
        notify({
          title: '点赞失败，请重试',
        });
      } finally {
        this.busy = false;
      }
    },
    shareMessage() {
      if (!this.recording?.visibility) {
        return {
          title: '乡声集盒',
          path: ROUTES.home,
        };
      }
      return {
        title: `乡声集盒 · ${this.recording.original_gloss}`,
        path: pageUrl(ROUTES.recordingDetail, {
          id: this.id,
        }),
        query: `id=${this.id}`,
      };
    },
    share() {
      // #ifdef H5
      if (typeof window === 'undefined') return;
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const url = `${window.location.origin}${base}${pageUrl(ROUTES.recordingDetail, {
        id: this.id,
      })}`;
      uni.setClipboardData({
        data: url,
        success: () => notify({
          title: '乡音链接已复制',
        }),
        fail: () => notify({
          title: '复制失败，请重试',
        }),
      });
      // #endif
    },
  },
};
</script>
<style src="@/styles/collections.scss" lang="scss"></style>
