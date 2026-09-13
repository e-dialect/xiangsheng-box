<template>
  <PageShell title="录音草稿">
    <view class="box-stack">
      <view
        v-if="legacyWarnings.length"
        class="draft-notice draft-notice--legacy"
      >
        <text class="box-heading">
          发现旧版草稿
        </text>
        <text>
          有 {{ legacyWarnings.length }} 条旧版装罐草稿无法确认能否映射到录音字段，未自动导入；清理前不会删除当前 V2 草稿。
        </text>
        <BaseButton
          variant="ghost"
          :loading="cleaningLegacy"
          text="清理旧版草稿"
          @click="clearLegacy"
        />
      </view>
      <view
        v-if="invalidAudioCount"
        class="draft-notice draft-notice--audio"
      >
        <text class="box-heading">
          有 {{ invalidAudioCount }} 条录音已失效
        </text>
        <text>文字字段仍保留，可以继续编辑并重新录音。</text>
        <BaseButton
          variant="ghost"
          :loading="cleaningAudio"
          text="清理失效音频"
          @click="clearInvalidAudio"
        />
      </view>
      <view class="box-cover">
        <text class="box-kicker">
          留住未完成的乡音
        </text><text class="box-title">
          草稿箱
        </text><text>仅保存在当前设备，退出账号后仍会保留。</text>
      </view>
      <BaseLoading
        v-if="loading"
        text="正在检查草稿音频…"
      />
      <EmptyState
        v-else-if="!items.length"
        title="还没有草稿"
        action-text="录一段乡音"
        @action="goRecord"
      />
      <view
        v-for="item in items"
        :key="item.id"
        class="box-panel"
      >
        <text class="box-heading">
          {{ item.form.original_gloss || '未命名乡音' }}
        </text>
        <text>{{ item.audio?.available ? '已保存音频' : '音频不可用，文字仍保留，可继续补录' }}</text>
        <view class="box-actions">
          <BaseButton
            text="继续录制"
            @click="goRecord({ draft_id: item.id })"
          /><BaseButton
            variant="danger-ghost"
            text="删除"
            @click="remove(item.id)"
          />
        </view>
      </view>
    </view>
  </PageShell>
</template>
<script>
import PageShell from '@/components/PageShell.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import {
  clearInvalidRecordingDraftAudio,
  deleteRecordingDraft,
  discardLegacyRecordingDrafts,
  draftOwner,
  listLegacyRecordingDrafts,
  listRecordingDraftsWithAudioStatus,
  migrateLegacyRecordingDrafts,
} from '@/services/recordingDrafts';
import { goRecord } from '@/services/navigation';
import { confirm, notify } from '@/services/feedback';

export default {
  components: {
    BaseLoading,
    PageShell,
    BaseButton,
    EmptyState,
  },
  data: () => ({
    items: [],
    loading: false,
    owner: '',
    generation: 0,
    legacyWarnings: [],
    cleaningAudio: false,
    cleaningLegacy: false,
  }),
  computed: {
    invalidAudioCount() {
      return this.items.filter((item) => item.audio && item.audio.available === false).length;
    },
  },
  onShow() {
    this.load();
  },
  methods: {
    goRecord,
    async load() {
      this.generation += 1;
      const { generation } = this;
      const owner = draftOwner();
      this.loading = true;
      this.items = [];
      this.owner = owner;
      try {
        await migrateLegacyRecordingDrafts(owner);
        const items = await listRecordingDraftsWithAudioStatus(owner);
        const legacyWarnings = listLegacyRecordingDrafts().filter(
          (draft) => !draft.legacyOwner || draft.legacyOwner === owner,
        );
        if (generation === this.generation && draftOwner() === owner) {
          this.items = items;
          this.legacyWarnings = legacyWarnings;
        }
      } finally { if (generation === this.generation) this.loading = false; }
    },
    async clearInvalidAudio() {
      if (this.cleaningAudio) return;
      this.cleaningAudio = true;
      try {
        const count = await clearInvalidRecordingDraftAudio(this.owner);
        notify({ title: count ? `已清理 ${count} 条失效音频` : '没有需要清理的失效音频' });
        await this.load();
      } catch (error) {
        notify({ title: '失效音频清理失败，请重试' });
      } finally { this.cleaningAudio = false; }
    },
    async clearLegacy() {
      if (this.cleaningLegacy) return;
      if (!(await confirm({
        title: '清理旧版草稿',
        content: '无法确认字段对应关系的旧版草稿将被删除，当前录音草稿不会受影响。',
        danger: true,
      }))) return;
      this.cleaningLegacy = true;
      try {
        const count = discardLegacyRecordingDrafts({ owner: this.owner, includeUnscoped: true });
        notify({ title: count ? `已清理 ${count} 条旧版草稿` : '没有需要清理的旧版草稿' });
        await this.load();
      } catch (error) {
        notify({ title: '旧版草稿清理失败，请重试' });
      } finally { this.cleaningLegacy = false; }
    },
    async remove(id) {
      const { owner } = this;
      if (!(await confirm({
        title: '删除草稿？',
        content: '此设备保存的文字和录音将被删除。',
        danger: true,
      }))) return;
      try {
        if (draftOwner() !== owner) { await this.load(); return; }
        await deleteRecordingDraft(id, owner);
        await this.load();
      } catch (error) {
        notify({
          title: '删除失败，请重试',
        });
      }
    },
  },
};
</script>
<style src="@/styles/collections.scss" lang="scss"></style>
<style scoped>
.draft-notice {
  display: grid;
  gap: 14rpx;
  padding: 24rpx;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  color: var(--text-secondary-color);
  line-height: 1.55;
}

.draft-notice--legacy {
  border-color: var(--warning-color);
}

.draft-notice--audio {
  border-color: var(--danger-color);
}
</style>
