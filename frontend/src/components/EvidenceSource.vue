<template>
  <view class="source-card">
    <view class="source-card__type">
      {{ typeLabel }} · {{ source.created_at || '时间未提供' }}
    </view>
    <view
      class="source-card__text"
      :class="{ 'is-expanded': expanded }"
    >
      {{ source.original_text || '原文未提供' }}
    </view>
    <BaseButton
      v-if="source.original_text?.length > 320"
      size="small"
      variant="ghost"
      :text="expanded ? '收起原文' : '展开全部原文'"
      @click="expanded = !expanded"
    />
    <view v-if="source.original_writing">
      原写法：{{ source.original_writing }}
    </view>
    <view
      v-if="source.original_pronunciation"
      class="source-card__pronunciation"
    >
      原读音：{{ source.original_pronunciation }}
    </view>
    <view v-if="source.original_gloss">
      原大意：{{ source.original_gloss }}
    </view>
    <view class="source-card__citation">
      出处：{{ source.citation || '未提供' }}
    </view>
    <slot />
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';

export default {
  components: { BaseButton },
  props: { source: { type: Object, required: true } },
  data() { return { expanded: false }; },
  computed: {
    typeLabel() {
      return ({
        user_statement: '用户原话',
        oral: '口述',
        fieldwork: '田野记录',
        book: '书籍',
        article: '论文或文章',
        archive: '档案',
        web: '网页',
        legacy: '旧库原文',
        other: '其他',
      })[this.source.source_type] || this.source.source_type || '来源类型未提供';
    },
  },
};
</script>

<style scoped>
.source-card {
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  line-height: 1.7;
  overflow-wrap: anywhere;

}
.source-card__text {
  white-space: pre-wrap;
  margin: var(--space-2) 0;
  max-height: 45vh;
  overflow: auto;

}
.source-card__type, .source-card__citation {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);

}
.source-card__text.is-expanded {
  max-height: none;
}
</style>
