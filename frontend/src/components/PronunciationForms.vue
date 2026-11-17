<template>
  <view class="pronunciation-forms">
    <view
      v-if="base && surface && base === surface"
      class="pronunciation-forms__item"
    >
      <text class="pronunciation-forms__label">
        基础与实际形式
      </text>
      <text class="pronunciation-forms__value">
        {{ base }}
      </text>
    </view>
    <template v-else>
      <view
        v-if="base"
        class="pronunciation-forms__item"
      >
        <text class="pronunciation-forms__label">
          基础形式（单读）
        </text>
        <text class="pronunciation-forms__value">
          {{ base }}
        </text>
      </view>
      <text
        v-if="base && surface"
        class="pronunciation-forms__arrow"
        aria-label="变为"
      >
        →
      </text>
      <view
        v-if="surface"
        class="pronunciation-forms__item"
      >
        <text class="pronunciation-forms__label">
          实际形式（连读）
        </text>
        <text class="pronunciation-forms__value">
          {{ surface }}
        </text>
      </view>
    </template>
    <view
      v-if="ipa"
      class="pronunciation-forms__item"
    >
      <text class="pronunciation-forms__label">
        IPA（原记录）
      </text>
      <text class="pronunciation-forms__value">
        {{ ipa }}
      </text>
    </view>
    <text
      v-if="!base && !surface && !ipa"
      class="pronunciation-forms__label"
    >
      读音标注待补充
    </text>
    <text
      v-if="readingType"
      class="pronunciation-forms__label"
    >
      {{ readingType }}
    </text>
    <text
      v-if="note"
      class="pronunciation-forms__note"
    >
      {{ note }}
    </text>
  </view>
</template>

<script>
function plainText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export default {
  props: { variant: { type: Object, required: true } },
  computed: {
    base() { return plainText(this.variant.base_romanization); },
    surface() { return plainText(this.variant.surface_romanization); },
    ipa() { return plainText(this.variant.ipa); },
    note() { return plainText(this.variant.usage_note); },
    readingType() {
      return { literary: '文读', colloquial: '白读', other: '其他读法' }[this.variant.reading_type] || '';
    },
  },
};
</script>

<style scoped>
.pronunciation-forms { display: grid; gap: 8px; min-width: 0; overflow-wrap: anywhere; }
.pronunciation-forms__item { display: grid; gap: 4px; min-width: 0; }
.pronunciation-forms__label, .pronunciation-forms__arrow {
  color: var(--text-secondary-color); font-size: 12px;
}
.pronunciation-forms__value { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.pronunciation-forms__note { line-height: 1.6; font-size: 13px; }
</style>
