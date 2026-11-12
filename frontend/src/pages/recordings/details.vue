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
            v-if="shareMessage"
            variant="ghost"
            :open-type="shareType"
            :text="shareType || canSystemShare ? '分享乡音' : '复制乡音链接'"
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
      <DiscussionThread
        :key="id"
        :target-id="id"
        :anchor-comment-id="anchorCommentId"
        :anchor-root-id="anchorRootId"
      />
    </view>
  </PageShell>
</template>
<script>
import DiscussionThread from '@/components/DiscussionThread.vue';
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
  goEntryDetail, goRecord,
} from '@/services/navigation';
import { requireAuth } from '@/services/authGuard';
import { notify } from '@/services/feedback';
import {
  defaultContentShareMessage, recordingShareMessage, syncContentShareMenu,
} from '@/services/contentShare';
import { isWechatMiniProgram } from '@/services/platform';
import {
  canUseSystemShare, hasShareTarget, sharePage, WECHAT_SHARE_IMAGE,
} from '@/services/pageShare';

export default {
  components: {
    DiscussionThread,
    PageShell,
    BaseButton,
    BaseLoading,
    EmptyState,
    EntryRecordingCard,
    CollectionPicker,
  },
  data: () => ({
    id: null,
    anchorCommentId: null,
    anchorRootId: null,
    recording: null,
    loading: true,
    error: '',
    busy: false,

  }),
  computed: {
    recorderName() {
      return this.recording?.recorder?.nickname || this.recording?.recorder?.username || '乡音贡献者';
    },
    shareType() {
      return isWechatMiniProgram() ? 'share' : '';
    },
    canSystemShare: canUseSystemShare,
    shareMessage() {
      if (!hasShareTarget() || this.loading || this.error) return null;
      return recordingShareMessage(this.recording);
    },
  },
  watch: {
    shareMessage(message) {
      syncContentShareMenu(this, Boolean(message));
    },
  },
  onLoad(options = {}) {
    this.id = options.id;
    this.anchorCommentId = Number(options.comment) || null;
    this.anchorRootId = Number(options.root) || this.anchorCommentId;
  },
  onShow() {
    syncContentShareMenu(this, false);
    this.load();
  },
  // #ifdef MP-WEIXIN
  onShareAppMessage() {
    const { title, path } = this.shareMessage || defaultContentShareMessage();
    return { title, path, imageUrl: WECHAT_SHARE_IMAGE };
  },
  onShareTimeline() {
    const { title, query = 'id=' } = this.shareMessage || defaultContentShareMessage();
    return { title, query, imageUrl: WECHAT_SHARE_IMAGE };
  },
  // #endif
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
    async load() {
      this.loading = true;
      this.error = '';
      try {
        this.recording = await getRecording(this.id);
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
    share() {
      // #ifdef H5 || APP-PLUS
      return sharePage(this.shareMessage, '乡音链接已复制');
      // #endif
    },
  },
};
</script>
<style src="@/styles/collections.scss" lang="scss"></style>
