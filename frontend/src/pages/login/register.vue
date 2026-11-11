<template>
  <PageShell
    title="创建账户"
    :show-back="true"
    content-class="auth-page"
  >
    <AuthJourney
      eyebrow="建立乡声档案"
      :title="journeyTitle"
      :lead="journeyLead"
      :step="formStep"
      :step-total="4"
      :step-label="journeyStepLabel"
    >
      <view
        v-if="formStep === 1"
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
        <BaseField
          v-model="password"
          name="password"
          label="密码"
          type="password"
          placeholder="请输入6~32位密码"
          required
          :error="errors.password"
          @input="clearFieldError('password')"
        />
        <BaseField
          v-model="passwordConfirmed"
          name="passwordConfirmed"
          label="确认密码"
          type="password"
          placeholder="请再次输入密码"
          required
          :error="errors.passwordConfirmed"
          @input="clearFieldError('passwordConfirmed')"
        />
        <BaseButton
          block
          @click="continueToEmail"
        >
          继续验证邮箱
        </BaseButton>
      </view>

      <view
        v-else
        class="auth-form"
      >
        <view
          class="account-summary"
          role="note"
        >
          <view class="account-summary__label">
            即将创建
          </view>
          <view class="account-summary__value">
            {{ username }}
          </view>
          <view class="account-summary__note">
            邮箱只用于验证身份和找回账号，不会展示在公开档案中。
          </view>
        </view>
        <BaseField
          v-model="email"
          name="email"
          label="邮箱"
          placeholder="请输入邮箱"
          required
          :error="errors.email"
          @input="clearFieldError('email')"
        />

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
          @click="register"
        >
          创建账户并继续
        </BaseButton>
        <t-button
          class="auth-step-back"
          theme="default"
          variant="text"
          size="medium"
          role="button"
          tabindex="0"
          aria-label="返回修改账号信息"
          @click="returnToAccountStep"
          @keydown.enter.space.prevent="returnToAccountStep"
        >
          返回修改账号信息
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
import { normalLogin } from '@/services/login';
import { registerUser } from '@/services/user';
import { sendEmailCode } from '@/services/verification';
import { notify, notifySuccess } from '@/services/feedback';
import { applyFieldErrors, readableErrorMessage } from '@/utils/apiError';
import getCodeMixin from './mixin/getCodeMixin';

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default {
  name: 'RegisterPage',
  components: {
    AuthJourney, PageShell, BaseButton, BaseField, TButton,
  },
  mixins: [getCodeMixin],
  data() {
    return {
      username: '',
      password: '',
      passwordConfirmed: '',
      email: '',
      code: '',
      formStep: 1,
      submitting: false,
      errors: {
        username: '',
        password: '',
        passwordConfirmed: '',
        email: '',
        code: '',
      },
    };
  },
  computed: {
    journeyTitle() {
      return this.formStep === 1 ? '先留下一个署名' : '确认你的联络方式';
    },
    journeyLead() {
      if (this.formStep === 1) return '设置登录名和密码，之后所有乡音贡献都会归入这份档案。';
      return '完成邮箱验证后，再设置称呼和熟悉的方言，就可以开始留下乡音。';
    },
    journeyStepLabel() {
      return this.formStep === 1 ? '设置账号' : '验证邮箱';
    },
    codeDestination() {
      return this.formStep === 2 ? this.email.trim().toLowerCase() : '';
    },
  },
  methods: {
    returnToAccountStep() {
      this.formStep = 1;
    },
    clearFieldError(field) {
      this.errors[field] = '';
    },
    continueToEmail() {
      const username = String(this.username || '').trim();
      const { password, passwordConfirmed } = this;
      this.errors.username = username ? '' : '请输入用户名';
      this.errors.password = password ? '' : '请输入密码';
      this.errors.passwordConfirmed = passwordConfirmed ? '' : '请再次输入密码';
      if (this.errors.username || this.errors.password || this.errors.passwordConfirmed) return;
      if (password.length < 6 || password.length > 32) {
        this.errors.password = '密码长度 6 - 32 位';
        return;
      }
      if (password !== passwordConfirmed) {
        this.errors.passwordConfirmed = '两次密码不相同';
        return;
      }
      this.username = username;
      this.formStep = 2;
    },
    async getCode() {
      const email = String(this.email || '').trim();
      if (!email) {
        this.errors.email = '请输入邮箱';
        return;
      }
      if (!EMAIL_PATTERN.test(email)) {
        this.errors.email = '请填写正确的邮箱';
        return;
      }
      this.errors.email = '';
      await this.sendVerificationCode(
        () => sendEmailCode(email, 'register', true),
        () => notifySuccess('验证码已发送'),
        (error) => {
          if (!applyFieldErrors(this.errors, error, ['email'])) {
            notify({ title: readableErrorMessage(error) || '验证码发送失败' });
          }
        },
      );
    },
    async register() {
      const username = String(this.username || '').trim();
      const { password, passwordConfirmed } = this;
      const email = String(this.email || '').trim();
      const code = String(this.code || '').trim();

      this.errors.username = username ? '' : '请输入用户名';
      this.errors.password = password ? '' : '请输入密码';
      this.errors.passwordConfirmed = passwordConfirmed ? '' : '请再次输入密码';
      this.errors.email = email ? '' : '请输入邮箱';
      this.errors.code = code ? '' : '请输入验证码';
      if (this.errors.username || this.errors.password || this.errors.passwordConfirmed
        || this.errors.email || this.errors.code) return;

      if (password.length < 6 || password.length > 32) {
        this.errors.password = '密码长度 6 - 32 位';
        return;
      }
      if (password !== passwordConfirmed) {
        this.errors.passwordConfirmed = '两次密码不相同';
        return;
      }
      if (!EMAIL_PATTERN.test(email)) {
        this.errors.email = '请填写正确的邮箱';
        return;
      }

      this.submitting = true;
      try {
        await registerUser(username, password, email, code);
        await normalLogin(username, password, { isNew: true });
      } catch (error) {
        const mapped = applyFieldErrors(
          this.errors,
          error,
          ['username', 'password', 'email', 'code'],
        );
        if (!mapped) {
          const title = readableErrorMessage(error, {
            400: '注册信息无效',
            401: '验证码错误',
            409: '用户名或邮箱已存在',
          }) || '注册失败';
          uni.showToast({ title, icon: 'none' });
        }
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.account-summary {
  padding: 20rpx 22rpx;
  border-left: 5rpx solid var(--accent-color);
  background: var(--accent-subtle-color);
}

.account-summary__label {
  color: var(--muted-color);
  font-size: 20rpx;
  letter-spacing: 2rpx;
}

.account-summary__value {
  margin-top: 6rpx;
  color: var(--text-color);
  font-size: var(--font-size-lg);
  font-weight: 800;
  overflow-wrap: anywhere;
}

.account-summary__note {
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
