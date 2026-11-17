<template>
  <view
    v-if="available || attempt || message"
    class="wechat-bridge"
  >
    <BaseButton
      v-if="!attempt"
      block
      text="微信登录"
      :disabled="disabled"
      :loading="starting"
      @click="begin"
    />
    <template v-else>
      <view
        class="wechat-bridge__status"
        role="status"
      >
        {{ instruction }}
      </view>
      <image
        v-if="attempt.qr_image"
        class="wechat-bridge__qr"
        mode="aspectFit"
        :src="attempt.qr_image"
        aria-label="用微信扫一扫确认登录"
      />
      <text class="wechat-bridge__reference">
        核对编号 {{ attempt.reference }}
      </text>
      <BaseButton
        v-if="attempt.launch_url"
        block
        text="打开微信"
        @click="open"
      />
      <BaseButton
        block
        variant="ghost"
        text="取消微信登录"
        @click="cancelFromButton"
      />
    </template>
    <view
      v-if="message"
      class="wechat-bridge__status"
      role="status"
    >
      {{ message }}
    </view>
  </view>
</template>

<script>
/* eslint-env browser */
import BaseButton from '@/components/BaseButton.vue';
import { afterLogin } from '@/services/login';
import { isH5Runtime } from '@/services/platform';
import {
  bridgeChannel,
  cancelBridge,
  exchangeBridge,
  getBridgeAvailability,
  openBridgeLink,
  readBridgeAttempt,
  startBridge,
  storeBridgeAttempt,
} from '@/services/wechatBridge';

const CHECK_INTERVAL_MS = 2000;

export default {
  components: { BaseButton },
  emits: ['cancel'],
  props: {
    disabled: { type: Boolean, default: false },
  },
  data() {
    return {
      available: false,
      attempt: null,
      starting: false,
      checking: false,
      foreground: true,
      disposed: false,
      timer: null,
      message: '',
      startSequence: 0,
    };
  },
  computed: {
    instruction() {
      if (this.attempt.qr_image) return '请用手机微信扫一扫，在小程序中确认登录。';
      return this.attempt.channel === 'app'
        ? '在微信小程序确认登录后，请切回乡声集盒 App。'
        : '在微信小程序确认登录后，请返回此网页。';
    },
  },
  async mounted() {
    if (isH5Runtime()) {
      this.foreground = !document.hidden;
      document.addEventListener('visibilitychange', this.onWebVisibility);
      window.addEventListener('pageshow', this.onWebVisibility);
      this.attempt = readBridgeAttempt();
      this.check();
    } else {
      uni.onAppShow?.(this.onForeground);
      uni.onAppHide?.(this.onBackground);
    }
    try {
      const flags = await getBridgeAvailability();
      this.available = flags[bridgeChannel() === 'app' ? 'app' : 'web'] === true;
    } catch {
      this.available = false;
    }
  },
  beforeUnmount() {
    this.disposed = true;
    if (isH5Runtime()) {
      document.removeEventListener('visibilitychange', this.onWebVisibility);
      window.removeEventListener('pageshow', this.onWebVisibility);
    } else {
      uni.offAppShow?.(this.onForeground);
      uni.offAppHide?.(this.onBackground);
    }
    this.cancel();
  },
  methods: {
    onWebVisibility() {
      if (document.hidden) this.onBackground();
      else this.onForeground();
    },
    onForeground() {
      this.foreground = true;
      this.check();
    },
    onBackground() {
      this.foreground = false;
      clearTimeout(this.timer);
    },
    async begin() {
      if (this.starting || this.attempt || this.disabled) return;
      const sequence = this.startSequence;
      this.starting = true;
      this.message = '';
      try {
        const channel = bridgeChannel();
        const attempt = { ...await startBridge(channel), channel };
        if (this.disposed || sequence !== this.startSequence) {
          this.revoke(attempt);
          return;
        }
        this.attempt = attempt;
        storeBridgeAttempt(attempt);
        if (attempt.launch_url) this.open();
        this.check();
      } catch (error) {
        this.cancel();
        if (!this.disposed) this.message = error.message || '无法开始微信登录，请重试';
      } finally {
        this.starting = false;
      }
    },
    open() {
      const { attempt } = this;
      this.message = '';
      const showError = () => {
        if (this.attempt !== attempt) return;
        this.message = '无法打开微信，请确认已安装微信，或使用下方的账号登录。';
      };
      try {
        openBridgeLink(attempt.launch_url, showError);
      } catch {
        showError();
      }
    },
    clearAttempt() {
      this.attempt = null;
      clearTimeout(this.timer);
      try {
        storeBridgeAttempt(null);
      } catch {
        // Storage can be unavailable in a restricted browser.
      }
    },
    revoke(attempt) {
      cancelBridge(attempt).catch(() => {
        // The request will expire on the server if cancellation cannot be sent.
      });
    },
    cancelFromButton() {
      this.cancel();
      this.$emit('cancel');
    },
    cancel() {
      this.startSequence += 1;
      const { attempt } = this;
      this.clearAttempt();
      this.message = '';
      if (attempt) this.revoke(attempt);
    },
    async check() {
      clearTimeout(this.timer);
      const { attempt } = this;
      if (!attempt || !this.foreground || this.checking || this.disposed) return;
      if (Date.parse(attempt.expires_at) <= Date.now()) {
        this.clearAttempt();
        this.message = '微信登录已超时，请重试。';
        return;
      }
      this.checking = true;
      try {
        const result = await exchangeBridge(attempt);
        if (attempt !== this.attempt || result.status === 'pending') return;
        this.message = '';
        this.clearAttempt();
        await afterLogin(result, { isNew: result.isNew });
      } catch (error) {
        if (attempt !== this.attempt) return;
        if (error.statusCode === 410) this.clearAttempt();
        this.message = error.message || '暂时无法检查微信登录结果';
      } finally {
        this.checking = false;
        if (this.attempt && this.foreground && !this.disposed) {
          this.timer = setTimeout(this.check, CHECK_INTERVAL_MS);
        }
      }
    },
  },
};
</script>

<style scoped>
.wechat-bridge {
  display: grid;
  gap: var(--space-2);
  justify-items: stretch;
  margin-bottom: var(--space-3);
}

.wechat-bridge__status,
.wechat-bridge__reference {
  color: var(--text-secondary-color);
  text-align: center;
  font-size: 26rpx;
}

.wechat-bridge__qr {
  width: 324rpx;
  height: 324rpx;
  max-width: 100%;
  justify-self: center;
  border-radius: var(--radius-md);
  background: #fff;
}
</style>
