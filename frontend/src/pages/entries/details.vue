<template>
  <PageShell title="词条详情">
    <BaseLoading
      v-if="loading"
      text="正在读取词条…"
    />
    <EmptyState
      v-else-if="errorMessage"
      :title="errorMessage"
      action-text="重试"
      @action="load"
    />
    <view
      v-else-if="entry"
      class="entry-detail"
    >
      <view
        class="entry-hero"
        data-detail-section="meaning"
      >
        <view class="entry-hero__eyebrow">
          词条释义
        </view>
        <view class="entry-hero__title">
          {{ entryTitle(entry) }}
        </view>
        <view class="entry-hero__summary">
          {{ entry.summary || '大意待补充' }}
        </view>
        <view
          v-if="entry.senses?.length"
          class="meaning-block"
        >
          <view class="detail-section__label">
            分义与用法
          </view>
          <view
            v-for="sense in entry.senses"
            :key="sense.id"
            class="sense-row"
          >
            <text class="sense-row__number">
              {{ sense.sense_number }}
            </text>
            <view>
              <view class="sense-row__gloss">
                {{ sense.gloss }}
              </view>
              <view
                v-if="sense.usage_note"
                class="sense-row__note"
              >
                {{ sense.usage_note }}
              </view>
              <view
                v-if="sense.concepts?.length"
                class="sense-row__concepts"
              >
                关联概念：{{ sense.concepts.map((item) => item.label || item.code).join('、') }}
              </view>
            </view>
          </view>
        </view>
        <view
          v-if="entry.writings?.length"
          class="writing-block"
        >
          <view class="detail-section__label">
            收录写法
          </view>
          <view class="chip-list">
            <view
              v-for="writing in entry.writings"
              :key="writing.id"
              class="detail-chip"
            >
              {{ writing.writing.text }} · {{ writingTypeLabel(writing.writing.form_type) }}
            </view>
          </view>
        </view>
      </view>

      <view
        class="detail-section"
        data-detail-section="pronunciation"
      >
        <view class="detail-section__heading">
          <view>
            <view class="detail-section__eyebrow">
              地方读法
            </view>
            <view class="detail-section__title">
              地区与读音
            </view>
          </view>
          <DialectLabel
            :dialect="entry.usage_dialect"
            mode="detail"
          />
        </view>
        <view
          v-if="entry.pronunciation_variants?.length"
          class="pronunciation-list"
        >
          <view
            v-for="variant in entry.pronunciation_variants"
            :key="variant.id"
            class="pronunciation-row"
          >
            <view class="pronunciation-row__dialect">
              <DialectLabel
                :dialect="variant.dialect"
                mode="detail"
              />
            </view>
            <view class="pronunciation-row__value">
              {{ variant.surface_romanization || variant.base_romanization || variant.ipa }}
            </view>
            <view
              v-if="variant.ipa"
              class="pronunciation-row__ipa"
            >
              IPA {{ variant.ipa }}
            </view>
          </view>
        </view>
        <view
          v-else
          class="detail-section__pending"
        >
          这个地区的读音还没整理出来，可以先听下面的乡音。
        </view>
      </view>

      <view
        class="detail-section detail-section--recordings"
        data-detail-section="recordings"
      >
        <view class="detail-section__heading">
          <view>
            <view class="detail-section__eyebrow">
              真实乡音
            </view>
            <view class="detail-section__title">
              关联录音
            </view>
            <view class="detail-section__copy">
              同一词条可有多个地区读音和多段录音。
            </view>
          </view>
          <view class="recording-count">
            {{ entry.recording_count }} 段
          </view>
        </view>
        <view
          v-if="entry.needs_audio"
          class="needs-audio"
        >
          还没有录音，但它仍是一条有效词条。你可以补上第一段乡音。
        </view>
        <EmptyState
          v-if="!recordings.length"
          title="还没有可听的录音"
          action-text="补第一段录音"
          @action="continueChain"
        />
        <view
          v-else
          class="recording-list"
        >
          <EntryRecordingCard
            v-for="recording in recordings"
            :key="recording.id"
            :recording="recording"
            :attested="attestedDialects.has(recording.usage_dialect?.id)"
            @attest="attest"
            @continue="continueChain"
          />
        </view>
      </view>

      <view
        class="detail-section detail-section--evidence"
        data-detail-section="evidence"
      >
        <view class="evidence-heading">
          <view>
            <view class="detail-section__eyebrow">
              资料可信度
            </view>
            <view class="detail-section__title">
              整理状态与证据
            </view>
          </view>
          <view class="status-badge">
            {{ statusLabel(entry.status) }}
          </view>
        </view>
        <view
          v-if="entry.identity_note"
          class="entry-identity"
        >
          <text class="entry-identity__label">
            辨识说明
          </text>
          <text>
            {{ entry.identity_note }}
          </text>
        </view>
        <view class="evidence-metrics">
          <view class="evidence-metric">
            <text class="evidence-metric__value">
              {{ entry.recording_count }}
            </text>
            <text>
              录音
            </text>
          </view>
          <view class="evidence-metric">
            <text class="evidence-metric__value">
              {{ entry.attestation_count }}
            </text>
            <text>
              地区确认
            </text>
          </view>
          <view class="evidence-metric">
            <text class="evidence-metric__value">
              {{ entry.evidence_count }}
            </text>
            <text>
              文字证据
            </text>
          </view>
        </view>
        <view class="evidence-note">
          状态表示目前的整理进度；新录音和地区确认会继续补充这个词条。
        </view>
      </view>

      <view data-detail-section="discussion">
        <DiscussionSummary
          ref="summary"
          target-type="entry"
          :target-id="entry.id"
          @open="openPanel({})"
        />
      </view>
      <view
        class="detail-actions"
        data-detail-section="actions"
      >
        <view>
          <view class="detail-section__eyebrow">
            参与共建
          </view>
          <view class="detail-section__title">
            把你听到的说法补进来
          </view>
          <view class="detail-section__copy">
            收藏方便以后再找，也可以录下你所在地区的读法。
          </view>
        </view>
        <view class="detail-actions__buttons">
          <CollectionPicker :entry-id="entry.id" />
          <BaseButton
            block
            text="录下我这边的说法"
            @click="continueChain"
          />
          <BaseButton
            block
            :variant="entry.is_bookmarked ? 'primary' : 'ghost'"
            :text="entry.is_bookmarked ? '已收藏' : '收藏词条'"
            @click="toggleBookmark"
          />
        </view>
      </view>
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
import CollectionPicker from '@/components/CollectionPicker.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import DialectLabel from '@/components/DialectLabel.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import PageShell from '@/components/PageShell.vue';
import { requireAuth } from '@/services/authGuard';
import {
  createUsageAttestation,
  bookmarkEntry,
  entryTitle,
  getEntry,
  listRecordings,
  pageResults,
  unbookmarkEntry,
} from '@/services/entryRecording';
import { notifySuccess } from '@/services/feedback';
import { goRecord } from '@/services/navigation';
import { CAPABILITIES, ensureCapability } from '@/services/capabilities';
import { PRODUCT_EVENTS, trackProductEvent } from '@/services/productAnalytics';

export default {
  components: {
    DiscussionSummary,
    DiscussionPanel,
    CollectionPicker,
    BaseButton,
    BaseLoading,
    DialectLabel,
    EmptyState,
    EntryRecordingCard,
    PageShell,
  },
  data() {
    return {
      id: null,
      entry: null,
      recordings: [],
      loading: true,
      errorMessage: '',
      attestedDialects: new Set(),
      panelOpen: false,
      panelRoot: null,
      panelComment: null,
    };
  },
  computed: {
    /* 「词条讨论」+ 该词条各关联录音的讨论 */
    discussionScopes() {
      const scopes = [{ type: 'entry', id: this.id, label: '词条讨论' }];
      this.recordings.forEach((item) => {
        if (!item.id) return;
        scopes.push({
          type: 'recording',
          id: item.id,
          label: item.original_gloss || '一段乡音',
          subtitle: item.usage_dialect?.name || '',
        });
      });
      return scopes;
    },
  },
  onLoad(options = {}) {
    this.id = Number(options.id) || null;
    this.panelComment = Number(options.comment) || null;
    this.panelRoot = Number(options.root) || null;
    this.load();
  },
  onShow() {
    if (this.id && this.entry) this.load();
  },
  onBackPress() {
    if (!this.panelOpen) return false;
    this.panelOpen = false;
    return true;
  },
  onHide() {
    this.panelOpen = false;
  },
  methods: {
    entryTitle,
    openPanel({ root = null, comment = null } = {}) {
      this.panelRoot = root || this.panelComment || null;
      if (comment) this.panelComment = comment;
      this.panelOpen = true;
    },
    refreshSummary() {
      if (this.$refs.summary) this.$refs.summary.reload();
    },
    statusLabel(status) {
      return {
        draft: '初稿',
        reviewed: '已整理',
        disputed: '有分歧',
        redirected: '已合并跳转',
      }[status] || '待整理';
    },
    writingTypeLabel(type) {
      return {
        orthographic: '汉字正字',
        popular: '俗写',
        loan: '借字',
        phonetic: '拟音',
        romanization: '罗马字',
        uncertain: '待考写法',
      }[type] || '其他写法';
    },
    async load() {
      if (!this.id) {
        this.loading = false;
        this.errorMessage = '缺少词条编号';
        return;
      }
      this.loading = true;
      this.errorMessage = '';
      try {
        const [entry, recordings] = await Promise.all([
          getEntry(this.id),
          listRecordings({ entry_id: this.id, page_size: 50 }),
        ]);
        this.entry = entry;
        this.recordings = pageResults(recordings);
        /* 通知深链：等 scope 就绪后再打开面板，直接落在那条讨论上 */
        if (this.panelComment || this.panelRoot) {
          this.openPanel({ root: this.panelRoot, comment: this.panelComment });
        }
      } catch (error) {
        this.errorMessage = '词条暂时无法读取';
      } finally {
        this.loading = false;
      }
    },
    continueChain() {
      if (!requireAuth('record_recording', { page: 'entry_detail', entryId: this.id })) return;
      goRecord({ entry_id: this.id });
    },
    async toggleBookmark() {
      if (!requireAuth('bookmark_entry', { page: 'entry_detail', entryId: this.id })) return;
      const action = this.entry.is_bookmarked ? unbookmarkEntry : bookmarkEntry;
      const result = await action(this.id);
      this.entry.is_bookmarked = result.bookmarked;
      notifySuccess({ title: result.bookmarked ? '已收藏词条' : '已取消收藏' });
    },
    async attest({ dialectId }) {
      if (!dialectId) return;
      if (!requireAuth('attest_usage', { page: 'entry_detail', entryId: this.id })) return;
      if (!ensureCapability(CAPABILITIES.USAGE_ATTESTATION, 'entry_detail')) return;
      try {
        await createUsageAttestation(this.id, dialectId);
        this.attestedDialects = new Set([...this.attestedDialects, dialectId]);
        this.entry.attestation_count = Number(this.entry.attestation_count || 0) + 1;
        notifySuccess({ title: '已记下你这里也这么说' });
        trackProductEvent(PRODUCT_EVENTS.EVIDENCE_SUBMIT, {
          surface: 'entry_detail',
          result: 'success',
        });
      } catch (error) {
        trackProductEvent(PRODUCT_EVENTS.EVIDENCE_SUBMIT, {
          surface: 'entry_detail',
          result: 'error',
        });
        uni.showToast({ title: error.message || '确认失败，请稍后再试', icon: 'none' });
      }
    },
  },
};
</script>

<style scoped>
.entry-detail,
.recording-list {
  display: grid;
  gap: 24rpx;
}

.entry-hero,
.detail-section,
.detail-actions {
  padding: 28rpx;
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  border: 1rpx solid var(--border-color);
}

.entry-hero {
  background: var(--accent-subtle-color);
  border-color: transparent;
}

.detail-section__heading,
.evidence-heading {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  flex-wrap: wrap;
}

.detail-section__copy,
.sense-row__note,
.sense-row__concepts,
.pronunciation-row__ipa,
.evidence-note {
  color: var(--muted-color);
  font-size: 22rpx;
}

.entry-hero__eyebrow,
.detail-section__eyebrow,
.detail-section__label {
  color: var(--accent-color);
  font-size: 21rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.entry-hero__title {
  margin-top: 12rpx;
  font-family: STSong, SimSun, serif;
  font-size: 54rpx;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.entry-hero__summary {
  margin-top: 14rpx;
  color: var(--text-secondary-color);
  font-size: 30rpx;
  line-height: 1.65;
}

.meaning-block,
.writing-block {
  margin-top: 26rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid var(--border-color);
}

.needs-audio {
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  line-height: 1.6;
}

.detail-section__title {
  margin-top: 6rpx;
  font-family: STSong, SimSun, serif;
  font-size: 30rpx;
  font-weight: 800;
}

.detail-section__heading {
  align-items: flex-start;
}

.sense-row,
.pronunciation-row {
  display: flex;
  gap: 18rpx;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--border-color);
}

.sense-row__number {
  flex: 0 0 auto;
  color: var(--accent-color);
  font-weight: 900;
}

.sense-row__gloss,
.pronunciation-row__value {
  font-weight: 700;
}

.sense-row__note,
.sense-row__concepts,
.pronunciation-row__ipa {
  margin-top: 8rpx;
  line-height: 1.5;
}

.chip-list {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.detail-chip {
  padding: 10rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  font-size: 22rpx;
}

.pronunciation-row {
  display: grid;
  grid-template-columns: minmax(120rpx, auto) 1fr;
}

.pronunciation-row__value {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.pronunciation-row__ipa {
  grid-column: 2;
}

.detail-section__pending,
.entry-identity,
.evidence-note {
  margin-top: 22rpx;
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  line-height: 1.6;
}

.recording-count,
.status-badge {
  align-self: flex-start;
  padding: 7rpx 14rpx;
  border-radius: var(--radius-pill);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: 21rpx;
  font-weight: 800;
}

.recording-list,
.detail-section--recordings :deep(.empty-state) {
  margin-top: 22rpx;
}

.detail-section--recordings :deep(.recording-card) {
  background: var(--surface-subtle-color);
}

.evidence-heading {
  align-items: flex-start;
}

.entry-identity {
  display: grid;
  gap: 8rpx;
}

.entry-identity__label {
  color: var(--accent-color);
  font-size: 22rpx;
  font-weight: 800;
}

.evidence-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 22rpx;
}

.evidence-metric {
  display: grid;
  justify-items: center;
  gap: 4rpx;
  padding: 18rpx 8rpx;
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: 20rpx;
  text-align: center;
}

.evidence-metric__value {
  color: var(--text-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 30rpx;
  font-weight: 800;
}

.detail-actions {
  display: grid;
  gap: 24rpx;
  border-color: var(--accent-color);
}

.detail-actions__buttons {
  display: grid;
  gap: 14rpx;
}
</style>
