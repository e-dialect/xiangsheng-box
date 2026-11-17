<template>
  <view
    class="sense-concepts"
    aria-label="这个义项的概念关联"
  >
    <view
      v-for="(item, index) in items"
      :key="index"
      class="sense-concepts__item"
    >
      <text class="sense-concepts__relation">
        {{ item.relation }}：
      </text>
      <text>{{ item.label }}</text>
      <view
        v-if="item.note"
        class="sense-concepts__note"
      >
        {{ item.note }}
      </view>
    </view>
    <text
      v-if="!items.length"
      class="sense-concepts__note"
    >
      这个义项尚未标注概念关联
    </text>
  </view>
</template>

<script>
function plainText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export default {
  props: { concepts: { type: Array, default: () => [] } },
  computed: {
    items() {
      return this.concepts.filter((item) => item && typeof item === 'object').map((item) => ({
        label: plainText(item.label) || plainText(item.code),
        relation: {
          exact: '对应概念', broader: '较宽关联', narrower: '较窄关联', related: '相关概念',
        }[item.relation_type] || '关联关系待核实',
        note: plainText(item.note),
      })).filter((item) => item.label);
    },
  },
};
</script>

<style scoped>
.sense-concepts { display: grid; gap: 8px; margin-top: 12px;
  overflow-wrap: anywhere; min-width: 0; }
.sense-concepts__item { line-height: 1.6;
  font-size: 13px; }
.sense-concepts__relation, .sense-concepts__note { color: var(--text-secondary-color);
  font-size: 12px; }
</style>
