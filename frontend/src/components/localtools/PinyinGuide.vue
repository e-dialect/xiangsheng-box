<template>
  <view>
    <view
      v-for="(section, sectionIndex) in sections"
      :key="sectionIndex"
      class="guide-section"
    >
      <text class="guide-title">
        {{ section.title }}
      </text>
      <text
        v-if="section.text"
        class="guide-text"
      >
        {{ section.text }}
      </text>
      <view
        v-for="(row, index) in section.rows"
        :key="index"
        class="guide-row"
      >
        <text class="guide-form">
          {{ row.form }}
        </text>
        <text v-if="row.ipa">
          {{ row.ipa }}
        </text>
        <text v-if="row.example">
          {{ row.example }}
        </text>
        <view
          v-if="row.entry_id || row.recording_id"
          class="guide-actions"
        >
          <BaseButton
            v-if="row.entry_id"
            size="small"
            variant="ghost"
            text="查看词条"
            @click="goEntryDetail(row.entry_id)"
          />
          <BaseButton
            v-if="row.recording_id"
            size="small"
            variant="ghost"
            text="听真人录音"
            @click="goRecordingDetail(row.recording_id)"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import { goEntryDetail, goRecordingDetail } from '@/services/navigation';

export default {
  components: { BaseButton },
  props: { sections: { type: Array, required: true } },
  methods: { goEntryDetail, goRecordingDetail },
};
</script>

<style scoped>
.guide-section {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}
.guide-title {
  font-weight: 700;
}
.guide-text {
  white-space: pre-line;
  line-height: 1.65;
}
.guide-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding: 8px 0;
}
.guide-form {
  min-width: 2.6em;
  font-weight: 700;
}
.guide-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
