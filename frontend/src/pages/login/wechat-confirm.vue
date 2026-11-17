<template>
  <PageShell
    title="确认微信登录"
    content-class="auth-page"
  >
    <AuthJourney
      :title="title"
      :lead="lead"
    >
      <view
        v-if="details && !confirmed"
        class="wechat-confirm"
      >
        <text class="wechat-confirm__reference">
          核对编号 {{ details.reference }}
        </text>
        <BaseButton
          block
          text="确认登录"
          :loading="confirming"
          @click="confirm"
        />
        <BaseButton
          block
          variant="ghost"
          text="已有账号，先绑定微信"
          :disabled="confirming"
          @click="toMePage()"
        />
      </view>
      <view
        v-if="message"
        class="wechat-confirm__message"
        role="status"
      >
        {{ message }}
      </view>
    </AuthJourney>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import PageShell from '@/components/PageShell.vue';
import AuthJourney from '@/pages/login/components/AuthJourney.vue';
import { toMePage } from '@/routers/user';
import { isWechatMiniProgram } from '@/services/platform';
import { bridgeDetails, confirmBridge, getBridgeRequestId } from '@/services/wechatBridge';

export default {
  components: { AuthJourney, BaseButton, PageShell },
  data() {
    return {
      requestId: '',
      details: null,
      confirmed: false,
      confirming: false,
      message: '',
    };
  },
  computed: {
    destination() {
      return this.details?.channel === 'app' ? '乡声集盒 App' : '网页';
    },
    title() {
      if (this.confirmed) return '已确认微信登录';
      if (this.details) return `确认登录${this.destination}`;
      return '确认微信登录';
    },
    lead() {
      if (this.confirmed) return `请切回${this.destination}继续使用。`;
      if (!this.details) {
        return this.requestId && !this.message
          ? '正在读取登录请求…'
          : '请从发起登录的页面重新打开小程序。';
      }
      return '请核对发起登录页面上的编号。首次使用将自动创建账号。';
    },
  },
  async onLoad(query) {
    if (!isWechatMiniProgram()) return;
    this.requestId = getBridgeRequestId(query);
    if (!this.requestId) {
      this.message = '登录请求已失效，请重新发起。';
      return;
    }
    try {
      this.details = await bridgeDetails(this.requestId);
    } catch (error) {
      this.message = error.message || '无法读取登录请求，请重新发起。';
    }
  },
  methods: {
    toMePage,
    async confirm() {
      if (!this.details || this.confirmed || this.confirming) return;
      this.message = '';
      this.confirming = true;
      try {
        await confirmBridge(this.requestId);
        this.confirmed = true;
      } catch (error) {
        if (error.statusCode === 410) this.details = null;
        this.message = error.message || '微信登录确认失败，请重试。';
      } finally {
        this.confirming = false;
      }
    },
  },
};
</script>

<style scoped>
.wechat-confirm {
  display: grid;
  gap: var(--space-3);
}

.wechat-confirm__reference,
.wechat-confirm__message {
  color: var(--text-secondary-color);
  text-align: center;
  font-size: 28rpx;
}
</style>
