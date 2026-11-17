<template>
  <view class="kinship">
    <text class="kinship-note">
      适用同父同母的同胞和两名父母。已知配偶按子女的另一位父母处理。异父母同胞、继亲、义亲和再婚关系目前没有资料支持。
    </text>
    <text class="kinship-label">
      起点（我）的性别条件
    </text>
    <view class="kinship-buttons">
      <BaseButton
        v-for="option in sexOptions"
        :key="option.value"
        size="small"
        :variant="session.context.sex === option.value ? 'primary' : 'ghost'"
        :text="option.label"
        @click="chooseSex(option.value)"
      />
    </view>
    <text class="kinship-path">
      我{{ path ? ` → ${path}` : '' }}
    </text>
    <view class="kinship-buttons">
      <BaseButton
        v-for="relation in relations"
        :key="relation.key"
        size="small"
        variant="ghost"
        :text="relation.label"
        :disabled="!current"
        @click="update({type: 'advance', field: relation.key})"
      />
    </view>
    <view class="kinship-buttons">
      <BaseButton
        size="small"
        variant="ghost"
        text="撤销一步"
        :disabled="!session.history.length"
        @click="update({type: 'back'})"
      />
      <BaseButton
        size="small"
        variant="ghost"
        text="清空关系"
        :disabled="!session.path.length && !session.diagnostic"
        @click="update({type: 'clear'})"
      />
    </view>
    <text
      v-if="session.diagnostic"
      class="kinship-note"
      aria-live="polite"
    >
      {{ diagnostic }}
    </text>
    <view
      v-if="session.path.length && !current"
      class="kinship-results"
    >
      <text class="kinship-label">
        关系条件可对应多个人，请选择你指的人。
      </text>
      <BaseButton
        v-for="candidate in session.candidates"
        :key="candidate.candidateId"
        size="small"
        variant="ghost"
        :text="candidateLabel(candidate)"
        @click="update({type: 'choose', candidateId: candidate.candidateId})"
      />
    </view>
    <text
      v-if="session.hasUnlistedPossibilities || missingSex"
      class="kinship-note"
    >
      {{ missingSex ? '请先指定起点的性别条件再计算配偶关系；目前显示的是上一步。' : '现有资料可能漏掉其他亲属，候选范围不完整。' }}
    </text>
    <view
      v-if="session.path.length && current"
      class="kinship-results"
    >
      <text class="kinship-label">
        {{ current.label }}
      </text>
      <text v-if="!terms.length">
        已核对关系角色，暂缺可发布的地方称谓。
      </text>
      <view
        v-for="(term, index) in terms"
        :key="index"
        class="kinship-term"
      >
        <text class="kinship-label">
          {{ term.text }}
        </text>
        <text v-if="term.usage">
          {{ term.usage }}
        </text>
        <view
          v-if="term.entry_id || term.recording_id"
          class="kinship-buttons"
        >
          <BaseButton
            v-if="term.entry_id"
            size="small"
            variant="ghost"
            text="查看词条"
            @click="goEntryDetail(term.entry_id)"
          />
          <BaseButton
            v-if="term.recording_id"
            size="small"
            variant="ghost"
            text="听真人录音"
            @click="goRecordingDetail(term.recording_id)"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { markRaw } from 'vue';
import BaseButton from '@/components/BaseButton.vue';
import { goEntryDetail, goRecordingDetail } from '@/services/navigation';
import { createKinshipEngine } from '@/utils/localtools/kinshipEngine.mjs';

const RELATIONS = Object.freeze([
  { key: 'fa', label: '父亲' }, { key: 'mu', label: '母亲' },
  { key: 'xiong', label: '哥哥' }, { key: 'di', label: '弟弟' },
  { key: 'jie', label: '姐姐' }, { key: 'mei', label: '妹妹' },
  { key: 'fu', label: '丈夫' }, { key: 'qi', label: '妻子' },
  { key: 'zi', label: '儿子' }, { key: 'nv', label: '女儿' },
]);
const SEX_OPTIONS = Object.freeze([
  { value: 'unknown', label: '未指定' },
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
]);

export default {
  components: { BaseButton },
  props: {
    content: { type: Object, required: true },
    version: { type: String, required: true },
  },
  data() {
    const engine = markRaw(createKinshipEngine({
      ...this.content,
      datasetVersion: this.version,
    }, { maxDepth: 6 }));
    return {
      engine,
      session: engine.createSession(),
      relations: RELATIONS,
      sexOptions: SEX_OPTIONS,
      missingSex: false,
    };
  },
  computed: {
    current() {
      return this.engine.selected(this.session);
    },
    terms() {
      return this.content.nodes.find((node) => node.id === this.current.roleId)?.terms || [];
    },
    path() {
      return this.session.path.map(
        ({ field }) => this.relations.find((relation) => relation.key === field)?.label,
      ).join(' → ');
    },
    diagnostic() {
      return this.session.status === 'limit'
        ? '已达到六层关系的计算上限。'
        : '目前的资料与条件无法确定这一步，仍显示上一步。';
    },
  },
  methods: {
    goEntryDetail,
    goRecordingDetail,
    candidateLabel(candidate) {
      const known = this.session.history.findIndex(({ candidates, selectedCandidateId }) => (
        candidates.some((item) => item.candidateId === selectedCandidateId
          && item.personToken === candidate.personToken)
      ));
      if (known === 0) return `${candidate.label}（我）`;
      if (known > 0) return `${candidate.label}（第 ${known} 步的人）`;
      return `${candidate.label}（另一位）`;
    },
    chooseSex(sex) {
      if (this.session.context.sex !== sex) this.update({ type: 'setContext', context: { sex } });
    },
    update(action) {
      this.missingSex = action.type === 'advance'
        && this.current?.sex === 'unknown'
        && this.current.personToken === 'p0'
        && ['fu', 'qi'].includes(action.field);
      if (!this.missingSex) this.session = this.engine.reduce(this.session, action);
    },
  },
};
</script>

<style scoped>
.kinship,
.kinship-results,
.kinship-term {
  display: grid;
  gap: 10px;
  line-height: 1.6;
}
.kinship {
  margin-top: 16px;
}
.kinship-results {
  padding: 12px;
  border-radius: var(--radius-md);
  background-color: var(--accent-subtle-color);
  justify-items: start;
}
.kinship-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.kinship-label,
.kinship-path {
  font-weight: 700;
}
.kinship-note {
  color: var(--text-secondary-color);
  font-size: 14px;
}
</style>
