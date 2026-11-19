<template>
  <view
    class="product-brand"
    :data-profile="profile.key"
  >
    <view class="product-brand__identity">
      <text class="product-brand__name">
        {{ profile.name }}
      </text>
      <text
        v-if="profile.credit"
        class="product-brand__credit"
      >
        {{ profile.credit }}
      </text>
    </view>
    <view
      v-if="switchable && profile.switchTargets.length"
      class="product-brand__switch"
    >
      <BaseButton
        v-for="target in profile.switchTargets"
        :key="target.key"
        class="product-brand__switch-action"
        :variant="immersive ? 'light' : 'ghost'"
        size="extra-small"
        :text="`切换到${target.name}`"
        @click="switchProductProfile(target.key)"
      />
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import { productProfile, switchProductProfile } from '@/services/productProfile';

export default {
  components: { BaseButton },
  props: {
    immersive: { type: Boolean, default: false },
    switchable: { type: Boolean, default: false },
  },
  data() {
    return { profile: productProfile };
  },
  methods: { switchProductProfile },
};
</script>

<style scoped>
.product-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4rpx 14rpx;
}

.product-brand__identity {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  column-gap: 8rpx;
  min-width: 0;
  letter-spacing: normal;
}

.product-brand__name {
  font-weight: 800;
}

.product-brand__credit {
  font-size: 0.85em;
  font-weight: 500;
}

.product-brand__switch {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  letter-spacing: normal;
}

.product-brand__switch-action {
  margin: 0;
}
</style>
