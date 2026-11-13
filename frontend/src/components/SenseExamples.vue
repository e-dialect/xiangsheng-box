<template>
  <view
    v-if="items.length"
    class="sense-examples"
    aria-label="这个义项的例句与用法"
  >
    <view class="sense-examples__heading">
      这样用这个词
    </view>
    <view
      v-for="(item, index) in items"
      :key="index"
      class="sense-examples__item"
    >
      <text class="sense-examples__label">
        {{ item.type || '例句' }}
      </text>
      <view class="sense-examples__content">
        {{ item.content }}
      </view>
      <view
        v-if="item.explain"
        class="sense-examples__explain"
      >
        {{ item.explain }}
      </view>
    </view>
  </view>
</template>

<script>
function plainText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export default {
  props: {
    examples: { type: Array, default: () => [] },
  },
  computed: {
    items() {
      return this.examples.map((example) => {
        if (typeof example === 'string') return { content: plainText(example) };
        if (!example || typeof example !== 'object' || Array.isArray(example)) return null;
        return {
          content: plainText(example.content) || plainText(example.text),
          explain: plainText(example.explain) || plainText(example.translation),
          type: plainText(example.type),
        };
      }).filter((item) => item?.content);
    },
  },
};
</script>

<style scoped>
.sense-examples {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  min-width: 0;
}
.sense-examples__heading {
  font-size: 12px;
  color: var(--text-secondary-color, #6b7280);
}
.sense-examples__item {
  border-left: 2px solid var(--border-color, #d8dee8);
  padding-left: 12px;
  display: grid;
  gap: 5px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.sense-examples__label {
  font-size: 12px;
  color: var(--text-secondary-color, #6b7280);
}
.sense-examples__content {
  line-height: 1.7;
}
.sense-examples__explain {
  line-height: 1.6;
  color: var(--text-secondary-color, #6b7280);
  font-size: 13px;
}
</style>
