<template>
  <view class="discussion">
    <view class="discussion-head">
      <text class="discussion-title">
        {{ targetType === 'entry' ? '词条讨论' : '乡音留言' }}
      </text>
      <text class="discussion-note">
        讨论用法与证据；留言和点赞不代表词条认证。
      </text>
    </view>

    <BaseLoading
      v-if="commentsLoading"
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
      class="discussion-empty"
    >
      还没有留言，聊聊你听到的乡音。
    </text>
    <view
      v-else
      class="comment-list"
    >
      <view
        v-for="comment in comments"
        :id="`comment-${comment.id}`"
        :key="comment.id"
        :class="['comment-card', { 'comment-card--anchor': isAnchor(comment.id) }]"
      >
        <view class="comment-main">
          <view class="comment-meta">
            <text class="comment-author">
              {{ comment.author_name }}
            </text>
            <text class="comment-time">
              {{ shortTime(comment.created_at) }}
            </text>
          </view>
          <text class="comment-body">
            {{ comment.body }}
          </text>
          <view class="comment-actions">
            <BaseButton
              size="small"
              variant="ghost"
              :text="likeLabel(comment)"
              :disabled="busy"
              @click="toggleCommentLike(comment)"
            />
            <BaseButton
              size="small"
              variant="ghost"
              text="回复"
              @click="openReplies(comment, true)"
            />
            <BaseButton
              v-if="comment.editable"
              size="small"
              variant="danger-ghost"
              text="删除"
              :disabled="busy"
              @click="removeComment(comment)"
            />
          </view>
        </view>

        <view
          v-if="comment.recent_replies && comment.recent_replies.length"
          class="reply-list"
        >
          <view
            v-for="reply in comment.recent_replies"
            :key="reply.id"
            class="reply-item"
          >
            <text class="reply-author">
              {{ reply.author_name }}
            </text>
            <text class="reply-body">
              {{ reply.body }}
            </text>
          </view>
        </view>

        <BaseButton
          v-if="comment.reply_count > 0 || comment.recent_replies?.length"
          class="more-replies"
          size="small"
          variant="ghost"
          :text="comment.reply_count ? `查看全部回复（${comment.reply_count}）` : '查看全部回复'"
          @click="openReplies(comment)"
        />
      </view>
    </view>

    <BaseButton
      v-if="commentsNext"
      variant="ghost"
      text="更多留言"
      :disabled="commentsLoading"
      @click="loadComments(true)"
    />

    <BaseForm
      ref="commentForm"
      :data="form"
      :rules="rules"
    >
      <BaseField
        v-model="form.body"
        name="body"
        label="写一条留言"
        type="textarea"
        placeholder="你那里怎么说？"
      />
      <BaseButton
        text="发送留言"
        :loading="sendingTop"
        @click="sendTopLevel"
      />
    </BaseForm>

    <view
      v-if="sheet.visible"
      class="reply-sheet"
    >
      <view class="reply-sheet__header">
        <BaseButton
          size="small"
          variant="ghost"
          text="返回"
          @click="closeReplies"
        />
        <text class="reply-sheet__title">
          全部回复
        </text>
      </view>
      <PlatformScroll
        container-class="reply-sheet__scroll"
        :scroll-into-view="sheetScrollTarget"
      >
        <view class="reply-sheet__parent">
          <text class="comment-author">
            {{ sheet.parent.author_name }}
          </text>
          <text class="comment-body">
            {{ sheet.parent.body }}
          </text>
        </view>
        <BaseLoading
          v-if="sheetLoading"
          text="正在读取回复…"
        />
        <EmptyState
          v-else-if="sheetError"
          :title="sheetError"
          action-text="重试"
          @action="loadSheetReplies(Boolean(sheetNext))"
        />
        <view
          v-for="reply in sheetReplies"
          :id="`reply-${reply.id}`"
          :key="reply.id"
          :class="['reply-item', { 'reply-item--anchor': isAnchor(reply.id) }]"
        >
          <view class="comment-meta">
            <text class="reply-author">
              {{ reply.author_name }}
            </text>
            <text class="comment-time">
              {{ shortTime(reply.created_at) }}
            </text>
          </view>
          <text
            v-if="reply.reply_to_author_name"
            class="reply-context"
          >
            回复 @{{ reply.reply_to_author_name }}
          </text>
          <text class="reply-body">
            {{ reply.body }}
          </text>
          <view class="comment-actions">
            <BaseButton
              size="small"
              variant="ghost"
              :text="likeLabel(reply)"
              :disabled="busy"
              @click="toggleCommentLike(reply)"
            />
            <BaseButton
              size="small"
              variant="ghost"
              text="回复"
              @click="replyToReply(reply)"
            />
            <BaseButton
              v-if="reply.editable"
              size="small"
              variant="danger-ghost"
              text="删除"
              :disabled="busy"
              @click="removeComment(reply)"
            />
          </view>
        </view>
        <BaseButton
          v-if="sheetNext"
          variant="ghost"
          text="加载更多回复"
          :disabled="sheetLoading"
          @click="loadSheetReplies(true)"
        />
      </PlatformScroll>
      <BaseForm
        ref="replyForm"
        class="reply-sheet__form"
        :data="replyDraft"
        :rules="rules"
      >
        <view
          v-if="sheet.replyTarget"
          class="reply-target"
        >
          <text>
            回复 @{{ sheet.replyTarget.author_name }}
          </text>
          <BaseButton
            size="small"
            variant="ghost"
            text="取消"
            :disabled="sendingReply"
            @click="sheet.replyTarget = null"
          />
        </view>
        <BaseField
          v-model="replyDraft.body"
          name="body"
          :label="sheet.replyTarget
            ? `回复 @${sheet.replyTarget.author_name}`
            : `回复 ${sheet.parent.author_name}`"
          type="textarea"
          placeholder="写下你的回复…"
          :disabled="sendingReply"
          :focus="replyFocused"
          @blur="replyFocused = false"
        />
        <BaseButton
          text="发送回复"
          :loading="sendingReply"
          @click="sendReply"
        />
      </BaseForm>
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import PlatformScroll from '@/components/PlatformScroll.vue';
import { pageResults } from '@/services/entryRecording';
import {
  listComments, createComment, deleteComment, likeComment, commentRequestId,
} from '@/services/recordingSocial';
import { requireAuth } from '@/services/authGuard';
import { notify, confirm } from '@/services/feedback';

export default {
  name: 'DiscussionThread',
  components: {
    BaseButton, BaseField, BaseForm, BaseLoading, EmptyState, PlatformScroll,
  },
  props: {
    targetId: { type: [Number, String], required: true },
    targetType: {
      type: String,
      default: 'recording',
      validator: (value) => ['entry', 'recording'].includes(value),
    },
    anchorCommentId: { type: [Number, String], default: null },
    anchorRootId: { type: [Number, String], default: null },
  },
  data: () => ({
    busy: false,
    comments: [],
    commentsPage: 1,
    commentsNext: null,
    commentsLoading: false,
    commentsError: '',
    localTopLevelComments: [],
    sendingTop: false,
    sendingReply: false,
    form: { body: '' },
    replyDraft: { body: '' },
    rules: { body: [{ required: true, message: '先写下想说的话' }] },
    requestId: '',
    requestSignature: '',
    sheet: { visible: false, parent: null, replyTarget: null },
    sheetReplies: [],
    sheetLocalReplies: [],
    sheetPage: 1,
    sheetNext: null,
    sheetLoading: false,
    sheetError: '',
    sheetRequestId: 0,
    sheetScrollTarget: '',
    replyFocused: false,
  }),
  mounted() {
    this.initializeDiscussion();
  },
  methods: {
    async initializeDiscussion() {
      await this.loadComments();
      await this.focusAnchor();
    },
    auth() {
      return requireAuth(
        this.targetType === 'entry' ? 'interact_entry' : 'interact_recording',
        { [`${this.targetType}Id`]: this.targetId },
      );
    },
    isAnchor(id) {
      return String(id) === String(this.anchorCommentId || '');
    },
    likeLabel(comment) {
      return `${comment.liked ? '已赞' : '赞'} ${comment.like_count || 0}`;
    },
    shortTime(value) {
      return String(value || '').replace('T', ' ').slice(5, 16);
    },
    async loadComments(more = false) {
      if (this.commentsLoading) return null;
      this.commentsLoading = true;
      this.commentsError = '';
      const page = more ? this.commentsPage + 1 : 1;
      try {
        const response = await listComments(this.targetId, page, this.targetType);
        const rows = pageResults(response);
        const localIds = new Set(
          this.localTopLevelComments.map((comment) => String(comment.id)),
        );
        this.comments = this.mergeCommentRows(
          this.localTopLevelComments,
          page === 1 ? rows : [...this.comments, ...rows],
        );
        this.localTopLevelComments = this.comments.filter(
          (comment) => localIds.has(String(comment.id)),
        );
        this.commentsPage = page;
        this.commentsNext = response.next;
        return rows;
      } catch (error) {
        this.commentsError = '留言暂时无法读取';
        return null;
      } finally {
        this.commentsLoading = false;
      }
    },
    mergeCommentRows(...groups) {
      const rows = new Map();
      groups.flat().forEach((comment) => {
        if (comment?.id === undefined || comment?.id === null) return;
        const id = String(comment.id);
        rows.set(id, comment);
      });
      return [...rows.values()].sort((left, right) => {
        const timeDifference = Date.parse(left.created_at || '') - Date.parse(right.created_at || '');
        if (Number.isFinite(timeDifference) && timeDifference !== 0) return timeDifference;
        return Number(left.id) - Number(right.id);
      });
    },
    async loadCommentsUntil(targetId) {
      const found = this.comments.find(
        (comment) => String(comment.id) === String(targetId),
      );
      if (found) return found;
      if (!this.commentsNext) return null;
      const rows = await this.loadComments(true);
      if (!rows?.length) return null;
      return this.loadCommentsUntil(targetId);
    },
    async focusAnchor() {
      const commentId = Number(this.anchorCommentId) || null;
      if (!commentId) return;
      const rootId = Number(this.anchorRootId) || commentId;
      const root = await this.loadCommentsUntil(rootId);
      if (!root) return;
      if (String(rootId) === String(commentId)) {
        await this.scrollToComment(commentId);
        return;
      }
      const opening = this.openReplies(root);
      const requestId = this.sheetRequestId;
      await opening;
      if (await this.loadSheetRepliesUntil(commentId, requestId)
        && requestId === this.sheetRequestId) {
        this.sheetScrollTarget = `reply-${commentId}`;
      }
    },
    async scrollToComment(commentId) {
      await this.$nextTick();
      if (typeof uni !== 'undefined' && typeof uni.pageScrollTo === 'function') {
        uni.pageScrollTo({
          selector: `#comment-${commentId}`,
          duration: 300,
        });
      }
    },
    async openReplies(comment, focusReply = false) {
      this.sheet = { visible: true, parent: comment, replyTarget: null };
      this.sheetReplies = [];
      this.sheetLocalReplies = [];
      this.sheetPage = 1;
      this.sheetNext = null;
      this.sheetLoading = false;
      this.sheetScrollTarget = '';
      this.sheetRequestId += 1;
      this.replyDraft.body = '';
      this.replyFocused = focusReply;
      await this.loadSheetReplies();
    },
    closeReplies() {
      this.sheetRequestId += 1;
      this.sheet = { visible: false, parent: null, replyTarget: null };
      this.sheetScrollTarget = '';
      this.replyFocused = false;
    },
    async loadSheetReplies(more = false, { refreshCurrent = false } = {}) {
      if (this.sheetLoading || !this.sheet.parent) return null;
      const requestId = this.sheetRequestId;
      const localReplies = this.sheetLocalReplies;
      this.sheetLoading = true;
      this.sheetError = '';
      const page = refreshCurrent ? this.sheetPage : (more ? this.sheetPage + 1 : 1);
      try {
        const response = await listComments(
          this.targetId,
          page,
          this.targetType,
          this.sheet.parent.id,
        );
        if (requestId !== this.sheetRequestId) return null;
        const rows = pageResults(response);
        this.sheetReplies = this.mergeCommentRows(
          page === 1 ? this.sheetLocalReplies : this.sheetReplies,
          rows,
        );
        this.sheetPage = page;
        this.sheetNext = response.next;
        if (localReplies === this.sheetLocalReplies) {
          this.applyReplyCount(this.sheet.parent.id, response.count);
        }
        return rows;
      } catch (error) {
        if (requestId !== this.sheetRequestId) return null;
        this.sheetError = '回复暂时无法读取';
        return null;
      } finally {
        if (requestId === this.sheetRequestId) {
          this.sheetLoading = false;
        }
      }
    },
    async loadSheetRepliesUntil(targetId, requestId) {
      if (requestId !== this.sheetRequestId) return false;
      if (this.sheetReplies.some((reply) => String(reply.id) === String(targetId))) {
        return true;
      }
      if (!this.sheetNext) return false;
      const rows = await this.loadSheetReplies(true);
      if (!rows?.length) return false;
      return this.loadSheetRepliesUntil(targetId, requestId);
    },
    async sendTopLevel() {
      if (this.sendingTop || !this.auth()) return;
      if (await this.$refs.commentForm.validate() !== true) return;
      this.sendingTop = true;
      try {
        const comment = await this.submitComment(null);
        this.form.body = '';
        this.localTopLevelComments = this.mergeCommentRows(
          this.localTopLevelComments,
          [comment],
        );
        this.comments = this.mergeCommentRows(this.comments, [comment]);
        notify({ title: '留言已发送' });
      } catch (error) {
        notify({ title: error.message || '发送失败，文字已保留，可重试' });
      } finally {
        this.sendingTop = false;
      }
    },
    replyToReply(reply) {
      if (this.sendingReply) return;
      this.sheet.replyTarget = reply;
      this.replyDraft.body = '';
      this.replyFocused = true;
    },
    async sendReply() {
      if (this.sendingReply || !this.auth() || !this.sheet.parent) return;
      const { parent, replyTarget } = this.sheet;
      const requestId = this.sheetRequestId;
      this.sendingReply = true;
      try {
        if (await this.$refs.replyForm.validate() !== true
          || requestId !== this.sheetRequestId) return;
        const reply = await this.submitComment(parent.id, replyTarget?.id || null);
        this.addSentReply(parent, reply);
        if (requestId === this.sheetRequestId) {
          this.replyDraft.body = '';
          this.sheet.replyTarget = null;
          this.sheetScrollTarget = `reply-${reply.id}`;
        }
        notify({ title: '回复已发送' });
        await this.refreshReplyCount(parent);
      } catch (error) {
        notify({ title: error.message || '回复失败，文字已保留，可重试' });
      } finally {
        this.sendingReply = false;
      }
    },
    addSentReply(parent, reply) {
      const isOpen = this.sheet.parent?.id === parent.id;
      const root = this.comments.find((comment) => comment.id === parent.id)
        || (isOpen ? this.sheet.parent : parent);
      root.recent_replies = this.mergeCommentRows(root.recent_replies || [], [reply]).slice(0, 3);
      if (isOpen) {
        this.sheet.parent = root;
        // 分页位置只由列表响应推进，本次回复可能在尚未读取的页。
        this.sheetLocalReplies = this.mergeCommentRows(this.sheetLocalReplies, [reply]);
        this.sheetReplies = this.mergeCommentRows(this.sheetReplies, [reply]);
      }
    },
    async refreshReplyCount(parent) {
      const requestId = this.sheetRequestId;
      try {
        // 重试可能返回已存在的回复，按服务端总数更新父评论。
        const { count } = await listComments(this.targetId, 1, this.targetType, parent.id, {
          pageSize: 1,
        });
        this.applyReplyCount(parent.id, count);
        if (requestId === this.sheetRequestId
          && this.sheet.parent?.id === parent.id
          && !this.sheetNext
          && Number.isInteger(count)
          && count > this.sheetReplies.length) {
          // 旧末页可能同时缺少并发追加的回复和新的下一页入口。
          await this.loadSheetReplies(false, { refreshCurrent: true });
        }
      } catch (error) {
        // 已发送的回复可以继续查看，下次读取留言时会更新总数。
      }
    },
    applyReplyCount(parentId, count) {
      if (!Number.isInteger(count)) return;
      const root = this.comments.find((comment) => comment.id === parentId);
      if (root) root.reply_count = count;
      if (this.sheet.parent?.id === parentId) this.sheet.parent.reply_count = count;
    },
    async submitComment(parentId, replyToId = null) {
      const body = (parentId ? this.replyDraft.body : this.form.body).trim();
      const signature = JSON.stringify([body, parentId, replyToId]);
      if (signature !== this.requestSignature) {
        this.requestSignature = signature;
        this.requestId = commentRequestId();
      }
      const comment = await createComment({
        [`${this.targetType}_id`]: this.targetId,
        parent_id: parentId,
        reply_to_id: replyToId,
        body,
        client_id: this.requestId,
      }, this.targetType);
      this.requestSignature = '';
      this.requestId = '';
      return comment;
    },
    async toggleCommentLike(comment) {
      if (this.busy || !this.auth()) return;
      this.busy = true;
      try {
        Object.assign(comment, await likeComment(comment.id, !comment.liked, this.targetType));
      } catch (error) {
        notify({ title: '点赞失败，请重试' });
      } finally {
        this.busy = false;
      }
    },
    async removeComment(comment) {
      if (!(await confirm({
        title: '删除这条留言？',
        content: '这条留言及其回复将不再展示。',
        danger: true,
      }))) return;
      this.busy = true;
      try {
        await deleteComment(comment.id, this.targetType);
        this.localTopLevelComments = this.localTopLevelComments.filter(
          (row) => String(row.id) !== String(comment.id),
        );
        await this.loadComments();
        if (this.sheet.parent && this.sheet.parent.id === comment.id) {
          this.closeReplies();
        } else if (this.sheet.visible) {
          this.sheetLocalReplies = this.sheetLocalReplies.filter(
            (row) => String(row.id) !== String(comment.id),
          );
          await this.loadSheetReplies();
        }
      } catch (error) {
        notify({ title: '删除失败，请重试' });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style scoped>
.discussion {
  display: grid;
  gap: var(--space-3);
}

.discussion-head {
  display: grid;
  gap: var(--space-1);
}

.discussion-title {
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 900;
}

.discussion-note,
.discussion-empty {
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.comment-list {
  display: grid;
  gap: var(--space-2);
}

.comment-card,
.reply-sheet__parent {
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.comment-card--anchor {
  border-color: var(--accent-color);
  box-shadow: inset 6rpx 0 0 var(--accent-color);
}

.comment-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.comment-author,
.reply-author {
  color: var(--text-color);
  font-size: var(--font-size-sm);
  font-weight: 800;
}

.comment-time {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.comment-body,
.reply-body {
  display: block;
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  font-size: var(--font-size-base);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.comment-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.reply-context {
  display: block;
  margin-top: 4rpx;
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.reply-target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-sm);
}

.reply-list {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2);
  border-left: 4rpx solid var(--border-color);
  background: var(--surface-subtle-color);
}

.reply-item {
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--surface-color);
}

.reply-item--anchor {
  border: 1px solid var(--accent-color);
  background: var(--accent-subtle-color);
}

.more-replies {
  margin-top: var(--space-2);
}

.reply-sheet {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: var(--page-color);
}

.reply-sheet__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-color);
}

.reply-sheet__title {
  color: var(--text-color);
  font-size: var(--font-size-base);
  font-weight: 800;
}

.reply-sheet :deep(.reply-sheet__scroll) {
  flex: 1;
  min-height: 0;
  padding: var(--space-3);
  box-sizing: border-box;
}

.reply-sheet__scroll .reply-item {
  margin-bottom: var(--space-2);
}

.reply-sheet__form {
  flex-shrink: 0;
  padding: var(--space-2) var(--space-3) calc(var(--space-2) + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border-color);
  background: var(--surface-color);
}
</style>
