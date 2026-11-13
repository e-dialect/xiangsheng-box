<template>
  <view
    v-if="visible"
    class="dialect-selector"
    role="dialog"
    :aria-label="title"
    @tap="close"
  >
    <view
      class="dialect-selector__sheet"
      @tap.stop
    >
      <view class="dialect-selector__header">
        <view>
          <view class="dialect-selector__title">
            {{ title }}
          </view>
        </view>
        <BaseButton
          size="small"
          variant="ghost"
          text="关闭"
          @click="close"
        />
      </view>

      <BaseField
        v-model="query"
        class="dialect-selector__search"
        name="dialect_search"
        label="搜索地区或方言"
        clearable
        placeholder="例如：莆仙、莆田、城里"
      />

      <view
        v-if="!query && (resolvedDefaultDialect || recentDialects.length)"
        class="dialect-selector__shortcuts"
      >
        <view class="dialect-selector__section-label">
          默认与最近使用
        </view>
        <view class="dialect-selector__chips">
          <BaseButton
            v-if="resolvedDefaultDialect"
            size="small"
            variant="ghost"
            :text="`默认 · ${labelFor(resolvedDefaultDialect)}`"
            @click="selectNode(resolvedDefaultDialect)"
          />
          <BaseButton
            v-for="dialect in recentDialects"
            :key="dialect.id"
            size="small"
            variant="ghost"
            :text="`最近 · ${labelFor(dialect)}`"
            @click="selectNode(dialect)"
          />
        </view>
      </view>

      <scroll-view
        scroll-y
        class="dialect-selector__body"
      >
        <template v-if="query">
          <view class="dialect-selector__section-label">
            搜索结果
          </view>
          <view
            v-for="dialect in searchResults"
            :key="dialect.id"
            class="dialect-selector__result"
          >
            <view
              class="dialect-selector__result-copy"
              @tap="inspectSearchResult(dialect)"
            >
              <view class="dialect-selector__node-name">
                {{ nodeName(dialect) }}
              </view>
              <view class="dialect-selector__path">
                {{ breadcrumbFor(dialect) }}
              </view>
            </view>
            <BaseButton
              size="small"
              :variant="isSelected(dialect) ? 'primary' : 'ghost'"
              :text="isSelected(dialect) ? '已选' : '就选这里'"
              @click="selectNode(dialect)"
            />
          </view>
          <view
            v-if="!searchResults.length"
            class="dialect-selector__empty"
          >
            没有找到这个名称，可以返回逐级选择
          </view>
        </template>

        <template v-else>
          <view class="dialect-selector__breadcrumbs">
            <text
              class="dialect-selector__crumb"
              @tap="goToLevel(-1)"
            >
              全部方言
            </text>
            <view
              v-for="(dialect, index) in cursorPath"
              :key="dialect.id"
              class="dialect-selector__crumb-pair"
            >
              <text class="dialect-selector__separator">
                ›
              </text>
              <text
                class="dialect-selector__crumb"
                @tap="goToLevel(index)"
              >
                {{ nodeName(dialect) }}
              </text>
            </view>
          </view>

          <view
            v-if="currentNode"
            class="dialect-selector__current"
          >
            <view>
              <view class="dialect-selector__level">
                <BaseButton
                  size="small"
                  variant="ghost"
                  text="返回上一级"
                  @click="goToLevel(cursorPath.length - 2)"
                />
                <text class="dialect-selector__current-kicker">
                  当前已知范围
                </text>
              </view>
              <view class="dialect-selector__current-name">
                {{ labelFor(currentNode) }}
              </view>
              <view class="dialect-selector__path">
                {{ breadcrumbFor(currentNode) }}
              </view>
            </view>
            <view class="dialect-selector__confirm">
              <text class="dialect-selector__hint">
                不确定更细地点时，可以直接选择当前范围
              </text>
              <BaseButton
                :variant="isSelected(currentNode) ? 'primary' : 'ghost'"
                :text="isSelected(currentNode) ? '已选择这里' : '就选这里'"
                @click="selectNode(currentNode)"
              />
            </view>
          </view>

          <view class="dialect-selector__section-label">
            {{ currentNode ? '继续细分（可选）' : '先选择你确定的大范围' }}
          </view>
          <view
            v-for="dialect in childNodes"
            :key="dialect.id"
            :class="['dialect-selector__node', isSelected(dialect) ? 'is-selected' : '']"
            role="button"
            :aria-label="`${nodeName(dialect)}${dialect.children?.length ? '，继续细分' : '，选择这里'}`"
            @tap="openNode(dialect)"
          >
            <view>
              <view class="dialect-selector__node-name">
                {{ nodeName(dialect) }}
              </view>
              <view class="dialect-selector__node-note">
                {{ dialect.children?.length ? `${dialect.children.length} 个可选细分` : '可直接选择' }}
              </view>
            </view>
            <text class="dialect-selector__node-action">
              {{ dialect.children?.length ? '进入 ›' : '选择' }}
            </text>
          </view>
          <view
            v-if="!childNodes.length && !currentNode"
            class="dialect-selector__empty"
          >
            暂时没有可选地区
          </view>
        </template>
      </scroll-view>
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import {
  buildDialectTree,
  dialectBreadcrumb,
  dialectCardLabel,
  findDialectPath,
  naturalDialectName,
} from '@/utils/dialectTree';

const MAX_RECENT = 4;
const RECENT_KEY = 'dialect-selector:recent';

function flatten(nodes = []) {
  return nodes.flatMap((node) => [node, ...flatten(node.children || [])]);
}

export default {
  name: 'DialectSelector',
  components: { BaseButton, BaseField },
  props: {
    visible: { type: Boolean, default: false },
    value: { type: [Number, String], default: '' },
    dialects: { type: Array, default: () => [] },
    defaultDialect: { type: Object, default: null },
    title: { type: String, default: '选择地区范围' },
    ownerScope: { type: [Number, String], default: 'guest' },
  },
  emits: ['change', 'close', 'update:visible'],
  data() {
    return {
      cursorId: null,
      query: '',
      recentIds: [],
      profileDefaultDialect: null,
    };
  },
  computed: {
    tree() {
      return buildDialectTree(this.dialects);
    },
    flatDialects() {
      return flatten(this.tree);
    },
    cursorPath() {
      return findDialectPath(this.tree, this.cursorId);
    },
    currentNode() {
      return this.cursorPath[this.cursorPath.length - 1] || null;
    },
    childNodes() {
      return this.currentNode?.children || this.tree;
    },
    resolvedDefaultDialect() {
      const requested = this.defaultDialect || this.profileDefaultDialect;
      return this.flatDialects.find((item) => String(item.id) === String(requested?.id)) || null;
    },
    recentDialects() {
      return this.recentIds
        .map((id) => this.flatDialects.find((item) => String(item.id) === String(id)))
        .filter(Boolean)
        .filter((item) => String(item.id) !== String(this.resolvedDefaultDialect?.id));
    },
    searchResults() {
      const keyword = String(this.query || '').trim().toLowerCase();
      if (!keyword) return [];
      return this.flatDialects.filter((dialect) => [
        dialect.name,
        dialectBreadcrumb(dialect, this.dialects),
        dialect.qualified_code,
        dialect.code,
      ].filter(Boolean).join(' ').toLowerCase().includes(keyword)).slice(0, 30);
    },
  },
  watch: {
    flatDialects() {
      if (this.visible) this.refreshProfileDefault();
    },
    defaultDialect() {
      if (this.visible) this.refreshProfileDefault();
    },
    ownerScope() {
      if (this.visible) this.refreshShortcuts();
    },
    value(next) {
      if (!this.visible) return;
      const path = findDialectPath(this.tree, next);
      this.cursorId = path[path.length - 1]?.id || null;
    },
    visible: {
      immediate: true,
      handler(next) {
        if (!next) return;
        this.query = '';
        this.refreshShortcuts();
        const path = findDialectPath(this.tree, this.value);
        this.cursorId = path[path.length - 1]?.id || null;
      },
    },
  },
  methods: {
    refreshShortcuts() {
      this.loadRecent();
      this.refreshProfileDefault();
    },
    refreshProfileDefault() {
      // Global profile data is not reactive. Refresh when opening or changing identity.
      this.profileDefaultDialect = typeof getApp === 'function'
        ? getApp()?.globalData?.userInfo?.primary_dialect || null
        : null;
    },
    storageKey() {
      return `${RECENT_KEY}:${this.ownerScope || 'guest'}`;
    },
    loadRecent() {
      try {
        const stored = JSON.parse(uni.getStorageSync(this.storageKey()) || '[]');
        this.recentIds = Array.isArray(stored) ? stored.slice(0, MAX_RECENT) : [];
      } catch (error) {
        this.recentIds = [];
      }
    },
    remember(id) {
      this.recentIds = [
        Number(id),
        ...this.recentIds.filter((item) => String(item) !== String(id)),
      ].slice(0, MAX_RECENT);
      try {
        uni.setStorageSync(this.storageKey(), JSON.stringify(this.recentIds));
      } catch (error) {
        // Recent shortcuts are optional; unavailable storage must not block selection.
      }
    },
    breadcrumbFor(dialect) {
      return dialectBreadcrumb(dialect, this.dialects);
    },
    labelFor(dialect) {
      return dialectCardLabel(dialect, this.dialects);
    },
    nodeName(dialect) {
      return naturalDialectName(dialect?.name);
    },
    isSelected(dialect) {
      return String(dialect?.id) === String(this.value);
    },
    openNode(dialect) {
      if (!dialect?.children?.length) {
        this.selectNode(dialect);
        return;
      }
      this.cursorId = dialect.id;
    },
    inspectSearchResult(dialect) {
      this.query = '';
      this.cursorId = dialect.id;
    },
    goToLevel(index) {
      this.cursorId = index < 0 ? null : this.cursorPath[index]?.id || null;
    },
    selectNode(dialect) {
      if (!dialect?.id) return;
      this.remember(dialect.id);
      this.$emit('change', { value: Number(dialect.id), dialect });
      this.close();
    },
    close() {
      this.$emit('update:visible', false);
      this.$emit('close');
    },
  },
};
</script>

<style scoped>
.dialect-selector {
  position: fixed;
  z-index: 12000;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.44);
}

.dialect-selector__sheet {
  width: 100%;
  max-width: 920rpx;
  max-height: 88vh;
  box-sizing: border-box;
  padding: 30rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background: var(--surface-color);
  color: var(--text-color);
}

.dialect-selector__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

.dialect-selector__title {
  font-size: 34rpx;
  font-weight: 800;
}

.dialect-selector__hint,
.dialect-selector__path,
.dialect-selector__node-note,
.dialect-selector__empty {
  color: var(--muted-color);
  font-size: 23rpx;
  line-height: 1.55;
}

.dialect-selector__hint {
  margin-top: 8rpx;
}

.dialect-selector__body {
  height: min(760rpx, 58vh);
  margin-top: 18rpx;
}

.dialect-selector__shortcuts,
.dialect-selector__current {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
}

.dialect-selector__section-label,
.dialect-selector__current-kicker {
  margin: 22rpx 0 12rpx;
  color: var(--text-secondary-color);
  font-size: 23rpx;
  font-weight: 700;
}

.dialect-selector__shortcuts .dialect-selector__section-label {
  margin-top: 0;
}

.dialect-selector__chips,
.dialect-selector__breadcrumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.dialect-selector__crumb-pair {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
}

.dialect-selector__breadcrumbs {
  align-items: center;
  padding: 8rpx 0;
  color: var(--accent-color);
  font-size: 24rpx;
}

.dialect-selector__crumb {
  padding: 8rpx 0;
}

.dialect-selector__separator {
  color: var(--muted-color);
}

.dialect-selector__current,
.dialect-selector__result,
.dialect-selector__node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.dialect-selector__current-kicker {
  margin: 0;
  color: var(--accent-color);
}

.dialect-selector__current-name {
  margin-top: 8rpx;
  font-size: 31rpx;
  font-weight: 800;
}

.dialect-selector__result,
.dialect-selector__node {
  min-height: 92rpx;
  padding: 16rpx 8rpx;
  border-bottom: 1rpx solid var(--border-color);
}

.dialect-selector__result-copy {
  flex: 1;
  min-width: 0;
}

.dialect-selector__node.is-selected {
  color: var(--accent-color);
}

.dialect-selector__node-name {
  font-size: 28rpx;
  font-weight: 700;
}

.dialect-selector__node-action {
  flex: 0 0 auto;
  color: var(--accent-color);
  font-size: 24rpx;
}

.dialect-selector__empty {
  padding: 46rpx 12rpx;
  text-align: center;
}
.dialect-selector__sheet {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 88vh;
}
.dialect-selector__body {
  flex: 1 1 auto;
  min-height: 120rpx;
  overflow-y: auto;
}
.dialect-selector__header { margin-bottom: var(--space-2); }
.dialect-selector__shortcuts { padding: var(--space-2); margin-top: var(--space-2); }
.dialect-selector__current { align-items: flex-start; flex-wrap: wrap; }
.dialect-selector__current > view { min-width: 0; overflow-wrap: anywhere; }
.dialect-selector__level {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.dialect-selector__confirm { display: grid; gap: var(--space-2); width: 100%; }
.dialect-selector__confirm :deep(.base-button) { justify-self: end; }
</style>
