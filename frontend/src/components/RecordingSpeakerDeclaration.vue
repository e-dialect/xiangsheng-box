<template>
  <view class="speaker-declaration">
    <text>谁在发声，怎样取得同意？</text>
    <text class="box-note">
      此处同意仅用于审核试听和通过后的公开展示。研究、训练和声音合成须另行取得许可。
    </text>
    <BaseButton
      v-for="item in declarations"
      :key="item.value"
      :variant="source === item.value ? 'primary' : 'ghost'"
      :disabled="disabled"
      :aria-pressed="source === item.value"
      :text="item.text"
      @click="$emit('choose', item.value)"
    />
    <BaseField
      v-if="source && source !== 'self'"
      :model-value="speakerLabel"
      :disabled="disabled"
      name="speaker_label"
      label="发声人称呼或关系（可选，仅你和审核员可见）"
      placeholder="例如家中长辈，无需实名"
      :maxlength="40"
      @update:model-value="$emit('label', $event)"
    />
  </view>
</template>
<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import { speakerDeclarations } from '@/services/recordingSpeaker';

export default {
  components: { BaseButton, BaseField },
  props: {
    source: { type: String, default: '' },
    speakerLabel: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  emits: ['choose', 'label'],
  data: () => ({ declarations: speakerDeclarations }),
};
</script>
<style scoped>
.speaker-declaration {
  display: grid;
  gap: var(--space-2);
}
</style>
