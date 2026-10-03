<template>
  <AppShell
    title="录制乡音"
    active="record"
  >
    <view class="record-page">
      <view class="record-draft-actions">
        <BaseButton
          variant="ghost"
          text="草稿箱"
          @click="goRecordingDrafts"
        />
        <BaseButton
          variant="ghost"
          text="保存草稿"
          :loading="savingDraft"
          :disabled="submitting || savingDraft"
          @click="saveDraft"
        />
        <text
          v-if="draftMessage"
          aria-live="polite"
        >
          {{ draftMessage }}
        </text>
      </view>
      <view class="record-page__intro">
        <view class="record-page__intro-meta">
          <text class="record-page__eyebrow">
            一分钟采集
          </text>
          <text class="record-page__progress-copy">
            {{ requiredProgressLabel }}
          </text>
        </view>
        <text class="record-page__title">
          会说，就能把乡音留下来
        </text>
        <text class="record-page__copy">
          最低只需一段录音、使用地区和大意。不会写汉字、不会 IPA，都可以先留空。
        </text>
        <view
          class="record-progress"
          role="list"
          :aria-label="requiredProgressLabel"
        >
          <view
            v-for="step in requiredSteps"
            :key="step.key"
            class="record-progress__item"
            :class="{
              'record-progress__item--complete': step.complete,
              'record-progress__item--current': step.current,
            }"
            role="listitem"
            :aria-label="`${step.label}：${step.stateLabel}`"
          >
            <view class="record-progress__index">
              {{ step.complete ? '✓' : step.number }}
            </view>
            <text class="record-progress__label">
              {{ step.label }}
            </text>
          </view>
        </view>
      </view>

      <view
        v-if="!capabilityAvailable"
        class="record-section record-section--standalone"
      >
        录音提交正在维护。你可以稍后再试；应用不会读取或保存设备位置。
      </view>

      <BaseForm
        v-else
        ref="form"
        class="record-form"
        :data="form"
        :rules="rules"
      >
        <view class="required-flow">
          <view
            class="record-section record-section--audio"
            :class="{ 'record-section--complete': requiredSteps[0].complete }"
          >
            <view class="record-section__heading">
              <view class="record-section__index">
                1
              </view>
              <view class="record-section__heading-copy">
                <text class="record-section__title">
                  录下这句乡音
                </text>
                <text class="record-section__caption">
                  说一次你日常会用的词或短语
                </text>
              </view>
              <text
                class="record-section__state"
                :class="{ 'record-section__state--complete': requiredSteps[0].complete }"
              >
                {{ requiredSteps[0].stateLabel }}
              </text>
            </view>
            <view class="record-section__capture">
              <AudioCapture
                :audio="audio"
                :invalid="Boolean(audio.invalid || (audio.path && fieldErrors.audio_url))"
                @change="onAudioChange"
                @clear="clearAudio"
                @error="onAudioError"
              />
            </view>
            <view
              v-if="fieldErrors.audio_url"
              class="field-error"
            >
              {{ fieldErrors.audio_url }}
            </view>
          </view>

          <view
            class="record-section"
            :class="{ 'record-section--complete': requiredSteps[1].complete }"
          >
            <view class="record-section__heading">
              <view class="record-section__index">
                2
              </view>
              <view class="record-section__heading-copy">
                <text class="record-section__title">
                  标记使用地区
                </text>
                <text class="record-section__caption">
                  选择你能确定的最小范围
                </text>
              </view>
              <text
                class="record-section__state"
                :class="{ 'record-section__state--complete': requiredSteps[1].complete }"
              >
                {{ requiredSteps[1].stateLabel }}
              </text>
            </view>
            <t-cell
              title="使用地区"
              required
              :note="selectedDialectLabel"
              arrow
              hover
              @click="dialectPickerVisible = true"
            />
            <view
              v-if="fieldErrors.usage_dialect_id"
              class="field-error"
            >
              {{ fieldErrors.usage_dialect_id }}
            </view>
            <view class="record-section__help">
              不知道更细的地点时，可以停在自己确定的上一级范围。
            </view>
          </view>

          <view
            class="record-section"
            :class="{ 'record-section--complete': requiredSteps[2].complete }"
          >
            <view class="record-section__heading">
              <view class="record-section__index">
                3
              </view>
              <view class="record-section__heading-copy">
                <text class="record-section__title">
                  用自己的话说明大意
                </text>
                <text class="record-section__caption">
                  不需要专业术语，能说明白就好
                </text>
              </view>
              <text
                class="record-section__state"
                :class="{ 'record-section__state--complete': requiredSteps[2].complete }"
              >
                {{ requiredSteps[2].stateLabel }}
              </text>
            </view>
            <BaseField
              v-model="form.original_gloss"
              name="original_gloss"
              type="textarea"
              label="大意"
              required
              :maxlength="300"
              placeholder="例如：表示害怕的意思；看到危险时会说"
              :error="fieldErrors.original_gloss"
              @change="clearFieldError('original_gloss')"
            />
          </view>
        </view>

        <t-collapse
          v-model:value="optionalSections"
          class="record-optional"
          theme="card"
        >
          <t-collapse-panel
            value="optional"
            header="我还知道一些（可选）"
            header-right-content="写法、读音、已有词条、来源"
          >
            <view class="optional-fields">
              <BaseField
                v-model="form.original_writing"
                name="original_writing"
                label="我猜的写法"
                :maxlength="160"
                placeholder="不确定也可以写，系统会标成待考"
              />
              <BaseField
                v-model="form.original_pronunciation"
                name="original_pronunciation"
                label="我熟悉的读音记法"
                :maxlength="240"
                placeholder="IPA、罗马字或自己的记法都可以"
              />

              <view class="entry-linker">
                <view class="entry-linker__heading">
                  关联已有词条
                </view>
                <view
                  v-if="selectedEntry"
                  class="selected-entry"
                >
                  <view>
                    <view class="selected-entry__title">
                      {{ entryTitle(selectedEntry) }}
                    </view>
                    <view class="selected-entry__summary">
                      {{ selectedEntry.summary }}
                    </view>
                  </view>
                  <BaseButton
                    size="small"
                    variant="ghost"
                    text="取消关联"
                    @click="clearEntry"
                  />
                </view>
                <template v-else>
                  <BaseField
                    v-model="entryKeyword"
                    name="entry_keyword"
                    label="查找词条"
                    placeholder="按写法或大意搜索"
                    @confirm="searchEntries"
                  />
                  <BaseButton
                    size="small"
                    variant="ghost"
                    :loading="entrySearching"
                    text="查找可关联词条"
                    @click="searchEntries"
                  />
                  <view
                    v-for="entry in entryCandidates"
                    :key="entry.id"
                    class="entry-candidate"
                    role="button"
                    :aria-label="`关联词条：${entryTitle(entry)}`"
                    @tap="selectEntry(entry)"
                  >
                    <view class="entry-candidate__title">
                      {{ entryTitle(entry) }}
                    </view>
                    <view class="entry-candidate__summary">
                      {{ entry.summary || '大意待补充' }}
                    </view>
                    <view class="entry-candidate__meta">
                      {{ dialectLabel(entry.usage_dialect) }} · {{ entry.recording_count }} 段录音
                    </view>
                  </view>
                </template>
              </view>

              <BaseField
                v-model="form.citation"
                name="citation"
                label="来源补充"
                :maxlength="500"
                placeholder="谁教你这样说，或记录在哪本资料里"
              />
              <BaseField
                v-model="form.rights_statement"
                name="rights_statement"
                type="textarea"
                label="录音授权说明"
                :maxlength="300"
                placeholder="例如：允许乡声集盒展示与非商业研究引用，请注明录制者"
              />
            </view>
          </t-collapse-panel>
        </t-collapse>

        <view class="record-submit">
          <view class="record-submit__title">
            先保存，再慢慢补全
          </view>
          <view class="record-submit__note">
            提交后先成为可追溯初稿，写法和专业读音可以由你或整理员继续补充。
          </view>
          <view
            class="record-submit__status"
            :class="{ 'record-submit__status--ready': completedRequiredSteps === 3 }"
          >
            {{ recordSubmitHint }}
          </view>
          <BaseButton
            block
            size="large"
            :loading="submitting"
            :disabled="submitting"
            text="保存这段乡音"
            @click="submit"
          />
        </view>
      </BaseForm>

      <DialectSelector
        v-if="capabilityAvailable"
        v-model:visible="dialectPickerVisible"
        :value="form.usage_dialect_id"
        :dialects="dialects"
        :default-dialect="primaryDialect"
        :owner-scope="dialectOwnerScope"
        title="选择使用地区"
        @change="onDialectChange"
      />
    </view>
  </AppShell>
</template>

<script>
import TCell from '@tdesign/uniapp/cell/cell.vue';
import TCollapse from '@tdesign/uniapp/collapse/collapse.vue';
import TCollapsePanel from '@tdesign/uniapp/collapse-panel/collapse-panel.vue';
import AppShell from '@/components/AppShell.vue';
import AudioCapture from '@/components/AudioCapture.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import { requireAuth } from '@/services/authGuard';
import {
  createRecording,
  dialectLabel,
  entryTitle,
  getEntry,
  listEntries,
  pageResults,
} from '@/services/entryRecording';
import { uploadFile } from '@/services/file';
import { confirm, notify, notifySuccess } from '@/services/feedback';
import { listAllDialects } from '@/services/guantou';
import { goRecordingDetail, goRecordingDrafts } from '@/services/navigation';
import {
  draftOwner, listRecordingDrafts, saveRecordingDraft, restoreRecordingDraft, deleteRecordingDraft,
} from '@/services/recordingDrafts';
import { releaseDraftAudioUrl } from '@/services/recordingDraftAudio';
import { dialectBreadcrumb } from '@/utils/dialectTree';
import { CAPABILITIES, ensureCapability } from '@/services/capabilities';
import { PRODUCT_EVENTS, trackProductEvent } from '@/services/productAnalytics';

function emptyAudio() {
  return {
    path: '', name: '', durationMs: 0, origin: '', invalid: false,
  };
}

export default {
  components: {
    AppShell,
    AudioCapture,
    BaseButton,
    BaseField,
    BaseForm,
    DialectSelector,
    TCell,
    TCollapse,
    TCollapsePanel,
  },
  data() {
    return {
      form: {
        usage_dialect_id: '',
        original_gloss: '',
        original_writing: '',
        original_pronunciation: '',
        citation: '',
        rights_statement: '',
        recording_type: 'word',
      },
      rules: {
        original_gloss: [{ required: true, message: '请简单说明录音的大意' }],
      },
      audio: emptyAudio(),
      fieldErrors: {},
      optionalSections: [],
      dialects: [],
      dialectPickerVisible: false,
      entryKeyword: '',
      entryCandidates: [],
      entrySearching: false,
      selectedEntry: null,
      submitting: false,
      draftId: '',
      ownerScope: '',
      savingDraft: false,
      draftMessage: '',
      draftReady: false,
      draftTimer: null,
      draftSavePromise: null,
      savedDraftSignature: '',
      submitted: false,
      capabilityAvailable: true,
    };
  },
  computed: {
    requiredSteps() {
      const steps = [
        {
          key: 'audio', number: 1, label: '录音', complete: Boolean(this.audio.path && !this.audio.invalid),
        },
        {
          key: 'dialect', number: 2, label: '地区', complete: Boolean(this.form.usage_dialect_id),
        },
        {
          key: 'gloss', number: 3, label: '大意', complete: Boolean(String(this.form.original_gloss || '').trim()),
        },
      ];
      const currentIndex = steps.findIndex((step) => !step.complete);
      return steps.map((step, index) => {
        const current = index === currentIndex;
        let stateLabel = '待填写';
        if (step.complete) stateLabel = '已完成';
        else if (current) stateLabel = '当前';
        return { ...step, current, stateLabel };
      });
    },
    completedRequiredSteps() {
      return this.requiredSteps.filter((step) => step.complete).length;
    },
    requiredProgressLabel() {
      return `必要信息 ${this.completedRequiredSteps}/3`;
    },
    recordSubmitHint() {
      const remaining = 3 - this.completedRequiredSteps;
      return remaining === 0 ? '三项必要信息已齐，可以保存' : `还差 ${remaining} 项必要信息`;
    },
    primaryDialect() {
      return getApp()?.globalData?.userInfo?.primary_dialect || null;
    },
    dialectOwnerScope() {
      return getApp()?.globalData?.userInfo?.id || 'guest';
    },
    selectedDialectLabel() {
      const dialect = this.dialects.find(
        (item) => String(item.id) === String(this.form.usage_dialect_id),
      );
      return dialect ? dialectBreadcrumb(dialect, this.dialects) : '请选择已知范围';
    },
  },
  watch: {
    form: { deep: true, handler() { this.scheduleDraft(); } },
    audio: { deep: true, handler() { this.scheduleDraft(); } },
    selectedEntry() { this.scheduleDraft(); },
  },
  async onLoad(options = {}) {
    if (!requireAuth('record_recording', { page: 'record' })) return;
    this.capabilityAvailable = ensureCapability(CAPABILITIES.RECORDING, 'record');
    if (!this.capabilityAvailable) return;
    this.ownerScope = draftOwner();
    await this.loadDialects();
    if (options.draft_id) {
      try {
        const draft = await restoreRecordingDraft(options.draft_id, this.ownerScope);
        this.draftId = draft.id;
        this.form = { ...this.form, ...draft.form };
        this.audio = draft.audio || emptyAudio();
        if (!this.audio.path) this.draftMessage = '文字已恢复，音频不可用，请重新选择或录制';
        if (draft.entryId) await this.loadEntry(draft.entryId);
      } catch (error) { notify({ title: error.message }); }
    } else if (options.entry_id) await this.loadEntry(options.entry_id);
    else {
      const [latestDraft] = listRecordingDrafts(this.ownerScope)
        .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
      if (latestDraft) {
        const restore = await confirm({
          title: '发现未完成草稿',
          content: '是否恢复最近一次未完成的录音？选择取消后可选择放弃或稍后处理。',
          confirmText: '恢复草稿',
          cancelText: '稍后处理',
        });
        if (restore) await this.restoreDraft(latestDraft.id);
        else if (await confirm({
          title: '放弃这份草稿？',
          content: '放弃后将删除这份草稿及其临时音频，文字也无法恢复。',
          confirmText: '放弃草稿',
          cancelText: '保留草稿',
          danger: true,
        })) {
          await deleteRecordingDraft(latestDraft.id, this.ownerScope);
        }
      }
    }
    this.savedDraftSignature = this.draftSignature();
    this.draftReady = true;
  },
  onShow() {
    if (!this.draftReady || draftOwner() === this.ownerScope) return;
    clearTimeout(this.draftTimer);
    this.draftReady = false;
    releaseDraftAudioUrl(this.audio);
    this.audio = emptyAudio();
    this.form = Object.fromEntries(Object.keys(this.form).map((key) => [key, '']));
    this.selectedEntry = null;
    this.draftId = '';
    this.draftMessage = '账号已切换，请重新打开录音页';
    this.goRecordingDrafts();
  },
  onHide() { this.persistDirtyDraft(); },
  onUnload() {
    clearTimeout(this.draftTimer);
    this.persistDirtyDraft().finally(() => { releaseDraftAudioUrl(this.audio); });
  },
  methods: {
    async restoreDraft(id) {
      try {
        const draft = await restoreRecordingDraft(id, this.ownerScope);
        this.draftId = draft.id;
        this.form = { ...this.form, ...draft.form };
        this.audio = draft.audio || emptyAudio();
        if (!this.audio.path || draft.audioInvalid) {
          this.draftMessage = '文字已恢复，音频不可用，请重新选择或录制';
        }
        if (draft.entryId) await this.loadEntry(draft.entryId);
      } catch (error) { notify({ title: error.message }); }
    },
    async goRecordingDrafts() {
      await this.persistDirtyDraft();
      goRecordingDrafts();
    },
    draftSignature() {
      return JSON.stringify([this.form, this.audio.path, this.selectedEntry?.id || null]);
    },
    scheduleDraft() {
      clearTimeout(this.draftTimer);
      if (!this.draftReady || this.submitted || this.submitting) return;
      this.draftTimer = setTimeout(() => { this.persistDirtyDraft(); }, 700);
    },
    async persistDirtyDraft() {
      clearTimeout(this.draftTimer);
      if (!this.draftReady || this.submitted || this.submitting
        || this.savedDraftSignature === this.draftSignature()) return;
      const hasText = Object.entries(this.form).some(([key, value]) => (
        !['usage_dialect_id', 'recording_type'].includes(key) && String(value || '').trim()
      ));
      if (!this.draftId && !this.audio.path && !hasText) return;
      await this.saveDraft({ silent: true });
    },
    saveDraft(options = {}) {
      const pending = (this.draftSavePromise || Promise.resolve()).catch(() => {})
        .then(() => this.performSaveDraft(options));
      this.draftSavePromise = pending;
      return pending;
    },
    async performSaveDraft({ silent = false } = {}) {
      if (this.submitted) return;
      if (draftOwner() !== this.ownerScope) { notify({ title: '账号已切换，请重新打开录音页' }); return; }
      this.savingDraft = true;
      const signature = this.draftSignature();
      const audioPath = this.audio.path;
      try {
        const draft = await saveRecordingDraft({
          id: this.draftId,
          form: { ...this.form },
          audio: { ...this.audio },
          entryId: this.selectedEntry?.id,
        }, this.ownerScope);
        if (draftOwner() !== this.ownerScope) return;
        const unchanged = signature === this.draftSignature();
        this.draftId = draft.id;
        if (draft.audio && this.audio.path === audioPath) {
          this.audio = { ...this.audio, ...draft.audio, path: draft.audio.path || this.audio.path };
        }
        if (unchanged && !draft.audioError) {
          this.savedDraftSignature = this.draftSignature();
        }
        if (draft.audioError) this.draftMessage = '仅文字已保存，音频保存失败，请保留本页重试';
        else this.draftMessage = unchanged ? '草稿已保存，可稍后继续' : '上一版已保存，新修改仍待保存';
        if (!silent || draft.audioError) notify({ title: this.draftMessage });
      } catch (error) {
        if (error.persistedAudio && this.audio.path === audioPath) {
          this.audio = { ...this.audio, ...error.persistedAudio };
        }
        this.draftMessage = error.message;
        notify({ title: error.message });
      } finally { this.savingDraft = false; }
    },
    dialectLabel,
    entryTitle,
    async loadDialects() {
      try {
        this.dialects = await listAllDialects();
        if (this.primaryDialect?.id) this.form.usage_dialect_id = this.primaryDialect.id;
      } catch (error) {
        this.dialects = [];
      }
    },
    async loadEntry(id) {
      try {
        this.selectedEntry = await getEntry(id);
        this.optionalSections = ['optional'];
      } catch (error) {
        notify({ title: '原词条暂时无法读取', icon: 'none' });
      }
    },
    onAudioChange(audio) {
      this.audio = { ...emptyAudio(), ...audio };
      this.clearFieldError('audio_url');
    },
    clearAudio() {
      this.audio = emptyAudio();
    },
    onAudioError(error) {
      notify({ title: error?.message || error?.errMsg || '录音失败，请重试', icon: 'none' });
    },
    onDialectChange(context = {}) {
      this.form.usage_dialect_id = context.value || '';
      this.clearFieldError('usage_dialect_id');
    },
    clearFieldError(field) {
      if (this.fieldErrors[field]) delete this.fieldErrors[field];
    },
    async searchEntries() {
      const keyword = String(this.entryKeyword || '').trim();
      if (!keyword) {
        notify({ title: '先输入写法或大意', icon: 'none' });
        return;
      }
      this.entrySearching = true;
      try {
        const response = await listEntries({ search: keyword, page_size: 6 });
        this.entryCandidates = pageResults(response);
      } catch (error) {
        notify({ title: '词条查找失败', icon: 'none' });
      } finally {
        this.entrySearching = false;
      }
    },
    selectEntry(entry) {
      this.selectedEntry = entry;
      this.entryCandidates = [];
    },
    clearEntry() {
      this.selectedEntry = null;
      this.entryCandidates = [];
    },
    async validateForm() {
      const baseValid = await this.$refs.form.validate();
      const errors = {};
      if (!this.audio.path || this.audio.invalid) errors.audio_url = '请先录音或选择一段音频';
      if (!this.form.usage_dialect_id) errors.usage_dialect_id = '请选择这段话的使用地区';
      if (!String(this.form.original_gloss || '').trim()) {
        errors.original_gloss = '请用自己的话简单说明意思';
      }
      this.fieldErrors = errors;
      if (baseValid !== true || Object.keys(errors).length) {
        notify({ title: '还差几项必要信息', icon: 'none' });
        return false;
      }
      return true;
    },
    async submit() {
      if (this.submitting || this.savingDraft || !await this.validateForm()) return;
      if (draftOwner() !== this.ownerScope) { notify({ title: '账号已切换，请重新打开录音页' }); return; }
      this.submitting = true;
      clearTimeout(this.draftTimer);
      await this.saveDraft({ silent: true });
      try {
        const uploaded = await uploadFile(this.audio.path);
        if (draftOwner() !== this.ownerScope) throw new Error('账号已切换，请重新打开录音页');
        const payload = {
          audio_url: uploaded.url,
          usage_dialect_id: Number(this.form.usage_dialect_id),
          recording_type: this.form.recording_type || 'word',
          original_gloss: String(this.form.original_gloss).trim(),
          duration_ms: Number(uploaded.duration_ms ?? this.audio.durationMs ?? 0),
          rights_statement: String(this.form.rights_statement || '').trim(),
          original_writing: String(this.form.original_writing || '').trim(),
          original_pronunciation: String(this.form.original_pronunciation || '').trim(),
          citation: String(this.form.citation || '').trim(),
        };
        if (this.selectedEntry?.id) payload.primary_entry_id = this.selectedEntry.id;
        const recording = await createRecording(payload);
        trackProductEvent(PRODUCT_EVENTS.RECORDING_SUBMIT, {
          surface: 'record',
          result: 'success',
          metadata: { has_linked_entry: Boolean(this.selectedEntry?.id) },
        });
        this.submitted = true;
        clearTimeout(this.draftTimer);
        notifySuccess('乡音已保存为可追溯初稿');
        if (this.draftId) {
          try { await deleteRecordingDraft(this.draftId, this.ownerScope); } catch (error) { notify({ title: '乡音已提交，请手动清理旧草稿' }); }
        }
        goRecordingDetail(recording.id, { replace: true });
      } catch (error) {
        trackProductEvent(PRODUCT_EVENTS.RECORDING_SUBMIT, {
          surface: 'record',
          result: 'error',
          metadata: { has_linked_entry: Boolean(this.selectedEntry?.id) },
        });
        this.fieldErrors = {
          ...this.fieldErrors,
          ...(error?.data || {}),
        };
        await this.saveDraft();
        notify({ title: this.draftMessage || '保存失败，录音仍保留在本页', icon: 'none' });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.record-page,
.record-form,
.optional-fields {
  display: grid;
  gap: 24rpx;
}

.record-page__intro,
.record-submit,
.entry-linker {
  padding: 28rpx;
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  border: 1rpx solid var(--border-color);
}

.record-page__intro {
  display: grid;
  gap: 12rpx;
  background: var(--accent-subtle-color);
  border-color: transparent;
}

.record-page__intro-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.record-page__eyebrow,
.record-page__progress-copy {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 1rpx;
}

.record-page__title {
  font-size: 38rpx;
  font-weight: 800;
  line-height: 1.35;
}

.record-page__copy,
.record-section__help,
.record-submit__note,
.selected-entry__summary,
.entry-candidate__summary,
.entry-candidate__meta {
  color: var(--text-secondary-color);
  line-height: 1.6;
}

.record-progress {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid var(--border-color);
}

.record-progress__item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  min-width: 0;
  color: var(--muted-color);
}

.record-progress__index,
.record-section__index {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--muted-color);
  font-weight: 800;
}

.record-progress__index {
  width: 34rpx;
  height: 34rpx;
  font-size: 20rpx;
}

.record-progress__label {
  min-width: 0;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.record-progress__item--current {
  color: var(--text-color);
}

.record-progress__item--current .record-progress__index {
  background: var(--accent-color);
  color: var(--on-accent-color);
}

.record-progress__item--complete,
.record-progress__item--complete .record-progress__index {
  color: var(--accent-color);
}

.required-flow {
  overflow: hidden;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}

.record-section {
  display: grid;
  gap: 18rpx;
  padding: 28rpx;
}

.record-section + .record-section {
  border-top: 1rpx solid var(--border-color);
}

.record-section--standalone {
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}

.record-section__heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14rpx;
}

.record-section__index {
  width: 46rpx;
  height: 46rpx;
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
}

.record-section--complete .record-section__index {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.record-section__heading-copy {
  display: grid;
  gap: 2rpx;
  min-width: 0;
}

.record-section__capture {
  --accent-color: var(--immersive-bg-strong-color);
  --on-accent-color: var(--on-immersive-color);
}

.record-section__capture :deep(.record-primary) {
  --surface-color: var(--on-immersive-color);
  --accent-color: var(--immersive-bg-strong-color);
  --text-color: var(--immersive-bg-strong-color);
}

.record-section__title,
.entry-linker__heading,
.selected-entry__title,
.entry-candidate__title {
  font-weight: 800;
}

.record-section__caption {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  line-height: 1.45;
}

.record-section__state {
  padding: 5rpx 12rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: 20rpx;
  font-weight: 700;
  white-space: nowrap;
}

.record-section__state--complete {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.field-error {
  color: var(--danger-color);
  font-size: 23rpx;
}

.record-optional {
  overflow: hidden;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}

.entry-linker,
.record-submit {
  display: grid;
  gap: 18rpx;
}

.record-submit {
  border-color: var(--accent-subtle-color);
}

.record-submit__title {
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.record-submit__status {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.record-submit__status--ready {
  color: var(--success-color);
}

.selected-entry {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18rpx;
}

.entry-candidate {
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  border: 1rpx solid var(--border-color);
}

.entry-candidate__summary,
.entry-candidate__meta {
  margin-top: 8rpx;
  font-size: 23rpx;
}
</style>
