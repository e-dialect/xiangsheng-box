<template>
  <PageShell title="来源与整理记录">
    <view class="review-layout">
      <view class="review-card">
        <BaseLoading
          v-if="loading"
          text="正在读取词条…"
        />
        <EmptyState
          v-else-if="entryError"
          :title="entryError"
          action-text="重试"
          @action="load"
        />
        <template v-else-if="entry">
          <view class="eyebrow">
            词条 · {{ statusLabel }}
          </view>
          <view class="review-title">
            {{ entryTitle(entry) }}
          </view>
          <view>{{ entry.summary }}</view>
          <view class="muted">
            当前地区：{{ dialectBreadcrumb(entry.usage_dialect) }}
          </view>
          <BaseButton
            variant="ghost"
            text="返回词条"
            @click="openEntry"
          />
        </template>
      </view>

      <view class="review-card">
        <view class="review-title">
          来源与依据
        </view>
        <view class="muted">
          以下资料关联当前词条。提交来源不等于事实已证实。
        </view>
        <BaseLoading
          v-if="evidenceLoading"
          text="正在读取来源…"
        />
        <EmptyState
          v-if="evidenceError"
          :title="evidenceError"
          action-text="重试来源"
          @action="loadEvidence(evidenceRetryPage)"
        />
        <EvidenceSource
          v-for="source in evidence"
          :key="source.id"
          :source="source"
        >
          <BaseButton
            size="small"
            :variant="selectedEvidence.includes(source.id) ? 'primary' : 'ghost'"
            :text="selectedEvidence.includes(source.id) ? '已选为依据' : '选为范围修正依据'"
            :disabled="busy || evidenceLoading"
            @click="toggleEvidence(source.id)"
          />
        </EvidenceSource>
        <EmptyState
          v-if="!evidenceLoading && !evidenceError && !evidence.length"
          title="当前没有可见证据"
          description="需要先补充关联材料，才能提交范围修正。"
        />
        <BaseButton
          v-if="evidenceNext"
          variant="ghost"
          text="加载更多来源"
          :disabled="busy || evidenceLoading"
          @click="loadEvidence(evidencePage + 1)"
        />
      </view>

      <view
        v-if="entry"
        class="review-card"
      >
        <view class="eyebrow">
          依据资料修正适用范围
        </view>
        <view class="review-title">
          缩小地区范围
        </view>
        <view class="muted">
          仅缩小到当前地区的严格后代；授权与证据引用由服务器再次检查。
        </view>
        <BaseLoading
          v-if="contextLoading"
          text="正在核对地区与权限…"
        />
        <view
          v-if="disabledReason"
          class="muted"
          role="status"
        >
          {{ disabledReason }}
        </view>
        <BaseButton
          v-if="contextError"
          variant="ghost"
          text="重试地区与权限"
          @click="loadContext"
        />
        <BaseForm
          ref="form"
          :data="form"
          :rules="rules"
        >
          <view>当前地区：{{ dialectBreadcrumb(entry.usage_dialect) }}</view>
          <BaseButton
            variant="ghost"
            :text="targetLabel"
            :disabled="busy || !!disabledReason"
            @click="selectorOpen = true"
          />
          <view class="muted">
            已选 {{ selectedEvidence.length }} 条依据（可跨来源分页选择）。
          </view>
          <BaseField
            v-model="form.reason"
            name="reason"
            type="textarea"
            label="修正理由"
            required
            :maxlength="2000"
            :disabled="busy"
            placeholder="说明依据及仍有的不确定性，4–2000 字"
          />
          <view
            v-if="submitError"
            class="notice"
            role="alert"
          >
            {{ submitError }}
          </view>
          <BaseButton
            v-if="unknownResult"
            variant="ghost"
            text="刷新词条与历史，核查提交结果"
            :disabled="busy || historyLoading || loading"
            @click="reconcile"
          />
          <BaseButton
            text="核对并提交范围修正"
            :loading="busy"
            :disabled="!canSubmit"
            @click="submit"
          />
        </BaseForm>
        <DialectSelector
          :visible="selectorOpen"
          :value="form.dialectId"
          :dialects="descendants"
          :owner-scope="ownerId"
          title="选择严格后代地区"
          @change="selectDialect"
          @close="selectorOpen = false"
        />
      </view>

      <view class="review-card">
        <view class="review-title">
          整理记录
        </view>
        <view class="muted">
          仅显示当前账号获准读取的记录；空列表不代表从未发生操作。
        </view>
        <BaseLoading
          v-if="historyLoading"
          text="正在读取整理记录…"
        />
        <EmptyState
          v-if="historyError"
          :title="historyError"
          action-text="重试历史"
          @action="loadHistory(historyRetryPage)"
        />
        <view
          v-for="action in history"
          :key="action.id"
          class="history-row"
        >
          <view class="eyebrow">
            {{ actionLabel(action.action_type) }}
          </view>
          <view class="muted">
            {{ action.created_at || '时间未提供' }} · 整理员 #{{ action.actor?.id || '未提供' }}
          </view>
          <view class="history-reason">
            {{ action.reason || '理由未提供' }}
          </view>
          <BaseButton
            size="small"
            variant="ghost"
            text="查看决定与依据"
            @click="openAction(action.id)"
          />
        </view>
        <EmptyState
          v-if="!historyLoading && !historyError && !history.length"
          title="没有可见的整理记录"
        />
        <BaseButton
          v-if="historyNext"
          variant="ghost"
          text="加载更多整理记录"
          :disabled="historyLoading"
          @click="loadHistory(historyPage + 1)"
        />
      </view>
    </view>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import EvidenceSource from '@/components/EvidenceSource.vue';
import {
  getEntry, entryTitle, getCurationSummary, pageResults,
} from '@/services/entryRecording';
import { listAllDialects } from '@/services/guantou';
import { dialectBreadcrumb } from '@/utils/dialectTree';
import { confirm, cancelConfirmation } from '@/services/feedback';
import { openPage, ROUTES } from '@/services/navigation';
import {
  listEntryEvidence, listEntryActions, strictDescendants, canNarrow, narrowPayload, getReviewStaff,
  submitNarrowScope, reviewError, actionLabel, reviewSession, evidenceSummary,
} from '@/services/curationReview';

function initialState() {
  return {
    entry: null,
    loading: false,
    entryError: '',
    evidence: [],
    evidencePage: 1,
    evidenceRetryPage: 1,
    evidenceNext: false,
    evidenceLoading: false,
    evidenceError: '',
    history: [],
    historyPage: 1,
    historyRetryPage: 1,
    historyNext: false,
    historyLoading: false,
    historyError: '',
    summary: null,
    dialects: [],
    contextLoading: false,
    contextError: '',
    selectedEvidence: [],
    form: { reason: '', dialectId: null },
    selectorOpen: false,
    busy: false,
    submitError: '',
    unknownResult: false,
  };
}

export default {
  components: {
    BaseButton,
    BaseForm,
    BaseField,
    BaseLoading,
    EmptyState,
    PageShell,
    DialectSelector,
    EvidenceSource,
  },
  mixins: [reviewSession],
  data() {
    return {
      id: null,
      ownerId: '',
      ...initialState(),
      rules: {
        reason: [
          { required: true, message: '请填写修正理由' },
          { min: 4, max: 2000, message: '理由需要 4–2000 字' },
        ],
      },
    };
  },
  computed: {
    statusLabel() {
      return ({
        draft: '初稿', reviewed: '已整理', disputed: '有分歧', redirected: '已合并跳转',
      })[
        this.entry?.status
      ] || '待整理';
    },
    canSubmit() {
      return !this.busy && !this.evidenceLoading && !this.unknownResult && !this.disabledReason
        && Boolean(this.target) && this.selectedEvidence.length > 0;
    },
    descendants() { return strictDescendants(this.dialects, this.entry?.usage_dialect?.id); },
    target() { return this.descendants.find((item) => item.id === this.form.dialectId); },
    targetLabel() {
      return this.target ? `目标：${dialectBreadcrumb(this.target, this.dialects)}` : '选择更细地区';
    },
    disabledReason() {
      if (this.contextLoading) return '正在核对地区与权限';
      if (this.contextError) return this.contextError;
      if (!this.entry?.usage_dialect?.id) return '当前词条没有地区，无法缩小范围';
      if (!this.descendants.length) return '当前地区没有可选的后代节点';
      if (!canNarrow(this.summary, this.entry.usage_dialect, this.dialects)) return '未取得覆盖原地区的有效地区整理授权，无法提交';
      return '';
    },
  },
  onLoad(options = {}) { this.id = Number(options.entry_id) || null; },
  onShow() { this.clearReview(); this.ownerId = uni.getStorageSync('id') || 'guest'; this.load(); },
  methods: {
    entryTitle,
    dialectBreadcrumb,
    actionLabel,
    resetReview() { cancelConfirmation(this); Object.assign(this, initialState()); },
    sessionChanged() {
      this.ownerId = uni.getStorageSync('id') || 'guest';
      this.entryError = '账号已变更，请重新加载';
    },
    openEntry() { openPage(ROUTES.entryDetail, { id: this.id }); },
    openAction(id) { openPage(ROUTES.curationActionDetail, { id, entry_id: this.id }); },
    selectDialect({ value }) { if (!this.busy) this.form.dialectId = value; },
    toggleEvidence(id) {
      if (this.busy || this.evidenceLoading) return;
      this.selectedEvidence = this.selectedEvidence.includes(id)
        ? this.selectedEvidence.filter((value) => value !== id) : [...this.selectedEvidence, id];
    },
    async loadEntry() {
      const valid = this.reviewGuard();
      this.loading = true; this.entryError = '';
      try {
        const result = await getEntry(this.id);
        if (valid()) this.entry = result;
      } catch (error) {
        if (valid()) { this.entry = null; this.entryError = reviewError(error); }
      } finally { if (valid()) this.loading = false; }
    },
    async load() {
      this.ownerId = uni.getStorageSync('id') || 'guest';
      if (!this.id) { this.entryError = '缺少有效词条链接'; return; }
      await Promise.allSettled([
        this.loadEntry(), this.loadEvidence(1), this.loadHistory(1), this.loadContext(),
      ]);
    },
    async loadContext() {
      const valid = this.reviewGuard();
      this.contextLoading = true; this.contextError = ''; this.summary = null;
      const results = await Promise.allSettled([
        listAllDialects(), getCurationSummary(), getReviewStaff(),
      ]);
      if (!valid()) return;
      if (results[0].status === 'fulfilled') this.dialects = results[0].value;
      else this.contextError = `地区加载失败：${reviewError(results[0].reason)}`;
      if (results[1].status === 'fulfilled') {
        this.summary = {
          ...results[1].value,
          is_staff: results[2].status === 'fulfilled' && results[2].value === true,
        };
        if (results[2].status === 'rejected' && !this.summary.grants?.length) {
          this.contextError = this.contextError || `无法核对站点审核权限：${reviewError(results[2].reason)}`;
        }
      } else this.contextError = this.contextError || reviewError(results[1].reason);
      this.contextLoading = false;
    },
    async loadEvidence(page) {
      if (this.busy || this.evidenceLoading) return;
      if (page === 1 && this.selectedEvidence.length) {
        this.selectedEvidence = [];
        this.submitError = '来源已重新加载，请重新选择依据';
      }
      const valid = this.reviewGuard();
      this.evidenceLoading = true; this.evidenceError = '';
      this.evidenceRetryPage = page;
      try {
        const response = await listEntryEvidence(this.id, page);
        if (!valid()) return;
        this.evidence = page === 1 ? pageResults(response)
          : [...this.evidence, ...pageResults(response)];
        this.evidenceNext = Boolean(response.next); this.evidencePage = page;
      } catch (error) {
        if (valid()) {
          this.evidenceError = reviewError(error);
          if ([401, 403, 404].includes(error.statusCode)) {
            this.evidence = []; this.selectedEvidence = []; this.evidenceNext = false;
          }
        }
      } finally { if (valid()) this.evidenceLoading = false; }
    },
    async loadHistory(page) {
      if (this.historyLoading) return;
      const valid = this.reviewGuard();
      this.historyLoading = true; this.historyError = '';
      this.historyRetryPage = page;
      try {
        const response = await listEntryActions(this.id, page);
        if (!valid()) return;
        this.history = page === 1 ? pageResults(response)
          : [...this.history, ...pageResults(response)];
        this.historyNext = Boolean(response.next); this.historyPage = page;
      } catch (error) {
        if (valid()) {
          this.historyError = reviewError(error);
          if ([401, 403, 404].includes(error.statusCode)) {
            this.history = []; this.historyNext = false;
          }
        }
      } finally { if (valid()) this.historyLoading = false; }
    },
    async reconcile() {
      if (this.busy || this.historyLoading || this.loading) return;
      this.busy = true;
      const valid = this.reviewGuard();
      await Promise.allSettled([this.loadEntry(), this.loadHistory(1)]);
      if (!valid()) return;
      this.busy = false;
      if (!this.entryError && !this.historyError) {
        this.unknownResult = false;
        this.submitError = '请检查最新地区和历史中是否已有本次操作，再决定是否继续。';
      }
    },
    async submit() {
      if (this.busy || this.evidenceLoading || this.unknownResult || this.disabledReason
        || !this.target || !this.selectedEvidence.length) return;
      this.busy = true; this.submitError = '';
      const valid = this.reviewGuard();
      const { reason } = this.form;
      const payload = narrowPayload(this.id, this.target.id, this.selectedEvidence, reason);
      const original = this.entry.usage_dialect.id;
      let posted = false;
      try {
        const checked = await this.$refs.form.validate();
        if (!valid() || checked !== true) return;
        if (payload.reason.length < 4 || payload.reason.length > 2000) {
          this.submitError = '理由需要 4–2000 字'; return;
        }
        const sources = payload.evidence_ids.map((id) => (
          this.evidence.find((item) => Number(item.id) === id)
        ));
        if (sources.some((item) => !item)) {
          this.submitError = '所选依据已不在当前来源中，请重新加载并选择';
          return;
        }
        const citation = sources.map(evidenceSummary).join('\n');
        const change = `${dialectBreadcrumb(this.entry.usage_dialect)} → ${dialectBreadcrumb(this.target, this.dialects)}`;
        const accepted = await confirm({
          owner: this,
          title: '确认缩小地区范围',
          content: `${change}\n依据：${citation}\n理由：${payload.reason}`,
        });
        if (!valid() || !accepted) return;
        const latest = await getEntry(this.id);
        if (!valid()) return;
        if (latest.usage_dialect?.id !== original || latest.status !== this.entry.status) {
          this.entry = latest;
          this.submitError = '词条已被修改，请重新核对最新地区、证据和理由';
          return;
        }
        posted = true;
        const action = await submitNarrowScope(payload);
        if (!valid()) return;
        if (!action?.id) {
          this.unknownResult = true;
          this.submitError = '未取得动作链接，结果未知，请先核查历史';
          return;
        }
        await Promise.allSettled([this.loadEntry(), this.loadHistory(1)]);
        if (valid()) this.openAction(action.id);
      } catch (error) {
        if (!valid()) return;
        this.unknownResult = posted && (!error.statusCode || error.statusCode >= 500);
        this.submitError = this.unknownResult ? '提交结果未知，请先刷新词条与历史核查；不会自动重发。' : reviewError(error);
        if (posted && !this.unknownResult) await this.loadEntry();
      } finally { if (valid()) this.busy = false; }
    },
  },
};
</script>

<style scoped>
.review-layout {
  display: grid;
  gap: var(--space-3);
  max-width: 960px;
  margin: 0 auto;

}
.review-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  overflow-wrap: anywhere;

}
.review-title {
  font-size: var(--font-size-xl);
  font-weight: 800;
  color: var(--text-color);

}
.eyebrow {
  color: var(--accent-color);
  font-size: var(--font-size-sm);
  font-weight: 700;

}
.muted {
  color: var(--text-secondary-color);
  line-height: 1.7;

}
.notice {
  padding: var(--space-3);
  background: var(--accent-subtle-color);
  color: var(--text-color);
  border-radius: var(--radius-md);
  white-space: pre-wrap;

}
.history-row {
  display: grid;
  gap: var(--space-2);
  border-top: 1px solid var(--border-color);
  padding-top: var(--space-3);

}
.history-reason {
  white-space: pre-wrap;

}
</style>
