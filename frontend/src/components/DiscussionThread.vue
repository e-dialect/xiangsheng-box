<template>
  <view class="box-panel discussion-thread">
    <template v-if="showHeading">
      <text class="box-heading">
        {{ heading || (targetType === 'entry' ? '词条讨论' : '乡音留言') }}
      </text><text class="box-note">
        讨论用法与证据；留言和点赞不代表词条认证。
      </text>
    </template>
    <BaseLoading
      v-if="commentsLoading && !comments.length"
      text="正在读取留言…"
    />
    <EmptyState
      v-else-if="commentsError"
      :title="commentsError"
      action-text="重试"
      @action="loadComments"
    />
    <text
      v-else-if="!comments.length"
      class="box-note"
    >
      {{ rootId ? '还没有回复，说说你的看法。' : '还没有留言，聊聊你听到的乡音。' }}
    </text>
    <scroll-view
      v-if="externalComposer"
      class="discussion-thread__scroll"
      scroll-y
      :scroll-into-view="scrollTarget"
      :scroll-with-animation="true"
    >
      <DiscussionCommentCard
        v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :busy="busy"
        :highlighted="highlightId === comment.id"
        :reply-label="replyLabel(comment)"
        @like="toggleCommentLike"
        @reply="openReply"
        @remove="removeComment"
        @open-thread="$emit('open-thread', $event)"
      />
    </scroll-view>
    <view
      v-else
      class="discussion-thread__list"
    >
      <DiscussionCommentCard
        v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :busy="busy"
        :highlighted="highlightId === comment.id"
        :reply-label="replyLabel(comment)"
        @like="toggleCommentLike"
        @reply="openReply"
        @remove="removeComment"
        @open-thread="$emit('open-thread', $event)"
      />
    </view>
    <BaseButton
      v-if="commentsNext"
      variant="ghost"
      text="更多留言"
      :disabled="commentsLoading"
      @click="loadComments(true)"
    />
    <slot
      v-if="externalComposer"
      name="composer"
      :reply-target="reply"
      :sending="sending"
      :submit="submitExternal"
      :cancel-reply="cancelReply"
    />
    <BaseForm
      v-else
      ref="commentForm"
      :data="form"
      :rules="rules"
    >
      <view
        v-if="reply"
        class="box-actions"
      >
        <text>回复 {{ reply.author_name }}</text><BaseButton
          size="small"
          variant="ghost"
          text="取消回复"
          @click="reply = null"
        />
      </view>
      <BaseField
        v-model="form.body"
        name="body"
        label="写一条留言"
        type="textarea"
        placeholder="你那里怎么说？"
      />
      <BaseButton
        text="发送留言"
        :loading="sending"
        @click="send"
      />
    </BaseForm>
  </view>
</template>
<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import DiscussionCommentCard from '@/components/DiscussionCommentCard.vue';
import { pageResults } from '@/services/entryRecording';
import {
  listComments, createComment, deleteComment, likeComment, commentRequestId,
} from '@/services/recordingSocial';
import { requireAuth } from '@/services/authGuard';
import { notify, confirm } from '@/services/feedback';

export default {
  components: {
    BaseButton, BaseForm, BaseField, BaseLoading, EmptyState, DiscussionCommentCard,
  },
  props: {
    targetId: { type: [Number, String], required: true },
    targetType: { type: String, default: 'recording', validator: (value) => ['entry', 'recording'].includes(value) },
    /* 有值时列出该一级评论的回复，否则列出顶层评论 */
    rootId: { type: [Number, String], default: null },
    /* true 时隐藏内置输入框，改由 composer 插槽提供（面板底部固定输入区） */
    externalComposer: { type: Boolean, default: false },
    /* 从通知进入时高亮并滚动到该条评论 */
    initialCommentId: { type: [Number, String], default: null },
    /* 并入 auth intent，登录返回后仍能回到同一条讨论 */
    authContext: { type: Object, default: () => ({}) },
    heading: { type: String, default: '' },
    showHeading: { type: Boolean, default: true },
    pageSize: { type: Number, default: 0 },
  },
  emits: ['sent', 'open-thread', 'count-change', 'reply-change', 'loaded'],
  data: () => ({
    busy: false,
    comments: [],
    commentsPage: 1,
    commentsNext: null,
    commentsLoading: false,
    commentsError: '',
    sending: false,
    reply: null,
    requestId: '',
    requestSignature: '',
    requestToken: 0,
    scrollTarget: '',
    highlightId: null,
    highlightTimer: null,
    form: { body: '' },
    rules: { body: [{ required: true, message: '先写下想说的话' }] },
  }),
  mounted() { this.loadComments(); },
  beforeUnmount() { if (this.highlightTimer) clearTimeout(this.highlightTimer); },
  methods: {
    auth() {
      return requireAuth(this.targetType === 'entry' ? 'interact_entry' : 'interact_recording', {
        [`${this.targetType}Id`]: this.targetId,
        ...this.authContext,
      });
    },
    replyLabel(comment) {
      if (comment.reply_to_author_name) return `回复 ${comment.reply_to_author_name}`;
      if (!comment.parent_id) return '';
      const target = this.comments.find((item) => item.id === comment.parent_id);
      return `回复 ${target?.author_name || '前面的留言'}`;
    },
    async loadComments(more = false) {
      if (this.commentsLoading) return;
      const token = this.requestToken + 1;
      this.requestToken = token;
      this.commentsLoading = true;
      this.commentsError = '';
      const page = more === true ? this.commentsPage + 1 : 1;
      try {
        const scope = [this.targetId, page, this.targetType, this.rootId, this.pageSize];
        const response = await listComments(...scope);
        if (token !== this.requestToken) return;
        this.comments = page === 1
          ? pageResults(response) : [...this.comments, ...pageResults(response)];
        this.commentsPage = page;
        this.commentsNext = response.next;
        this.$emit('count-change', {
          total: response.count ?? this.comments.length,
          rootId: this.rootId,
        });
        this.$emit('loaded', this.comments);
        if (page === 1 && this.initialCommentId) this.scrollToComment(this.initialCommentId);
      } catch (error) {
        if (token === this.requestToken) this.commentsError = '留言暂时无法读取';
      } finally {
        this.commentsLoading = false;
      }
    },
    replyTo(comment) {
      if (this.auth()) this.reply = comment;
    },
    openReply(comment) {
      if (!this.auth()) return;
      this.reply = comment;
      this.$emit('reply-change', comment);
    },
    cancelReply() {
      this.reply = null;
      this.$emit('reply-change', null);
    },
    async submitComment({ body, parentId = null, replyToId = null }) {
      const trimmed = String(body || '').trim();
      if (this.sending) return false;
      if (!trimmed) {
        notify({ title: '先写下想说的话' });
        return false;
      }
      this.sending = true;
      const signature = JSON.stringify([trimmed, parentId, replyToId]);
      if (signature !== this.requestSignature) {
        this.requestSignature = signature;
        this.requestId = commentRequestId();
      }
      try {
        const comment = await createComment({
          [`${this.targetType}_id`]: this.targetId,
          parent_id: parentId || null,
          reply_to_id: replyToId || null,
          body: trimmed,
          client_id: this.requestId,
        }, this.targetType);
        this.requestSignature = '';
        this.requestId = '';
        await this.loadComments();
        this.$emit('sent', comment);
        notify({ title: parentId ? '回复已发送' : '留言已发送' });
        return true;
      } catch (error) {
        notify({
          title: error.message || '发送失败，文字已保留，可重试',
        });
        return false;
      } finally {
        this.sending = false;
      }
    },
    /* 面板的底部输入框走这里：正文由面板持有，失败时正文自然保留 */
    submitExternal(body, options = {}) {
      if (!this.auth()) return false;
      return this.submitComment({
        body,
        parentId: options.parentId || null,
        replyToId: options.replyToId || null,
      });
    },
    async send() {
      if (this.sending || !this.auth()) return;
      if (await this.$refs.commentForm.validate() !== true) return;
      const sent = await this.submitComment({
        body: this.form.body,
        parentId: this.reply?.id || null,
      });
      if (sent) {
        this.form.body = '';
        this.reply = null;
      }
    },
    /* 锚点可能在第二页之后，顺序翻页直到出现（最多 3 页） */
    async ensureVisible(id) {
      const wanted = Number(id);
      for (let round = 0; round < 3; round += 1) {
        if (this.comments.some((item) => item.id === wanted)) return true;
        if (!this.commentsNext) break;
        // eslint-disable-next-line no-await-in-loop
        await this.loadComments(true);
      }
      return this.comments.some((item) => item.id === wanted);
    },
    async scrollToComment(id) {
      if (!id) return;
      await this.ensureVisible(id);
      this.highlightId = Number(id);
      /* 同值不会触发更新，先清空再在下一帧赋值 */
      this.scrollTarget = '';
      this.$nextTick(() => { this.scrollTarget = `comment-${id}`; });
      if (this.highlightTimer) clearTimeout(this.highlightTimer);
      this.highlightTimer = setTimeout(() => { this.highlightId = null; }, 2400);
    },
    async toggleCommentLike(comment) {
      if (this.busy || !this.auth()) return;
      this.busy = true;
      try {
        Object.assign(comment, await likeComment(comment.id, !comment.liked, this.targetType));
      } catch (error) {
        notify({
          title: '点赞失败，请重试',
        });
      } finally {
        this.busy = false;
      }
    },
    async removeComment(comment) {
      if (!(await confirm({
        title: '删除这条留言？',
        content: '删除后仍可看到已有的回复，但不再接受新的回复。',
        danger: true,
      }))) return;
      this.busy = true;
      try {
        await deleteComment(comment.id, this.targetType);
        await this.loadComments();
      } catch (error) {
        notify({
          title: '删除失败，请重试',
        });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
<style src="@/styles/collections.scss" lang="scss"></style>
<style scoped>
.discussion-thread {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.discussion-thread__scroll {
  flex: 1;
  min-height: 0;
}
</style>
