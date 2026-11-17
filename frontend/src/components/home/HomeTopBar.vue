<template>
  <view class="home-top-bar">
    <view class="home-top-bar__row">
      <!-- 左侧轻入口：纯 CSS 具象图标，深底高对比 -->
      <view class="home-top-bar__entries">
        <view
          class="home-top-bar__entry"
          role="button"
          aria-label="方言圈"
          @tap="toCircles"
        >
          <view
            class="home-top-bar__icon home-top-bar__icon--circle"
            aria-hidden="true"
          />
        </view>
      </view>

      <!-- 中间内容 tab -->
      <view
        class="home-top-bar__tabs"
        role="tablist"
      >
        <view
          v-for="tab in LISTEN_FEED_TABS"
          :key="tab.key"
          class="home-top-bar__tab"
          :class="{ 'home-top-bar__tab--active': tab.key === activeTab }"
          role="tab"
          :aria-selected="tab.key === activeTab ? 'true' : 'false'"
          @tap="switchTab(tab.key)"
        >
          {{ tab.label }}
        </view>
        <!-- 单一滑动指示器：均分槽位下按激活索引滑动 -->
        <view
          class="home-top-bar__indicator"
          aria-hidden="true"
          :style="indicatorStyle"
        />
      </view>

      <!-- 右侧搜索 -->
      <view
        class="home-top-bar__search home-search-entry"
        role="button"
        aria-label="查找词条"
        @tap="toSearch"
      >
        <view
          class="home-top-bar__search-icon"
          aria-hidden="true"
        />
      </view>
    </view>

    <ProductBrand
      class="home-top-bar__brand"
      immersive
      switchable
    />
    <ProductHighlights />
  </view>
</template>

<script>
import { LISTEN_FEED_TABS } from '@/services/listenFeed';
import ProductBrand from '@/components/ProductBrand.vue';
import ProductHighlights from '@/components/home/ProductHighlights.vue';
import { goCircleList, goSearch } from '@/services/navigation';

export default {
  name: 'HomeTopBar',
  components: { ProductBrand, ProductHighlights },
  props: {
    activeTab: {
      type: String,
      default: 'recommended',
    },
  },
  emits: ['change'],
  data() {
    return {
      LISTEN_FEED_TABS,
    };
  },
  computed: {
    activeTabIndex() {
      const index = LISTEN_FEED_TABS.findIndex((tab) => tab.key === this.activeTab);
      return index < 0 ? 0 : index;
    },
    /* 指示器槽位宽为容器的一份，translateX 百分比相对自身宽度，
     * 故 index * 100% 恰好落在第 index 个槽位 */
    indicatorStyle() {
      return { width: `${100 / LISTEN_FEED_TABS.length}%`, transform: `translateX(${this.activeTabIndex * 100}%)` };
    },
  },
  methods: {
    switchTab(key) {
      if (key !== this.activeTab) {
        this.$emit('change', key);
      }
    },
    toCircles() {
      goCircleList();
    },
    toSearch() {
      goSearch();
    },
  },
};
</script>

<style scoped>
.home-top-bar {
  padding: 12rpx 24rpx 0;
}

.home-top-bar__row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

/* ---------- 轻入口 ---------- */
.home-top-bar__entries {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4rpx;
}

/* 可点区域不小于 64rpx */
.home-top-bar__entry {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.home-top-bar__entry:active {
  background: var(--immersive-surface-color);
}

/* 统一线框图标基座：4rpx 描边、主色高对比 */
.home-top-bar__icon {
  position: relative;
  color: var(--on-immersive-color);
}

/* 方言圈：对话气泡 + 内两点（乡友围谈） */
.home-top-bar__icon--circle {
  width: 36rpx;
  height: 30rpx;
  border: 4rpx solid currentColor;
  border-radius: 14rpx;
  box-sizing: border-box;
}

.home-top-bar__icon--circle::before {
  content: '';
  position: absolute;
  left: 7rpx;
  top: 8rpx;
  width: 5rpx;
  height: 5rpx;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 10rpx 0 0 currentColor;
}

.home-top-bar__icon--circle::after {
  content: '';
  position: absolute;
  left: 7rpx;
  bottom: -10rpx;
  width: 0;
  height: 0;
  border-top: 9rpx solid currentColor;
  border-right: 9rpx solid transparent;
}

/* 发现：指南针（圆环 + 双向指针） */
.home-top-bar__icon--compass {
  width: 36rpx;
  height: 36rpx;
  border: 4rpx solid currentColor;
  border-radius: 50%;
  box-sizing: border-box;
}

.home-top-bar__icon--compass::before,
.home-top-bar__icon--compass::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 0;
  height: 0;
  margin-left: -5rpx;
  border-left: 5rpx solid transparent;
  border-right: 5rpx solid transparent;
}

.home-top-bar__icon--compass::before {
  top: 2rpx;
  border-bottom: 10rpx solid currentColor;
}

.home-top-bar__icon--compass::after {
  bottom: 2rpx;
  border-top: 10rpx solid currentColor;
}

/* ---------- tab ---------- */
.home-top-bar__tabs {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
}

.home-top-bar__tab {
  flex: 1;
  min-width: 0;
  text-align: center;
  padding: 12rpx 4rpx;
  color: var(--on-immersive-muted-color);
  font-size: var(--font-size-base);
  font-weight: 500;
  letter-spacing: 2rpx;
  /* 字号平滑过渡；字重插值在多数字体上不可靠，保持瞬切保双端一致 */
  transition: color 0.25s ease, font-size 0.25s ease;
}

.home-top-bar__tab--active {
  color: var(--on-immersive-color);
  font-size: var(--font-size-lg);
  font-weight: 900;
}

/* 单一滑动下划线指示器：宽度为一个均分槽位，
 * 实际短线由 ::after 渲染并槽内居中，视觉与原下划线一致 */
.home-top-bar__indicator {
  position: absolute;
  left: 0;
  bottom: 0;

  height: 6rpx;
  transition: transform 0.25s ease;
}

.home-top-bar__indicator::after {
  content: '';
  display: block;
  width: 36rpx;
  height: 6rpx;
  margin: 0 auto;
  border-radius: 999rpx;
  background: var(--immersive-accent-color);
  box-shadow: 0 0 12rpx var(--immersive-glow-color);
}

@media (prefers-reduced-motion: reduce) {
  .home-top-bar__tab,
  .home-top-bar__indicator {
    transition: none;
  }
}

/* ---------- 搜索 ---------- */
.home-top-bar__search {
  flex: 0 0 auto;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.home-top-bar__search:active {
  background: var(--immersive-surface-color);
}

/* 纯 CSS 放大镜 */
.home-top-bar__search-icon {
  position: relative;
  width: 34rpx;
  height: 34rpx;
}

.home-top-bar__search-icon::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 24rpx;
  height: 24rpx;
  border: 4rpx solid var(--on-immersive-color);
  border-radius: 50%;
  box-sizing: border-box;
}

.home-top-bar__search-icon::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 2rpx;
  width: 12rpx;
  height: 4rpx;
  border-radius: 2rpx;
  background: var(--on-immersive-color);
  transform: rotate(45deg);
}

/* ---------- 品牌小标 ----------
 * faint（0.36）对比度过弱，顶栏文本改用次级令牌保证可读 */
.home-top-bar__brand {
  margin-top: 6rpx;
  text-align: center;
  color: var(--on-immersive-muted-color);
  font-size: 18rpx;
  letter-spacing: 6rpx;
}

/* #ifdef H5 */
@media screen and (min-width: 600px) and (max-height: 500px) and (orientation: landscape) {
  .home-top-bar {
    padding: 4px 20px 0;
  }

  .home-top-bar__row {
    gap: 8px;
  }

  .home-top-bar__entry,
  .home-top-bar__search {
    width: 44px;
    height: 44px;
  }

  .home-top-bar__tab {
    padding: 5px 4px;
    font-size: 15px;
  }

  .home-top-bar__tab--active {
    font-size: 17px;
  }

  .home-top-bar__brand {
    margin-top: 0;
    font-size: 10px;
    line-height: 1;
    letter-spacing: 4px;
  }
}
/* #endif */
</style>
