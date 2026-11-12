<template>
  <PageShell
    title="忘记密码"
    :show-back="true"
    content-class="auth-page"
  >
    <AuthJourney
      eyebrow="找回乡声档案"
      :title="journeyTitle"
      :lead="journeyLead"
      :step="steps + 1"
      :step-total="2"
      :step-label="steps === 0 ? '确认账号' : '设置新密码'"
    >
      <view
        v-if="steps === 0"
        class="auth-form"
      >
        <BaseField
          v-model="username"
          name="username"
          label="用户名"
          placeholder="请输入用户名"
          required
          :error="errors.username"
          @input="clearFieldError('username')"
        />
        <BaseButton
          block
          :loading="checking"
          @click="next"
        >
          下一步
        </BaseButton>
      </view>

      <view
        v-else
        class="auth-form"
      >
        <BaseField
          v-model="password"
          name="password"
          label="新密码"
          type="password"
          placeholder="请输入新密码"
          required
          :error="errors.password"
          @input="clearFieldError('password')"
        />
        <BaseField
          v-model="repeatedPassword"
          name="repeatedPassword"
          label="重复密码"
          type="password"
          placeholder="请重复新密码"
          required
          :error="errors.repeatedPassword"
          @input="clearFieldError('repeatedPassword')"
        />
        <view
          class="identity-proof"
          role="note"
        >
          <view class="identity-proof__label">
            正在找回
          </view>
          <view class="identity-proof__value">
            {{ username }}
          </view>
          <view class="identity-proof__note">
            验证码将发送到 {{ emailMasked }}
          </view>
        </view>

        <view class="code-row">
          <view class="code-field">
            <BaseField
              v-model="code"
              name="code"
              label="验证码"
              placeholder="请输入验证码"
              required
              :error="errors.code"
              @input="clearFieldError('code')"
            />
          </view>
          <BaseButton
            class="code-button"
            variant="ghost"
            size="medium"
            :disabled="Boolean(codeRequest)"
            @click="getCode"
          >
            {{ sendCodeMsg }}
          </BaseButton>
        </view>
        <BaseButton
          block
          :loading="submitting"
          @click="reset"
        >
          重置密码
        </BaseButton>
        <t-button
          class="auth-step-back"
          theme="default"
          variant="text"
          size="medium"
          role="button"
          tabindex="0"
          aria-label="返回修改用户名"
          @click="returnToAccountStep"
          @keydown.enter.space.prevent="returnToAccountStep"
        >
          返回修改用户名
        </t-button>
      </view>
    </AuthJourney>
  </PageShell>
</template>

<script>
import TButton from '@tdesign/uniapp/button/button.vue';
import AuthJourney from '@/pages/login/components/AuthJourney.vue';
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import {
  getEmailByUsername,
  requestPasswordResetCode,
  resetPassword,
} from '@/services/user';
import { notify, notifySuccess } from '@/services/feedback';
import { applyFieldErrors, readableErrorMessage } from '@/utils/apiError';
import getCodeMixin from './mixin/getCodeMixin';

export default {
  name: 'ForgetPage',
  components: {
    AuthJourney, PageShell, BaseButton, BaseField, TButton,
  },
  mixins: [getCodeMixin],
  data() {
    return {
      username: '',
      emailMasked: '',
      steps: 0,
      password: '',
      repeatedPassword: '',
      code: '',
      checking: false,
      submitting: false,
      errors: {
        username: '',
        password: '',
        repeatedPassword: '',
        code: '',
      },
    };
  },
  onLoad(query) {
    this.username = String(query?.username || '').trim();
  },
  computed: {
    codeDestination() {
      return this.steps === 1 ? this.username.trim() : '';
    },
    journeyTitle() {
      return this.steps === 0 ? '先确认你的账号' : '换一把新的钥匙';
    },
    journeyLead() {
      if (this.steps === 0) return '先找到账号，再通过已绑定的邮箱验证身份。不会展示完整邮箱。';
      return '设置新密码后，你的录音、收藏和贡献记录都会原样保留。';
    },
  },
  methods: {
    returnToAccountStep() {
      this.steps = 0;
      this.emailMasked = '';
      this.password = '';
      this.repeatedPassword = '';
      this.code = '';
      this.errors.password = '';
      this.errors.repeatedPassword = '';
      this.errors.code = '';
    },
    clearFieldError(field) {
      this.errors[field] = '';
    },
    async next() {
      if (this.checking) return;
      const username = String(this.username || '').trim();
      this.errors.username = username ? '' : '请输入用户名';
      if (this.errors.username) return;

      this.checking = true;
      try {
        const res = await getEmailByUsername(username);
        if (this.username.trim() !== username) return;
        this.username = username;
        this.emailMasked = res.email_masked;
        this.steps = 1;
      } catch (error) {
        if (this.username.trim() !== username) return;
        if (!applyFieldErrors(this.errors, error, ['username'])) {
          const title = readableErrorMessage(error, {
            404: '没有找到该账号',
          }) || '查询失败';
          uni.showToast({ title, icon: 'none' });
        }
      } finally {
        this.checking = false;
      }
    },
    async getCode() {
      const username = this.codeDestination;
      await this.sendVerificationCode(
        () => requestPasswordResetCode(username),
        (response) => {
          this.emailMasked = response.email_masked;
          notifySuccess('验证码已发送');
        },
        (error) => {
          if (!applyFieldErrors(this.errors, error, ['username', 'code'])) {
            notify({ title: readableErrorMessage(error) || '验证码发送失败' });
          }
        },
      );
    },
    async reset() {
      const password = String(this.password || '');
      const repeatedPassword = String(this.repeatedPassword || '');
      const code = String(this.code || '').trim();

      this.errors.password = password ? '' : '请输入新密码';
      this.errors.repeatedPassword = repeatedPassword ? '' : '请重复新密码';
      this.errors.code = code ? '' : '请输入验证码';
      if (this.errors.password || this.errors.repeatedPassword || this.errors.code) return;

      if (password.length < 6 || password.length > 32) {
        this.errors.password = '密码长度 6 - 32 位';
        return;
      }
      if (repeatedPassword !== password) {
        this.errors.repeatedPassword = '两次密码不一致';
        return;
      }

      this.submitting = true;
      try {
        await resetPassword(this.username, password, code);
        uni.showToast({ title: '重置成功', icon: 'success', duration: 2000 });
        uni.navigateBack({ delta: 1 });
      } catch (error) {
        if (!applyFieldErrors(this.errors, error, ['password', 'code'])) {
          uni.showToast({ title: readableErrorMessage(error) || '重置失败', icon: 'none' });
        }
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.identity-proof {
  padding: 20rpx 22rpx;
  border-left: 5rpx solid var(--accent-color);
  background: var(--accent-subtle-color);
}

.identity-proof__label {
  color: var(--muted-color);
  font-size: 20rpx;
  letter-spacing: 2rpx;
}

.identity-proof__value {
  margin-top: 6rpx;
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
  overflow-wrap: anywhere;
}

.identity-proof__note {
  margin-top: 6rpx;
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.auth-step-back {
  display: flex;
  width: 100%;
  margin: var(--space-1) 0 0;
  --td-button-medium-font: 600 24rpx / 36rpx var(--td-font-family);
  --td-button-medium-height: 80rpx;
  --td-button-default-color: var(--muted-color);
  --td-button-default-text-active-bg-color: var(--surface-subtle-color);
}

:deep(.auth-page) {
  background: linear-gradient(
    180deg,
    var(--accent-subtle-color) 0%,
    var(--page-color) 36%,
    var(--surface-subtle-color) 100%
  );
}
</style>
