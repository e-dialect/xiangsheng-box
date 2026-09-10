<template>
  <view
    :id="`comment-${comment.id}`"
    class="box-recording discussion-comment"
    :class="{
      'box-reply': comment.parent_id,
      'is-target': highlighted,
      'is-deleted': comment.deleted,
    }"
  >
    <template v-if="comment.deleted">
      <text class="box-note">
        该留言已删除，回复仍可查看。
      </text>
    </template>
    <template v-else>
      <text class="box-heading">
        {{ comment.author_name }}
      </text>
      <text
        v-if="replyLabel"
        class="box-note"
      >
        {{ replyLabel }}
      </text>
      <text class="discussion-comment__body">
        {{ comment.body }}
      </text>
    </template>
    <view
      v-if="!comment.deleted || comment.reply_count > 0"
      class="box-actions"
    >
      <BaseButton
        v-if="!comment.deleted"
        size="small"
        variant="ghost"
        :text="`${comment.liked ? '已赞' : '赞'} ${comment.like_count}`"
        :disabled="busy"
        @click="$emit('like', comment)"
      />
      <BaseButton
        v-if="!comment.deleted && !comment.parent_id"
        size="small"
        variant="ghost"
        text="回复"
        :disabled="busy"
        @click="$emit('reply', comment)"
      />
      <BaseButton
        v-if="!comment.parent_id && comment.reply_count > 0"
        size="small"
        variant="ghost"
        :text="`查看全部回复 ${comment.reply_count}`"
        :disabled="busy"
        @click="$emit('open-thread', comment)"
      />
      <BaseButton
        v-if="!comment.deleted && comment.editable"
        size="small"
        variant="danger-ghost"
        text="删除留言"
        :disabled="busy"
        @click="$emit('remove', comment)"
      />
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';

export default {
  name: 'DiscussionCommentCard',
  components: { BaseButton },
  props: {
    comment: { type: Object, required: true },
    busy: { type: Boolean, default: false },
    highlighted: { type: Boolean, default: false },
    /* 「回复 @某人」上下文，由列表按同一页的评论补齐 */
    replyLabel: { type: String, default: '' },
  },
  emits: ['like', 'reply', 'remove', 'open-thread'],
};
</script>

<style scoped>
.discussion-comment__body {
  word-break: break-word;
  white-space: pre-wrap;
}

.discussion-comment.is-target {
  outline: 2rpx solid var(--accent-color);
  outline-offset: 2rpx;
}

.discussion-comment.is-deleted {
  opacity: 0.72;
}
</style>
