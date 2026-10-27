<template>
  <PageShell
    title="登录"
    content-class="auth-page"
  >
    <AuthJourney
      eyebrow="乡声通行证"
      title="回来听一听乡音"
      lead="登录不是门槛，而是为了把你的录音、收藏和贡献履历好好保存下来。"
    >
      <template
        v-if="intentText"
        #hero
      >
        <view class="intent-banner">
          <view class="intent-kicker">
            {{ intentVoluntary ? '继续访问' : '登录后继续' }}
          </view>
          <view class="intent-copy">
            {{ intentText }}
          </view>
        </view>
      </template>

      <t-tabs
        v-if="phoneCodeLoginEnabled"
        :value="loginMode"
        class="login-tabs"
        @change="changeMode"
      >
        <t-tab-panel
          value="phone"
          label="手机验证码"
        />
        <t-tab-panel
          value="password"
          label="账号密码"
        />
      </t-tabs>

      <view
        v-if="phoneCodeLoginEnabled && loginMode === 'phone'"
        class="login-form phone-form"
      >
        <BaseField
          v-model="phone"
          class="phone-input"
          name="phone"
          label="手机号"
          type="number"
          :maxlength="13"
          placeholder="请输入手机号"
          required
          :error="errors.phone"
          @input="clearFieldError('phone')"
        />
        <view class="code-row">
          <view class="code-field">
            <BaseField
              v-model="code"
              class="code-input"
              name="code"
              label="验证码"
              type="number"
              :maxlength="6"
              placeholder="六位验证码"
              required
              :error="errors.code"
              @input="clearFieldError('code')"
            />
          </view>
          <BaseButton
            class="code-button"
            variant="ghost"
            size="medium"
            :disabled="countdown > 0 || sendingCode"
            @click="sendPhoneCode"
          >
            {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
          </BaseButton>
        </view>
        <view
          v-if="demoCode"
          class="demo-code"
        >
          Demo 验证码：<text>{{ demoCode }}</text>
        </view>
        <BaseButton
          class="phone-login-button"
          block
          :loading="submitting"
          @click="phoneLogin"
        >
          登录 / 注册
        </BaseButton>
      </view>

      <view
        v-else
        class="login-form password-form"
      >
        <BaseField
          v-model="username"
          name="username"
          label="账号"
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
          placeholder="请输入密码"
          required
          :error="errors.password"
          @input="clearFieldError('password')"
        />
        <BaseButton
          block
          :loading="submitting"
          @click="passwordLogin"
        >
          账号密码登录
        </BaseButton>
      </view>

      <!-- #ifdef MP-WEIXIN -->
      <BaseButton
        class="wechat-login"
        block
        variant="ghost"
        @click="mpLogin()"
      >
        微信一键登录 / 注册
      </BaseButton>
      <!-- #endif -->

      <template #footer>
        <view class="auth-secondary">
          <t-button
            class="browse-first"
            theme="primary"
            variant="text"
            size="medium"
            role="button"
            tabindex="0"
            aria-label="暂不登录，先去查词"
            @click="cancelLoginToSearch"
            @keydown.enter.space.prevent="cancelLoginToSearch"
          >
            暂不登录，先去查词
          </t-button>
          <view class="login-links">
            <t-button
              class="login-link"
              theme="default"
              variant="text"
              size="medium"
              role="button"
              tabindex="0"
              aria-label="忘记密码"
              @click="toForgetPage()"
              @keydown.enter.space.prevent="toForgetPage()"
            >
              忘记密码
            </t-button>
            <!-- #ifndef MP-WEIXIN -->
            <t-button
              class="login-link"
              theme="default"
              variant="text"
              size="medium"
              role="button"
              tabindex="0"
              aria-label="用户注册"
              @click="toRegisterPage()"
              @keydown.enter.space.prevent="toRegisterPage()"
            >
              用户注册
            </t-button>
            <!-- #endif -->
            <!-- #ifdef MP-WEIXIN -->
            <t-button
              class="login-link"
              theme="default"
              variant="text"
              size="medium"
              role="button"
              tabindex="0"
              aria-label="微信注册"
              @click="toWechatRegisterPage()"
              @keydown.enter.space.prevent="toWechatRegisterPage()"
            >
              微信注册
            </t-button>
            <!-- #endif -->
          </view>
        </view>
      </template>
    </AuthJourney>
  </PageShell>
</template>

<script>
import TTabPanel from '@tdesign/uniapp/tab-panel/tab-panel.vue';
import TTabs from '@tdesign/uniapp/tabs/tabs.vue';
import TButton from '@tdesign/uniapp/button/button.vue';
import AuthJourney from '@/pages/login/components/AuthJourney.vue';
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import { actionLabel, peekInterceptIntent } from '@/services/authGuard';
import { cancelLoginToSearch } from '@/services/authJourney';
import { mpLogin, normalLogin } from '@/services/login';
import { loginWithPhone, requestPhoneCode } from '@/services/phoneAuth';
import { toForgetPage, toRegisterPage, toWechatRegisterPage } from '@/routers/login';
import { applyFieldErrors, readableErrorMessage } from '@/utils/apiError';

const PHONE_CODE_LOGIN_ENABLED = import.meta.env.VITE_PHONE_CODE_LOGIN_ENABLED === 'true';

export default {
  name: 'LoginPage',
  components: {
    AuthJourney,
    PageShell,
    BaseButton,
    BaseField,
    TTabPanel,
    TTabs,
    TButton,
  },
  data() {
    return {
      toForgetPage,
      toRegisterPage,
      toWechatRegisterPage,
      phoneCodeLoginEnabled: PHONE_CODE_LOGIN_ENABLED,
      intent: null,
      loginMode: PHONE_CODE_LOGIN_ENABLED ? 'phone' : 'password',
      phone: '',
      code: '',
      username: '',
      password: '',
      demoCode: '',
      countdown: 0,
      countdownTimer: null,
      sendingCode: false,
      submitting: false,
      errors: {
        phone: '',
        code: '',
        username: '',
        password: '',
      },
    };
  },
  computed: {
    intentVoluntary() {
      return Boolean(this.intent?.voluntary);
    },
    intentText() {
      if (!this.intent) return '';
      if (this.intentVoluntary) return '验证身份后返回「我的」。';
      return `你刚才想${actionLabel(this.intent.action)}，验证身份后会回到原来的位置。`;
    },
  },
  onLoad() {
    this.intent = peekInterceptIntent();
  },
  onUnload() {
    this.clearCountdown();
  },
  methods: {
    mpLogin,
    cancelLoginToSearch,
    changeMode(event) {
      const value = event?.detail?.value ?? event?.value ?? event?.detail ?? event;
      const nextMode = value ?? 'phone';
      const resolvedMode = nextMode === 'phone' && !this.phoneCodeLoginEnabled
        ? 'password'
        : nextMode;
      if (resolvedMode === this.loginMode) return;
      this.loginMode = resolvedMode;
      // 两种模式字段互斥，切走时清空错误，避免隐藏字段的旧错误阻塞提交。
      this.errors = {
        phone: '',
        code: '',
        username: '',
        password: '',
      };
    },
    clearFieldError(field) {
      this.errors[field] = '';
    },
    clearCountdown() {
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    },
    startCountdown(seconds) {
      this.clearCountdown();
      this.countdown = Number(seconds) || 60;
      this.countdownTimer = setInterval(() => {
        this.countdown -= 1;
        if (this.countdown <= 0) this.clearCountdown();
      }, 1000);
    },
    async sendPhoneCode() {
      if (!this.phoneCodeLoginEnabled) return;
      if (this.countdown > 0 || this.sendingCode) return;
      const phone = String(this.phone || '').trim();
      this.errors.phone = phone ? '' : '请输入手机号';
      if (!phone) return;
      this.sendingCode = true;
      try {
        const response = await requestPhoneCode(phone);
        this.demoCode = response.demo_code || '';
        this.startCountdown(response.retry_after);
        uni.showToast({ title: '验证码已生成', icon: 'success' });
      } catch (error) {
        this.errors.phone = error.message || '验证码发送失败';
      } finally {
        this.sendingCode = false;
      }
    },
    async phoneLogin() {
      if (!this.phoneCodeLoginEnabled) return;
      const phone = String(this.phone || '').trim();
      const code = String(this.code || '').trim();
      this.errors.phone = phone ? '' : '请输入手机号';
      this.errors.code = code ? '' : '请输入验证码';
      if (this.errors.phone || this.errors.code) return;
      this.submitting = true;
      try {
        await loginWithPhone(phone, code);
      } catch (error) {
        if (!applyFieldErrors(this.errors, error, ['phone', 'code'])) {
          uni.showToast({ title: readableErrorMessage(error) || '登录失败', icon: 'none' });
        }
      } finally {
        this.submitting = false;
      }
    },
    async passwordLogin() {
      const username = String(this.username || '').trim();
      const { password } = this;
      this.errors.username = username ? '' : '请输入用户名';
      this.errors.password = password ? '' : '请输入密码';
      if (this.errors.username || this.errors.password) return;
      this.submitting = true;
      try {
        await normalLogin(username, password);
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.intent-banner {
  margin-top: 26rpx;
  padding: 18rpx 20rpx;
  border-left: 5rpx solid var(--immersive-accent-color);
  background: var(--immersive-surface-color);
}

.intent-kicker {
  color: var(--immersive-accent-color);
  font-size: 20rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}

.intent-copy {
  margin-top: 6rpx;
  color: var(--on-immersive-muted-color);
  font-size: 24rpx;
  line-height: 1.5;
}

.login-tabs {
  display: block;
  margin-top: -4rpx;
}

.login-form {
  display: flex;
  flex-direction: column;
  margin-top: 24rpx;
}

.demo-code {
  padding: 14rpx 18rpx;
  background: var(--surface-subtle-color);
  color: var(--warning-color);
  font-size: 23rpx;
}

.demo-code text {
  font-weight: 900;
  letter-spacing: 4rpx;
}

.wechat-login {
  display: block;
  margin-top: 18rpx;
}

.browse-first {
  display: flex;
  width: 100%;
  margin: 0;
  --td-button-medium-font: 700 28rpx / 40rpx var(--td-font-family);
  --td-button-medium-height: 80rpx;
  --td-button-primary-text-color: var(--accent-color);
  --td-button-primary-text-active-bg-color: var(--accent-subtle-color);
  color: var(--accent-color);
}

.login-links {
  display: flex;
  justify-content: center;
  gap: var(--space-1);
  margin-top: 2rpx;
  color: var(--muted-color);
}

.login-link {
  min-width: 132rpx;
  margin: 0;
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
