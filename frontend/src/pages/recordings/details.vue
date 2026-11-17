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
          {{ productName }} · 听见一个地方
        </text>
        <text class="box-title">
          录音详情
        </text>
        <text>{{ dialectLabel(recording.usage_dialect) }} · {{ recorderName }}</text>
      </view>
      <view class="box-panel">
        <EntryRecordingCard
          ref="player"
          :detail-link="false"
          :community="false"
          :recording="recording"
          @open-entry="goEntryDetail"
          @continue="recordFor"
        />
        <view
          v-if="!recording.media_id || recording.visibility"
          class="box-actions"
        >
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
          <RecordingContributorButton :recording="recording" />
        </view>
        <CollectionPicker
          v-if="!recording.media_id || recording.visibility"
          :recording="recording"
        />
      </view>
      <view
        v-if="showModeration"
        class="box-panel box-stack"
      >
        <text v-if="recording.review_reason">
          处理说明 · {{ recording.review_reason }}
        </text>
        <template v-if="recording.can_resubmit">
          <BaseField
            v-model="gloss"
            name="revision"
            label="修改录音大意"
            type="textarea"
            required
          />
          <BaseButton
            variant="ghost"
            :disabled="busy"
            :text="replacement ? replacement.name : '更换录音（可选）'"
            @click="chooseReplacement"
          />
          <text>请确认已取得说话人同意，审核通过后将公开录音和所填资料。</text>
          <BaseButton
            :disabled="busy || !gloss.trim()"
            text="同意并重新提交审核"
            @click="resubmit"
          />
        </template>
        <BaseButton
          v-if="recording.can_withdraw"
          variant="danger-ghost"
          :disabled="busy"
          text="撤回投稿"
          @click="withdraw"
        />
        <template v-if="recording.can_take_down">
          <BaseField
            v-model="reason"
            name="reason"
            label="下架理由"
            required
          />
          <BaseButton
            variant="danger-ghost"
            :disabled="busy || reason.trim().length < 4"
            text="下架并退回"
            @click="takeDown"
          />
        </template>
      </view>
      <view class="box-panel">
        <text class="box-heading">
          关联词条与整理内容
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
        <BaseButton
          v-if="recordingTarget"
          size="small"
          variant="ghost"
          text="录下我这边的说法"
          @click="recordFor(recordingTarget.id)"
        />
      </view>
      <DiscussionThread
        v-if="!recording.media_id || recording.visibility"
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
import BaseField from '@/components/BaseField.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import RecordingContributorButton from '@/components/RecordingContributorButton.vue';
import CollectionPicker from '@/components/CollectionPicker.vue';
import {
  getRecording, entryTitle, dialectLabel,
  withdrawRecording, resubmitRecording, createCurationAction,
} from '@/services/entryRecording';
import {
  likeRecording,
} from '@/services/recordingSocial';
import {
  goEntryDetail, goRecord,
} from '@/services/navigation';
import { requireAuth } from '@/services/authGuard';
import { chooseAudioFile, uploadFile } from '@/services/file';
import { confirm, notify } from '@/services/feedback';
import { stopAudio } from '@/utils/audio';
import { currentProductName } from '@/services/productProfile';
import {
  defaultContentShareMessage, qqContentShareMessage, recordingShareMessage, syncContentShareMenu,
} from '@/services/contentShare';
import { canUseNativeMiniProgramShare, isQQMiniProgram } from '@/services/platform';
import {
  canUseSystemShare, hasShareTarget, sharePage, WECHAT_SHARE_IMAGE,
} from '@/services/pageShare';

export default {
  components: {
    BaseField,
    DiscussionThread,
    PageShell,
    BaseButton,
    BaseLoading,
    EmptyState,
    EntryRecordingCard,
    RecordingContributorButton,
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
    gloss: '',
    replacement: null,
    reason: '',
    sessionToken: '',
    loadVersion: 0,

  }),
  computed: {
    productName: currentProductName,
    showModeration() {
      const r = this.recording;
      return r && (r.can_withdraw || r.can_resubmit || r.can_take_down || r.review_reason);
    },
    recordingTarget() {
      const { recording } = this;
      if (recording?.visibility !== true || recording.status === 'rejected') return null;
      const links = (recording.entry_links || []).filter((link) => link.is_current === true);
      const hasCompetingLink = links.some((link) => (
        (link.role === 'competing' && link.status !== 'rejected')
        || (link.role === 'primary' && ['suggested', 'disputed'].includes(link.status))
      ));
      if (hasCompetingLink) return null;
      const primary = links.filter((link) => link.role === 'primary'
        && link.status === 'accepted' && link.entry?.id);
      return primary.length === 1 ? primary[0].entry : null;
    },
    recorderName() {
      return this.recording?.recorder?.nickname || this.recording?.recorder?.username || '乡音贡献者';
    },
    shareType() {
      return canUseNativeMiniProgramShare() ? 'share' : '';
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
  onHide() {
    this.$refs.player?.stopPlayback?.();
    stopAudio();
  },
  onUnload() {
    stopAudio();
  },
  // #ifdef MP-WEIXIN || MP-QQ
  onShareAppMessage() {
    if (isQQMiniProgram()) return qqContentShareMessage(this.shareMessage, 'recording');
    const { title, path } = this.shareMessage || defaultContentShareMessage();
    return { title, path, imageUrl: WECHAT_SHARE_IMAGE };
  },
  // #endif
  // #ifdef MP-WEIXIN
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
      if (!requireAuth('record_recording', { entryId: id })) return;
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
      const token = uni.getStorageSync('token');
      const version = this.loadVersion + 1;
      this.loadVersion = version;
      this.sessionToken = token;
      this.recording = null;
      this.loading = true;
      this.error = '';
      try {
        const recording = await getRecording(this.id);
        if (version !== this.loadVersion || token !== uni.getStorageSync('token')) return;
        this.recording = recording;
        this.gloss = recording.original_gloss || '';
        this.replacement = null;
        this.reason = '';
      } catch (error) {
        if (version !== this.loadVersion) return;
        this.recording = null;
        this.error = '录音不存在、未公开或暂时无法读取';
      } finally {
        if (version === this.loadVersion) this.loading = false;
      }
    },
    async chooseReplacement() {
      try {
        const file = await chooseAudioFile();
        if (file && this.sessionToken === uni.getStorageSync('token')) this.replacement = file;
      } catch (error) {
        notify({ title: error.message || '无法选择录音' });
      }
    },
    async changeSubmission(action) {
      if (this.busy || this.sessionToken !== uni.getStorageSync('token')) return;
      this.busy = true;
      try {
        await action();
        this.$refs.player?.stopPlayback?.();
        await this.load();
      } catch (error) {
        notify({ title: error.message || '处理失败，请重试' });
      } finally {
        this.busy = false;
      }
    },
    withdraw() {
      return this.changeSubmission(async () => {
        if (!await confirm({ title: '撤回这段录音？', content: '撤回后本站的录音链接将停止对外提供收听，已经保存的副本无法收回。', danger: true })) return;
        if (this.sessionToken === uni.getStorageSync('token')) await withdrawRecording(this.id);
      });
    },
    resubmit() {
      return this.changeSubmission(async () => {
        const payload = { original_gloss: this.gloss.trim(), publication_consent: 'public-display-v1' };
        if (this.replacement) payload.audio_url = (await uploadFile(this.replacement.path)).url;
        if (this.sessionToken === uni.getStorageSync('token')) await resubmitRecording(this.id, payload);
      });
    },
    takeDown() {
      return this.changeSubmission(() => createCurationAction({
        target_type: 'recording',
        target_id: this.id,
        action_type: 'review',
        changes: { status: 'rejected', revision: this.recording.updated_at },
        reason: this.reason.trim(),
      }));
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
