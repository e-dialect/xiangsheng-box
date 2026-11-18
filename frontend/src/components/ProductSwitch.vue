<template>
  <view v-if="targets.length">
    <BaseButton
      :variant="immersive ? 'light' : 'ghost'"
      size="extra-small"
      text="切换站点"
      @click="visible = true"
    />
    <TActionSheet
      v-if="visible"
      v-model:visible="visible"
      description="切换站点后可使用同一账户，可能需要重新登录"
      :items="targets.map(({ name }) => ({ label: name }))"
      @selected="selectTarget"
    />
  </view>
</template>

<script>
import TActionSheet from '@tdesign/uniapp/action-sheet/action-sheet.vue';
import BaseButton from '@/components/BaseButton.vue';
import { productProfile, switchProductProfile } from '@/services/productProfile';

export default {
  components: { BaseButton, TActionSheet },
  props: {
    immersive: { type: Boolean, default: false },
    params: { type: Object, default: null },
  },
  data() {
    return { visible: false };
  },
  computed: {
    targets() {
      return productProfile.switchTargets;
    },
  },
  methods: {
    selectTarget({ index }) {
      const target = this.targets[index];
      this.visible = false;
      if (target) switchProductProfile(target.key, this.params);
    },
  },
};
</script>
