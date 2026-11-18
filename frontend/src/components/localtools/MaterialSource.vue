<template>
  <view class="material-source">
    <text>适用口音 · {{ material.accent }}</text>
    <text>版本 · {{ material.version }}</text>
    <text>来源 · {{ material.source }}</text>
    <BaseButton
      v-if="material.source_url"
      size="small"
      variant="ghost"
      text="复制来源网址"
      @click="copySource"
    />
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import { notify } from '@/services/feedback';

export default {
  components: { BaseButton },
  props: { material: { type: Object, required: true } },
  methods: {
    copySource() {
      uni.setClipboardData({
        data: this.material.source_url,
        success: () => notify({ title: '已复制来源网址' }),
        fail: () => notify({ title: '暂时无法复制网址' }),
      });
    },
  },
};
</script>

<style scoped>
.material-source {
  display: grid;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  font-size: 13px;
  line-height: 1.5;
  justify-items: start;
  overflow-wrap: anywhere;
}
</style>
