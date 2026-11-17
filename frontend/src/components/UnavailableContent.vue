<template>
  <view>
    <EmptyState
      :title="title"
      action-text="重试"
      @action="$emit('retry')"
    />
    <view class="content-actions">
      <BaseButton
        size="small"
        variant="ghost"
        text="回本站首页"
        @click="goHome(true)"
      />
      <BaseButton
        size="small"
        variant="ghost"
        text="查找词条"
        @click="goSearch()"
      />
      <BaseButton
        size="small"
        variant="ghost"
        text="反馈这个链接"
        @click="report"
      />
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import { requireAuth } from '@/services/authGuard';
import { contentFeedbackParams } from '@/services/contentFeedback';
import {
  goHome, goSearch, openPage, ROUTES,
} from '@/services/navigation';

export default {
  name: 'UnavailableContent',
  components: { BaseButton, EmptyState },
  props: {
    title: { type: String, required: true },
    objectType: { type: String, required: true },
    objectId: { type: [Number, String], default: '' },
  },
  emits: ['retry'],
  methods: {
    goHome,
    goSearch,
    report() {
      const params = contentFeedbackParams(this.objectType, this.objectId);
      if (params && requireAuth('content_feedback', params)) openPage(ROUTES.mailSend, params);
    },
  },
};
</script>

<style scoped>
.content-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
}
</style>
