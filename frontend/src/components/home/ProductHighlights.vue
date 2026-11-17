<template>
  <view
    v-if="toolsAvailable || profile.featured.length"
    class="product-highlights"
  >
    <BaseButton
      v-if="toolsAvailable"
      size="extra-small"
      variant="light"
      :text="toolLabel"
      @click="openTools"
    />
    <BaseButton
      v-for="feature in profile.featured"
      :key="`${feature.type}-${feature.id}`"
      size="extra-small"
      variant="light"
      :text="feature.title"
      @click="openFeature(feature)"
    />
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import pagesJson from '@/pages.json';
import { openPage, ROUTES } from '@/services/navigation';
import { LOCAL_TOOLS_ROUTE, productProfile } from '@/services/productProfile';

const toolsRegistered = pagesJson.pages.some(({ path }) => `/${path}` === LOCAL_TOOLS_ROUTE);
const featureRoutes = {
  entry: ROUTES.entryDetail,
  recording: ROUTES.recordingDetail,
  collection: ROUTES.collectionDetail,
};

export default {
  components: { BaseButton },
  data() {
    return { profile: productProfile };
  },
  computed: {
    toolsAvailable() {
      return toolsRegistered && Boolean(this.profile.local_tools_dialect);
    },
    toolLabel() {
      if (this.profile.local_tools_dialect === '闽.莆仙') return '莆仙方言工具';
      return '地方方言工具';
    },
  },
  methods: {
    openTools() {
      openPage(LOCAL_TOOLS_ROUTE, { dialect: this.profile.local_tools_dialect });
    },
    openFeature(feature) {
      const route = featureRoutes[feature.type];
      if (route) openPage(route, { id: feature.id });
    },
  },
};
</script>

<style scoped>
.product-highlights {
  display: flex;
  gap: 10rpx;
  margin: 8rpx 0 0;
  overflow-x: auto;
  scrollbar-width: thin;
}
.product-highlights :deep(.base-button) {
  flex: 0 0 auto;
  max-width: 60vw;
  margin: 0;
}
</style>
