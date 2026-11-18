<template>
  <PageShell
    title="发送消息"
    content-class="mail-send-content"
  >
    <view class="compose-intro">
      <view class="eyebrow">
        站内消息
      </view>
      <view class="intro-title">
        写一则清楚、友好的消息
      </view>
      <view class="intro-copy">
        对方会在消息中心收到提醒；请勿填写手机号等敏感信息。
      </view>
    </view>

    <BaseForm
      ref="form"
      :data="Notification"
      :rules="rules"
    >
      <SectionBlock title="收件人">
        <view
          v-if="recipientResolving"
          class="recipient-loading"
        >
          <BaseLoading text="正在确认收件人…" />
        </view>
        <view
          v-else-if="recipientLocked"
          class="recipient-card"
        >
          <image
            v-if="selectedRecipient.avatar"
            class="recipient-avatar recipient-avatar--image"
            :src="selectedRecipient.avatar"
            mode="aspectFill"
            :alt="recipientLabel"
          />
          <view
            v-else
            class="recipient-avatar"
            aria-hidden="true"
          >
            {{ recipientInitial }}
          </view>
          <view class="recipient-copy">
            <view class="recipient-name">
              {{ recipientLabel }}
            </view>
            <view class="recipient-hint">
              {{ recipientHint }}
            </view>
          </view>
          <BaseButton
            class="recipient-change"
            variant="ghost"
            size="small"
            text="重新选择"
            aria-label="重新选择收件人"
            @click="clearRecipientSelection"
          />
        </view>
        <template v-else>
          <view
            class="recipient-search-region"
            role="search"
            aria-label="查找收件人"
          >
            <TSearch
              v-model="recipientQuery"
              class="recipient-search"
              action="搜索"
              shape="round"
              :maxlength="100"
              placeholder="搜索昵称、用户名或用户编号"
              @change="handleRecipientQueryChange"
              @submit="searchRecipients"
              @action-click="searchRecipients"
            />
          </view>
          <view class="field-hint">
            输入你记得的信息即可，选择前会显示昵称、用户名和编号供确认。
          </view>

          <BaseLoading
            v-if="recipientSearchStatus === 'loading'"
            text="正在查找用户…"
          />
          <view
            v-else-if="recipientResults.length"
            class="recipient-results"
            role="list"
            aria-label="收件人搜索结果"
          >
            <TCell
              v-for="user in recipientResults"
              :key="user.id"
              class="recipient-result"
              :title="recipientName(user)"
              :description="recipientMeta(user)"
              note="选择"
              hover
              :bordered="false"
              role="button"
              tabindex="0"
              :aria-label="`选择收件人 ${recipientName(user)}，${recipientMeta(user)}`"
              @click="selectRecipient(user)"
              @keydown.enter.space.prevent="selectRecipient(user)"
            >
              <template #image>
                <image
                  v-if="user.avatar"
                  class="recipient-avatar recipient-avatar--image"
                  :src="user.avatar"
                  mode="aspectFill"
                  :alt="recipientName(user)"
                />
                <view
                  v-else
                  class="recipient-avatar"
                  aria-hidden="true"
                >
                  {{ recipientInitialFor(user) }}
                </view>
              </template>
            </TCell>
          </view>
          <view
            v-else-if="recipientSearchStatus === 'empty'"
            class="recipient-search-state"
          >
            没有找到匹配的用户。可换用昵称、用户名或完整编号再试。
          </view>
          <view
            v-else-if="recipientSearchStatus === 'error'"
            class="recipient-search-state recipient-search-state--error"
          >
            <view>暂时无法搜索用户，请稍后重试。</view>
            <BaseButton
              variant="ghost"
              size="small"
              text="重新搜索"
              @click="searchRecipients"
            />
          </view>

          <view class="recipient-divider">
            <view class="recipient-divider-line" />
            <view class="recipient-divider-label">
              或联系平台
            </view>
            <view class="recipient-divider-line" />
          </view>
          <TCell
            class="recipient-result recipient-admin"
            title="平台管理员"
            description="产品问题、违规反馈与服务咨询"
            note="选择"
            hover
            :bordered="false"
            role="button"
            tabindex="0"
            aria-label="选择平台管理员作为收件人"
            @click="selectAdministrator"
            @keydown.enter.space.prevent="selectAdministrator"
          >
            <template #image>
              <view
                class="recipient-avatar"
                aria-hidden="true"
              >
                管
              </view>
            </template>
          </TCell>
        </template>
        <view
          v-if="recipientError"
          class="recipient-error"
          role="alert"
        >
          {{ recipientError }}
        </view>
      </SectionBlock>

      <SectionBlock title="消息内容">
        <BaseField
          v-model="Notification.title"
          name="title"
          label="标题"
          required
          :error="fieldErrors.title"
          :maxlength="80"
          placeholder="一句话说明来意"
          @input="clearFieldError('title')"
        />
        <BaseField
          v-model="Notification.content"
          name="content"
          label="正文"
          type="textarea"
          required
          :error="fieldErrors.content"
          :maxlength="1000"
          indicator
          placeholder="把需要对方了解的内容写在这里"
          @input="clearFieldError('content')"
        />
      </SectionBlock>

      <view class="submit-panel">
        <view class="submit-note">
          发送后将返回消息中心。
        </view>
        <BaseButton
          block
          aria-label="提交"
          :loading="submitting"
          :disabled="submitting"
          :text="submitting ? '正在发送…' : '发送消息'"
          @click="sendEmail"
        />
      </view>
    </BaseForm>
  </PageShell>
</template>

<script>
import TCell from '@tdesign/uniapp/cell/cell.vue';
import TSearch from '@tdesign/uniapp/search/search.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import PageShell from '@/components/PageShell.vue';
import SectionBlock from '@/components/SectionBlock.vue';
import { notifyError, notifySuccess } from '@/services/feedback';
import { contentFeedbackDraft } from '@/services/contentFeedback';
import { postMail } from '@/services/mail';
import { openPage, ROUTES } from '@/services/navigation';
import { searchUsers } from '@/services/user';

function blankNotification() {
  return {
    recipients: [''],
    title: '',
    content: '',
  };
}

function fieldMessage(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return fieldMessage(value[0]);
  return value.message || value.detail || '';
}

export function mailApiErrors(error) {
  return ['recipients', 'title', 'content'].reduce((result, field) => {
    const message = fieldMessage(error?.data?.[field]);
    return message ? { ...result, [field]: message } : result;
  }, {});
}

export default {
  name: 'SendMailPage',
  components: {
    BaseButton,
    BaseField,
    BaseForm,
    BaseLoading,
    PageShell,
    SectionBlock,
    TCell,
    TSearch,
  },
  inheritAttrs: false,
  data() {
    return {
      Notification: blankNotification(),
      fieldErrors: {},
      selectedRecipient: null,
      recipientError: '',
      recipientQuery: '',
      recipientSearchedQuery: '',
      recipientResults: [],
      recipientSearchStatus: 'idle',
      recipientSearchRun: 0,
      recipientResolving: false,
      rules: {
        title: [
          { required: true, message: '请输入消息标题' },
          { whitespace: true, message: '请输入消息标题' },
        ],
        content: [
          { required: true, message: '请输入消息正文' },
          { whitespace: true, message: '请输入消息正文' },
        ],
      },
      submitting: false,
    };
  },
  computed: {
    recipientLocked() {
      return Boolean(this.selectedRecipient);
    },
    recipientId() {
      return String(this.Notification.recipients[0] || '').trim();
    },
    recipientLabel() {
      return this.recipientName(this.selectedRecipient);
    },
    recipientHint() {
      return this.recipientMeta(this.selectedRecipient);
    },
    recipientInitial() {
      return this.recipientInitialFor(this.selectedRecipient);
    },
  },
  onLoad(options = {}) {
    this.applyRecipient(options.id ?? options.recipient);
    const feedbackDraft = contentFeedbackDraft(options);
    if (feedbackDraft) {
      Object.assign(this.Notification, feedbackDraft);
      return;
    }
    if (options.title) this.Notification.title = decodeURIComponent(options.title);
    if (options.content) {
      this.Notification.content = decodeURIComponent(options.content);
    }
  },
  methods: {
    applyRecipient(id) {
      if (id === undefined || id === null || id === '') return Promise.resolve();
      const recipient = String(id).trim();
      if (recipient === '-1') {
        this.selectAdministrator();
        return Promise.resolve();
      }
      if (!/^[1-9]\d*$/.test(recipient)) return Promise.resolve();
      return this.resolveRecipient(recipient);
    },
    async resolveRecipient(id) {
      this.recipientSearchRun += 1;
      const run = this.recipientSearchRun;
      this.recipientResolving = true;
      this.recipientError = '';
      try {
        const users = await searchUsers(id, 8);
        if (run !== this.recipientSearchRun) return;
        const recipient = users.find((user) => String(user.id) === String(id));
        if (!recipient) throw new Error('missing recipient');
        this.selectRecipient(recipient);
      } catch (_error) {
        if (run !== this.recipientSearchRun) return;
        this.recipientQuery = String(id);
        this.recipientError = '无法确认链接中的收件人，请重新搜索。';
      } finally {
        if (run === this.recipientSearchRun) this.recipientResolving = false;
      }
    },
    recipientName(user) {
      if (!user) return '';
      return user.nickname || user.username || `用户 #${user.id}`;
    },
    recipientMeta(user) {
      if (!user) return '';
      if (String(user.id) === '-1') return '产品问题、违规反馈与服务咨询';
      return [
        user.username ? `@${user.username}` : '',
        `用户 #${user.id}`,
        user.primary_dialect?.name || '',
      ].filter(Boolean).join(' · ');
    },
    recipientInitialFor(user) {
      if (!user) return '';
      if (String(user.id) === '-1') return '管';
      return String(user.nickname || user.username || '#').trim().slice(0, 1) || '#';
    },
    selectRecipient(user) {
      if (!user?.id) return;
      this.selectedRecipient = { ...user };
      this.Notification.recipients = [String(user.id)];
      this.recipientQuery = '';
      this.recipientSearchedQuery = '';
      this.recipientResults = [];
      this.recipientSearchStatus = 'idle';
      this.recipientError = '';
      this.clearFieldError('recipients');
    },
    selectAdministrator() {
      this.selectRecipient({
        id: -1,
        username: 'administrator',
        nickname: '平台管理员',
        avatar: '',
        primary_dialect: null,
      });
    },
    clearRecipientSelection() {
      this.recipientSearchRun += 1;
      this.selectedRecipient = null;
      this.Notification.recipients = [''];
      this.recipientQuery = '';
      this.recipientSearchedQuery = '';
      this.recipientResults = [];
      this.recipientSearchStatus = 'idle';
      this.recipientError = '';
      this.recipientResolving = false;
    },
    handleRecipientQueryChange(event) {
      this.recipientQuery = String(event?.value ?? event?.detail?.value ?? '').trimStart();
      if (this.recipientQuery.trim() !== this.recipientSearchedQuery) {
        this.recipientResults = [];
        this.recipientSearchStatus = 'idle';
      }
      this.recipientError = '';
    },
    async searchRecipients(event) {
      const eventValue = event?.value ?? event?.detail?.value;
      if (eventValue !== undefined) this.recipientQuery = String(eventValue);
      const query = this.recipientQuery.trim();
      if (!query) {
        this.recipientSearchedQuery = '';
        this.recipientResults = [];
        this.recipientSearchStatus = 'idle';
        this.recipientError = '请输入昵称、用户名或用户编号。';
        return;
      }

      this.recipientSearchRun += 1;
      const run = this.recipientSearchRun;
      this.recipientSearchedQuery = query;
      this.recipientError = '';
      this.recipientSearchStatus = 'loading';
      try {
        const users = await searchUsers(query, 8);
        if (run !== this.recipientSearchRun) return;
        this.recipientResults = users;
        this.recipientSearchStatus = users.length ? 'results' : 'empty';
      } catch (_error) {
        if (run !== this.recipientSearchRun) return;
        this.recipientResults = [];
        this.recipientSearchStatus = 'error';
      }
    },
    clearFieldError(field) {
      if (this.fieldErrors[field]) delete this.fieldErrors[field];
    },
    payload() {
      return {
        recipients: [String(this.Notification.recipients[0]).trim()],
        title: this.Notification.title.trim(),
        content: this.Notification.content.trim(),
      };
    },
    async sendEmail() {
      if (this.submitting) return;
      const hasRecipient = Boolean(this.selectedRecipient);
      this.recipientError = hasRecipient ? '' : '请先搜索并选择收件人。';
      const valid = await this.$refs.form.validate();
      if (!hasRecipient || valid !== true) return;

      this.submitting = true;
      try {
        await postMail(this.payload(), true);
        notifySuccess('消息发送成功');
        const recipient = this.selectedRecipient;
        this.Notification = blankNotification();
        if (recipient) this.Notification.recipients = [String(recipient.id)];
        this.fieldErrors = {};
        setTimeout(() => openPage(ROUTES.mails, {}, { replace: true }), 500);
      } catch (error) {
        const errors = mailApiErrors(error);
        this.recipientError = errors.recipients || '';
        delete errors.recipients;
        this.fieldErrors = errors;
        if (!this.recipientError && !Object.keys(errors).length) {
          notifyError(error, '消息发送失败');
        }
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
:deep(.mail-send-content) {
  padding: var(--space-3) 28rpx var(--space-5);
}

.compose-intro {
  margin-bottom: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--accent-color);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
}

.eyebrow {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
}

.intro-title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-xl);
  font-weight: 900;
  line-height: 1.35;
}

.intro-copy,
.field-hint,
.submit-note,
.recipient-hint {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.intro-copy {
  margin-top: var(--space-1);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
}

.recipient-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 96rpx;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
}

.recipient-loading {
  min-height: 120rpx;
}

.recipient-search {
  display: block;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
}

:deep(.recipient-search .t-search) {
  background: var(--surface-color);
}

:deep(.recipient-search .t-search__input-box) {
  min-height: 88rpx;
  background: var(--surface-subtle-color);
}

:deep(.recipient-search .t-search__search-action) {
  color: var(--accent-color);
  font-weight: 700;
}

.recipient-results,
.recipient-admin {
  overflow: hidden;
  margin-top: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
}

.recipient-result {
  display: block;
  min-height: 104rpx;
  --td-cell-bg-color: var(--surface-color);
  --td-cell-horizontal-padding: var(--space-3);
  --td-cell-vertical-padding: var(--space-2);
}

.recipient-result + .recipient-result {
  border-top: 1px solid var(--border-color);
}

:deep(.recipient-result .t-cell__note) {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.recipient-search-state {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  text-align: center;
}

.recipient-search-state--error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: var(--danger-color);
}

.recipient-divider {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-4) 0 var(--space-2);
}

.recipient-divider-line {
  height: 1px;
  flex: 1;
  background: var(--border-color);
}

.recipient-divider-label {
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.recipient-admin {
  margin-top: 0;
}

.recipient-avatar {
  display: flex;
  width: 68rpx;
  height: 68rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-size: var(--font-size-base);
  font-weight: 900;
}

.recipient-avatar--image {
  display: block;
  object-fit: cover;
}

.recipient-copy {
  min-width: 0;
  flex: 1;
}

.recipient-name {
  color: var(--text-color);
  font-size: var(--font-size-base);
  font-weight: 800;
}

.recipient-change {
  flex: 0 0 auto;
}

.field-hint {
  margin-top: var(--space-2);
}

.recipient-error {
  margin-top: var(--space-2);
  color: var(--danger-color);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.submit-panel {
  padding-top: var(--space-1);
}

.submit-note {
  margin-bottom: var(--space-2);
  text-align: center;
}
</style>
