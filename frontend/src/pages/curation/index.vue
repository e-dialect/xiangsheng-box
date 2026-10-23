<template>
  <PageShell title="整理工作台">
    <view class="workbench-intro">
      <view class="eyebrow">
        按授权范围核对
      </view>
      <view class="intro-title">
        每个结论，都要说清依据
      </view>
      <view class="intro-copy">
        先核对资料和地区，再选择处理结果。你的判断与理由会一起写入整理记录。
      </view>
      <view
        v-if="scopeLabels.length"
        class="scope-list"
        aria-label="当前授权范围"
      >
        <view
          v-for="scope in scopeLabels"
          :key="scope"
          class="scope-chip"
        >
          <view
            class="scope-mark"
            aria-hidden="true"
          />
          <text>{{ scope }}</text>
        </view>
      </view>
    </view>

    <BaseLoading
      v-if="loading"
      text="正在整理你的待办…"
    />
    <EmptyState
      v-else-if="error"
      title="工作台暂时没有加载出来"
      :description="error"
      action-text="重新加载"
      @action="load"
    />
    <EmptyState
      v-else-if="!tasks.length"
      title="当前范围已经整理完了"
      description="新的待考写法、地区读音和竞争解释出现后，会按你的授权范围进入这里。"
    />
    <view
      v-else
      class="worklist"
    >
      <view class="section-heading">
        <view>
          <view class="section-kicker">
            待办清单
          </view>
          <view class="section-title">
            逐项核对，再留下判断
          </view>
        </view>
        <view
          class="queue-count"
          :aria-label="`${tasks.length} 项待办`"
        >
          {{ tasks.length }} 项
        </view>
      </view>

      <view
        v-for="task in tasks"
        :key="taskKey(task)"
        :class="['task-card', 'task', { selected: selectedKey === taskKey(task) }]"
      >
        <view class="task-head">
          <view class="task-head-main">
            <view class="task-kind">
              {{ kindLabel(task.kind) }}
            </view>
            <view class="task-title">
              {{ task.title }}
            </view>
          </view>
          <DialectLabel
            v-if="task.dialect"
            :dialect="task.dialect"
            mode="card"
          />
        </view>
        <view class="task-summary">
          {{ task.summary }}
        </view>
        <BaseButton
          v-if="task.target_type === 'entry' || task.target_type === 'recording'"
          size="small"
          variant="ghost"
          text="查看材料与详情"
          @click="openMaterial(task)"
        />

        <view class="decision-label">
          选择处理结果
        </view>
        <view class="task-actions">
          <BaseButton
            v-for="action in task.actions"
            :key="action"
            size="small"
            :variant="actionVariant(task, action)"
            :disabled="submittingKey !== ''"
            :aria-label="`${kindLabel(task.kind)}：${actionLabel(action)}`"
            :text="actionLabel(action)"
            @click="choose(task, action)"
          />
        </view>

        <view
          v-if="selectedKey === taskKey(task)"
          class="decision-panel"
          aria-live="polite"
        >
          <view class="decision-eyebrow">
            准备记录这项判断
          </view>
          <view class="decision-title">
            {{ actionLabel(selectedAction) }}
          </view>
          <view class="decision-copy">
            {{ actionDescription(selectedAction) }}
          </view>
          <BaseField
            v-model="reason"
            :name="`reason-${task.kind}-${task.id}`"
            type="textarea"
            label="判断依据"
            required
            :maxlength="500"
            placeholder="写下可复核的资料、地区经验或保留意见，至少 4 个字"
            :error="reasonError"
            @change="reasonError = ''"
          />
          <view class="confirm-row">
            <BaseButton
              size="small"
              variant="ghost"
              :disabled="submittingKey !== ''"
              text="暂不处理"
              @click="cancel"
            />
            <BaseButton
              size="small"
              :variant="selectedAction === 'rejected' ? 'danger' : 'primary'"
              :loading="submittingKey === `${taskKey(task)}-${selectedAction}`"
              :disabled="submittingKey !== ''"
              :text="`确认${actionLabel(selectedAction)}`"
              @click="submit(task)"
            />
          </view>
        </view>
      </view>
    </view>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import DialectLabel from '@/components/DialectLabel.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import { CAPABILITIES, ensureCapability } from '@/services/capabilities';
import {
  createCurationAction,
  getCurationSummary,
  listCurationTasks,
  pageResults,
} from '@/services/entryRecording';
import { notify, notifySuccess } from '@/services/feedback';
import { openPage, ROUTES } from '@/services/navigation';
import { PRODUCT_EVENTS, trackProductEvent } from '@/services/productAnalytics';

const LABELS = {
  accepted: '采纳',
  published: '发布',
  reviewed: '核对通过',
  disputed: '保留争议',
  rejected: '退回',
};

const ACTION_DESCRIPTIONS = {
  accepted: '关联会进入可用状态，本次判断依据会保留在整理记录中。',
  published: '资料会进入公开可用状态，本次判断依据会保留在整理记录中。',
  reviewed: '资料会标记为已核对，本次判断依据会保留在整理记录中。',
  disputed: '资料会继续保留为争议状态，等待更多证据后再作结论。',
  rejected: '资料会退出当前公开流程；退回原因会保留，方便贡献者理解和补充。',
};

export default {
  components: {
    BaseButton, BaseField, BaseLoading, DialectLabel, EmptyState, PageShell,
  },
  data() {
    return {
      summary: null,
      tasks: [],
      loading: true,
      error: '',
      selectedKey: '',
      selectedAction: '',
      reason: '',
      reasonError: '',
      submittingKey: '',
    };
  },
  computed: {
    scopeLabels() {
      const labels = (this.summary?.grants || []).map((grant) => (
        grant.role === 'lexical_curator'
          ? '词条整理'
          : `地区整理 · ${grant.dialect?.name || '指定范围'}`
      ));
      if (!labels.length && this.summary) return ['站点审核范围'];
      return labels.filter((label, index) => labels.indexOf(label) === index);
    },
  },
  onLoad() { this.load(); },
  methods: {
    openMaterial(task) {
      if (task.target_type === 'entry') {
        openPage(ROUTES.entryReview, { entry_id: task.id });
      } else if (task.target_type === 'recording') {
        openPage(ROUTES.recordingDetail, { id: task.id });
      }
    },
    taskKey(task) { return `${task.kind}-${task.id}`; },
    kindLabel(kind) {
      return ({
        legacy_candidate: '旧库候选',
        entry: '词条',
        sense: '义项',
        recording: '录音',
        pronunciation: '地区读音',
        recording_link: '录音关联',
      })[kind] || '待整理资料';
    },
    actionLabel(action) { return LABELS[action] || action; },
    actionDescription(action) {
      return ACTION_DESCRIPTIONS[action] || '处理结果和判断依据会一起保留在整理记录中。';
    },
    actionVariant(task, action) {
      const selected = this.selectedKey === this.taskKey(task) && this.selectedAction === action;
      if (action === 'rejected') return selected ? 'danger' : 'danger-ghost';
      return selected ? 'primary' : 'ghost';
    },
    choose(task, action) {
      if (this.submittingKey) return;
      this.selectedKey = this.taskKey(task);
      this.selectedAction = action;
      this.reason = '';
      this.reasonError = '';
    },
    cancel() {
      if (this.submittingKey) return;
      this.selectedKey = '';
      this.selectedAction = '';
      this.reason = '';
      this.reasonError = '';
    },
    async load() {
      if (!ensureCapability(CAPABILITIES.CURATION_WORKBENCH, 'curation')) {
        this.loading = false;
        this.error = '整理工作台正在维护，请稍后再试';
        return;
      }
      this.loading = true;
      this.error = '';
      this.summary = null;
      this.tasks = [];
      try {
        const [summary, tasks] = await Promise.all([getCurationSummary(), listCurationTasks()]);
        this.summary = summary;
        this.tasks = pageResults(tasks);
      } catch (error) {
        this.error = error?.message || '请检查网络和整理权限后重试';
      } finally {
        this.loading = false;
      }
    },
    payloadFor(task) {
      if (task.target_type === 'legacy_candidate') {
        return {
          action_type: 'resolve_legacy',
          target_type: task.target_type,
          target_id: task.id,
          reason: this.reason.trim(),
          changes: { status: this.selectedAction },
        };
      }
      return {
        action_type: 'review',
        target_type: task.target_type,
        target_id: task.id,
        reason: this.reason.trim(),
        changes: { status: this.selectedAction },
      };
    },
    async submit(task) {
      if (this.reason.trim().length < 4) {
        this.reasonError = '请写下至少 4 个字的判断依据';
        return;
      }
      this.submittingKey = `${this.taskKey(task)}-${this.selectedAction}`;
      try {
        await createCurationAction(this.payloadFor(task));
        trackProductEvent(PRODUCT_EVENTS.CURATION_TASK_COMPLETE, {
          surface: 'curation',
          result: 'success',
          metadata: { task_kind: task.kind },
        });
        notifySuccess('判断和依据已保存');
        this.submittingKey = '';
        this.cancel();
        await this.load();
      } catch (error) {
        trackProductEvent(PRODUCT_EVENTS.CURATION_TASK_COMPLETE, {
          surface: 'curation',
          result: 'error',
          metadata: { task_kind: task.kind },
        });
        notify({ title: error?.message || '判断保存失败' });
      } finally {
        this.submittingKey = '';
      }
    },
  },
};
</script>

<style scoped>
.workbench-intro {
  padding: var(--space-4);
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
}

.eyebrow,
.section-kicker,
.decision-eyebrow,
.decision-label,
.task-kind {
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

.intro-copy,
.task-summary,
.decision-copy {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
}

.intro-copy {
  margin-top: var(--space-1);
}

.scope-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-3);
}

.scope-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  background: var(--surface-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
}

.scope-mark {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: var(--accent-color);
}

.worklist {
  margin-top: var(--space-4);
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.section-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.queue-count {
  flex: 0 0 auto;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.task-card {
  margin-bottom: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.task-card.selected {
  border-color: var(--accent-color);
  box-shadow: inset 6rpx 0 0 var(--accent-color);
}

.task-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.task-head-main {
  min-width: 0;
  flex: 1;
}

.task-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
  overflow-wrap: anywhere;
}

.task-summary {
  margin-top: var(--space-2);
}

.decision-label {
  margin-top: var(--space-3);
  color: var(--muted-color);
  letter-spacing: 0;
}

.task-actions,
.confirm-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.decision-panel {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
}

.decision-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.decision-copy {
  margin-top: var(--space-1);
}

.decision-panel :deep(.base-field) {
  margin-top: var(--space-3);
}

.confirm-row {
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-color);
}

@media (prefers-reduced-motion: reduce) {
  .task-card {
    transition: none;
  }
}
</style>
