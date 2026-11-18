<template>
  <view
    v-if="sections.length"
    class="product-highlights"
  >
    <!-- #ifdef H5 -->
    <BaseButton
      class="product-highlights__toggle"
      size="extra-small"
      variant="light"
      text="首页栏目"
      :aria-expanded="expanded ? 'true' : 'false'"
      @click="expanded = !expanded"
    />
    <!-- #endif -->
    <view
      class="product-highlights__sections"
      :class="{ 'product-highlights__sections--expanded': expanded }"
    >
      <view
        v-for="section in sections"
        :key="section.key"
        class="product-highlights__section"
        :data-home-section="section.key"
      >
        <text class="product-highlights__label">
          {{ section.label }}
        </text>
        <view class="product-highlights__actions">
          <BaseButton
            v-for="tool in section.tools"
            :key="tool.id"
            size="extra-small"
            variant="light"
            :text="tool.label"
            @click="openTools(tool.id)"
          />
          <BaseButton
            v-for="feature in section.features"
            :key="`${feature.type}-${feature.id}`"
            size="extra-small"
            variant="light"
            :text="feature.title"
            @click="openFeature(feature)"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import pagesJson from '@/pages.json';
import { openPage, ROUTES } from '@/services/navigation';
import { enabledLocalTools, LOCAL_TOOLS_ROUTE, productProfile } from '@/services/productProfile';

const toolsRegistered = pagesJson.pages.some(({ path }) => `/${path}` === LOCAL_TOOLS_ROUTE);
const featureSections = {
  featured: { label: '精选' },
  entries: { label: '精选词条', type: 'entry' },
  recordings: { label: '精选乡音', type: 'recording' },
  collections: { label: '集盒专题', type: 'collection' },
};

export default {
  components: { BaseButton },
  data() {
    return { expanded: false };
  },
  computed: {
    sections() {
      return productProfile.home_sections.flatMap((key) => {
        if (key === 'tools') {
          const tools = toolsRegistered ? enabledLocalTools() : [];
          if (!tools.length) return [];
          const label = productProfile.local_tools_dialect === '闽.莆仙' ? '莆仙方言工具' : '地方方言工具';
          return [{
            key, label, tools, features: [],
          }];
        }
        const section = featureSections[key];
        if (!section) return [];
        const features = section.type
          ? productProfile.featured.filter(({ type }) => type === section.type)
          : productProfile.featured;
        return features.length ? [{
          key, label: section.label, tools: [], features,
        }] : [];
      });
    },
  },
  methods: {
    openTools(tool) {
      this.expanded = false;
      openPage(LOCAL_TOOLS_ROUTE, { dialect: productProfile.local_tools_dialect, tool });
    },
    openFeature(feature) {
      const routes = {
        entry: ROUTES.entryDetail,
        recording: ROUTES.recordingDetail,
        collection: ROUTES.collectionDetail,
      };
      const route = routes[feature.type];
      if (typeof route !== 'string') return;
      this.expanded = false;
      openPage(route, { id: feature.id });
    },
  },
};
</script>

<style scoped>
.product-highlights {
  min-width: 0;
  margin: 8rpx 0 0;
}

.product-highlights__toggle {
  display: none;
}

.product-highlights__sections {
  display: flex;
  gap: 20rpx;
  overflow-x: auto;
  scrollbar-width: thin;
}

.product-highlights__section {
  flex: 0 0 auto;
}

.product-highlights__label {
  display: block;
  margin-bottom: 4rpx;
  color: var(--on-immersive-muted-color);
  font-size: var(--font-size-xs);
}

.product-highlights__actions {
  display: flex;
  gap: 10rpx;
}

.product-highlights :deep(.base-button) {
  flex: 0 0 auto;
  max-width: 60vw;
  margin: 0;
}

/* #ifdef H5 */
@media screen and (min-width: 600px) and (max-height: 500px) and (orientation: landscape) {
  .product-highlights {
    margin: 0;
  }

  .product-highlights__toggle {
    display: flex;
    margin: 0;
  }

  .product-highlights__sections {
    display: none;
    position: absolute;
    inset: 100% 20px auto;
    padding: 8px 12px;
    border: 1px solid var(--immersive-border-color);
    border-radius: var(--radius-md);
    background: var(--immersive-bg-strong-color);
  }

  .product-highlights__sections--expanded {
    display: flex;
  }
}
/* #endif */
</style>
