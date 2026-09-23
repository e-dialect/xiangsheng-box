<template>
  <view class="box-panel">
    <text class="box-heading">
      {{ heading }}
    </text>
    <text class="box-note">
      最近的声音与意见；留言和点赞不代表词条认证。
    </text>
    <BaseLoading
      v-if="loading && !items.length"
      text="正在读取留言…"
    />
    <EmptyState
      v-else-if="error"
      :title="error"
      action-text="重试"
      @action="reload"
    />
    <text
      v-else-if="!items.length"
      class="box-note"
    >
      还没有留言，聊聊你听到的乡音。
    </text>
    <view
      v-for="comment in items"
      :key="comment.id"
      class="box-recording"
    >
      <text class="box-heading">
        {{ comment.author_name }}
      </text>
      <text class="discussion-summary__body">
        {{ comment.body }}
      </text>
      <text
        v-if="comment.reply_count > 0"
        class="box-note"
      >
        {{ comment.reply_count }} 条回复
      </text>
    </view>
    <BaseButton
      variant="ghost"
      :text="total > 0 ? `查看全部 ${total} 条讨论` : '写下第一条留言'"
      @click="$emit('open')"
    />
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import { pageResults } from '@/services/entryRecording';
import { listComments } from '@/services/recordingSocial';

export default {
  name: 'DiscussionSummary',
  components: { BaseButton, BaseLoading, EmptyState },
  props: {
    targetId: { type: [Number, String], required: true },
    targetType: { type: String, default: 'recording', validator: (value) => ['entry', 'recording'].includes(value) },
    limit: { type: Number, default: 3 },
    heading: { type: String, default: '大家怎么说' },
  },
  emits: ['open', 'count-change'],
  data: () => ({
    items: [],
    total: 0,
    loading: false,
    error: '',
  }),
  mounted() { this.reload(); },
  methods: {
    async reload() {
      if (this.loading) return;
      this.loading = true;
      this.error = '';
      try {
        const response = await listComments(this.targetId, 1, this.targetType, null, this.limit);
        this.items = pageResults(response).slice(0, this.limit);
        this.total = response.count ?? this.items.length;
        this.$emit('count-change', this.total);
      } catch (error) {
        this.error = '留言暂时无法读取';
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.discussion-summary__body {
  display: -webkit-box;
  color: var(--text-color);
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
