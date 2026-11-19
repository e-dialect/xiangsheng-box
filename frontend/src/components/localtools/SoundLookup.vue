<template>
  <view class="sound-lookup">
    <text>
      从这份资料的例字里按本调找字。请选择至少一项。
    </text>
    <view class="sound-lookup__controls">
      <BaseButton
        v-for="field in fields"
        :key="field.key"
        size="small"
        variant="ghost"
        :text="`${field.label} · ${selectedLabel(field)}`"
        @click="openPicker(field)"
      />
      <BaseButton
        v-if="hasSelection"
        size="small"
        variant="ghost"
        text="清空条件"
        @click="selection = {}"
      />
    </view>

    <t-picker
      :visible="pickerVisible"
      :value="[selection[activeField?.key] || '']"
      :title="activeField ? `选择${activeField.label}` : ''"
      @confirm="choose"
      @close="pickerVisible = false"
    >
      <t-picker-item :options="activeField?.options || []" />
    </t-picker>

    <view
      v-if="hasSelection"
      aria-live="polite"
    >
      <EmptyState
        v-if="!results.length"
        title="这份资料里没有符合条件的例字"
        description="可以放宽一项条件，或清空后重新选择。"
        action-text="清空条件"
        @action="selection = {}"
      />
      <view v-else>
        <text class="sound-lookup__count">
          找到 {{ results.length }} 条字音
        </text>
        <view
          v-for="(row, index) in results"
          :key="index"
          class="sound-lookup__row"
        >
          <view class="sound-lookup__reading">
            <text class="sound-lookup__character">
              {{ row.character }}
            </text>
            <text>{{ row.form }}</text>
          </view>
          <view class="sound-lookup__controls">
            <BaseButton
              v-if="row.entry_id"
              size="small"
              variant="ghost"
              text="查看关联词条"
              @click="goEntryDetail(row.entry_id)"
            />
            <BaseButton
              v-else
              size="small"
              variant="ghost"
              text="按字查词"
              @click="searchByCharacter(row.character)"
            />
            <BaseButton
              v-if="row.recording_id"
              size="small"
              variant="ghost"
              text="听关联录音"
              @click="goRecordingDetail(row.recording_id)"
            />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import TPicker from '@tdesign/uniapp/picker/picker.vue';
import TPickerItem from '@tdesign/uniapp/picker-item/picker-item.vue';
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import {
  goEntryDetail, goRecordingDetail, openPage, ROUTES,
} from '@/services/navigation';

const FIELDS = [
  { key: 'initial', label: '声母' },
  { key: 'final', label: '韵母' },
  { key: 'tone', label: '声调' },
];

export default {
  components: {
    BaseButton, EmptyState, TPicker, TPickerItem,
  },
  props: {
    rows: { type: Array, required: true },
    dialect: { type: String, required: true },
  },
  data() {
    return { activeField: null, pickerVisible: false, selection: {} };
  },
  computed: {
    fields() {
      return FIELDS.map((field) => {
        const values = [...new Set(this.rows.map((row) => row[field.key]))].sort();
        return {
          ...field,
          options: [
            { label: '不限', value: '' },
            ...values.map((value) => ({ label: value || '零声母', value: `:${value}` })),
          ],
        };
      });
    },
    hasSelection() {
      return FIELDS.some(({ key }) => this.selection[key]);
    },
    results() {
      return this.rows.filter((row) => FIELDS.every(({ key }) => (
        !this.selection[key] || this.selection[key] === `:${row[key]}`
      )));
    },
  },
  methods: {
    goEntryDetail,
    goRecordingDetail,
    openPicker(field) {
      this.activeField = field;
      this.pickerVisible = true;
    },
    selectedLabel(field) {
      return field.options.find(({ value }) => value === this.selection[field.key])?.label || '不限';
    },
    choose({ value }) {
      if (!this.activeField) return;
      const [chosen] = value;
      this.selection[this.activeField.key] = chosen;
    },
    searchByCharacter(character) {
      openPage(ROUTES.search, { keywords: character, dialect: this.dialect });
    },
  },
};
</script>

<style scoped>
.sound-lookup {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.sound-lookup__controls,
.sound-lookup__reading,
.sound-lookup__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.sound-lookup__count {
  font-weight: 600;
}

.sound-lookup__row {
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-color);
}

.sound-lookup__character {
  font-size: var(--font-size-lg);
  font-weight: 700;
}
</style>
