<template>
  <view
    class="daily-entry"
    aria-live="polite"
  >
    <text class="daily-entry__heading">
      每日一词
    </text>
    <BaseLoading
      v-if="loading"
      text="正在找今天的词…"
    />
    <template v-else-if="entry">
      <text class="daily-entry__title">
        {{ title }}
      </text>
      <text
        v-if="entry.summary && entry.summary !== title"
        class="daily-entry__summary"
      >
        {{ entry.summary }}
      </text>
      <BaseButton
        size="small"
        variant="ghost"
        text="查看词条"
        @click="openEntry"
      />
    </template>
    <template v-else-if="failed">
      <text class="daily-entry__summary">
        每日一词暂时没有加载出来。
      </text>
      <BaseButton
        size="small"
        variant="ghost"
        text="重试每日一词"
        @click="loadEntry"
      />
    </template>
    <text
      v-else
      class="daily-entry__summary"
    >
      当前地区范围暂时没有可推荐的词条。
    </text>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import { entryTitle } from '@/services/entryRecording';
import { getDailyEntry } from '@/services/entrySearchAssist';
import { goEntryDetail } from '@/services/navigation';

export default {
  components: { BaseButton, BaseLoading },
  props: {
    dialectId: { type: [String, Number], default: '' },
    dialectScope: { type: String, default: 'exact' },
  },
  data: () => ({
    entry: null,
    failed: false,
    loading: true,
  }),
  computed: {
    title() { return this.entry ? entryTitle(this.entry) : ''; },
  },
  mounted() {
    this.loadEntry();
  },
  methods: {
    async loadEntry() {
      this.loading = true;
      this.failed = false;
      try {
        const entry = await getDailyEntry(this.dialectId, this.dialectScope);
        this.entry = entry?.id ? entry : null;
      } catch {
        this.failed = true;
      } finally {
        this.loading = false;
      }
    },
    openEntry() {
      goEntryDetail(this.entry.id);
    },
  },
};
</script>

<style lang="scss" scoped>
.daily-entry {
  display: grid;
  gap: 8rpx;
  justify-items: start;
  padding: 22rpx 24rpx;
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
  color: var(--text-color);
  overflow-wrap: anywhere;
}

.daily-entry__heading,
.daily-entry__summary {
  color: var(--text-secondary-color);
  font-size: 24rpx;
  line-height: 1.65;
}

.daily-entry__title {
  font-size: 34rpx;
  font-weight: 700;
}
</style>
