<template>
  <view class="account-settings">
    <view
      class="account-settings__heading"
      role="heading"
      aria-level="2"
    >
      账户设置
    </view>
    <view class="account-settings__groups">
      <view class="account-settings__group">
        <view
          class="account-settings__title"
          role="heading"
          aria-level="3"
        >
          个性化
        </view>
        <t-cell
          title="主题中心"
          :description="`当前主题：${themeLabel}`"
          arrow
          hover
          :aria-label="`主题中心，当前主题 ${themeLabel}`"
          role="button"
          tabindex="0"
          @click="$emit('theme')"
          @keydown.enter.space.prevent="$emit('theme')"
        />
      </view>

      <view class="account-settings__group">
        <view
          class="account-settings__title"
          role="heading"
          aria-level="3"
        >
          公开身份
        </view>
        <t-cell
          title="个人资料与隐私"
          description="管理他人可见的头像、昵称和资料"
          arrow
          hover
          aria-label="个人资料与隐私，管理他人可见的头像、昵称和资料"
          role="button"
          tabindex="0"
          @click="$emit('profile')"
          @keydown.enter.space.prevent="$emit('profile')"
        />
      </view>

      <view class="account-settings__group">
        <view
          class="account-settings__title"
          role="heading"
          aria-level="3"
        >
          账户与安全
        </view>
        <t-cell
          title="邮箱"
          :description="email ? `已绑定：${email}` : '未绑定，用于找回账号'"
          arrow
          hover
          :aria-label="email ? `邮箱，已绑定 ${email}` : '邮箱，未绑定'"
          role="button"
          tabindex="0"
          @click="$emit('email')"
          @keydown.enter.space.prevent="$emit('email')"
        />
        <t-cell
          title="修改密码"
          description="更新登录密码"
          arrow
          hover
          aria-label="修改密码，更新登录密码"
          role="button"
          tabindex="0"
          @click="$emit('password')"
          @keydown.enter.space.prevent="$emit('password')"
        />
        <view
          v-if="showWechat"
          class="account-settings__action"
        >
          <view class="account-settings__action-copy">
            <text>微信</text>
            <text class="account-settings__description">
              {{ wechatBound ? '已绑定' : '未绑定' }}
            </text>
          </view>
          <BaseButton
            variant="ghost"
            :text="wechatBound ? '解绑微信' : '绑定微信'"
            :loading="wechatBusy"
            :disabled="wechatBusy"
            @click="$emit('wechat')"
            @keydown.enter.space.prevent="activateActionFromKeyboard($event, 'wechat')"
          />
        </view>
      </view>

      <view class="account-settings__group">
        <view
          class="account-settings__title"
          role="heading"
          aria-level="3"
        >
          当前会话
        </view>
        <view class="account-settings__action">
          <text class="account-settings__description">
            退出后回到游客模式，本地草稿仍会保留。
          </text>
          <BaseButton
            variant="danger-ghost"
            text="退出登录"
            @click="$emit('logout')"
            @keydown.enter.space.prevent="activateActionFromKeyboard($event, 'logout')"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import TCell from '@tdesign/uniapp/cell/cell.vue';
import BaseButton from '@/components/BaseButton.vue';

export default {
  name: 'AccountSettingsMenu',
  components: { TCell, BaseButton },
  props: {
    themeLabel: { type: String, required: true },
    email: { type: String, default: '' },
    showWechat: { type: Boolean, default: false },
    wechatBound: { type: Boolean, default: false },
    wechatBusy: { type: Boolean, default: false },
  },
  emits: ['theme', 'profile', 'email', 'password', 'wechat', 'logout'],
  methods: {
    activateActionFromKeyboard(event, action) {
      // #ifdef H5
      if (event.repeat || (action === 'wechat' && this.wechatBusy)) return;
      this.$emit(action);
      // #endif
    },
  },
};
</script>

<style scoped>
.account-settings {
  margin-top: var(--space-4);
}

.account-settings__heading {
  margin-bottom: var(--space-2);
  font-size: var(--font-size-base);
  font-weight: 700;
}

.account-settings__groups {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
}

.account-settings__group {
  min-width: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  overflow: hidden;
}

.account-settings__title {
  padding: var(--space-3) var(--space-3) 0;
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.account-settings__group :deep(.t-cell) {
  min-height: 44px;
  padding: var(--space-3);
  box-sizing: border-box;
  background-color: transparent;
}

.account-settings__group :deep(.t-cell__title) {
  min-width: 0;
}

.account-settings__group :deep(.t-cell__description-text) {
  color: var(--text-secondary-color);
  overflow-wrap: anywhere;
}

.account-settings__group :deep(.t-cell:focus-visible),
.account-settings__action :deep(.base-button:focus-visible) {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

.account-settings__action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3);
}

.account-settings__action-copy {
  display: grid;
  gap: var(--space-1);
}

.account-settings__action :deep(.base-button) {
  min-height: 44px;
}

.account-settings__description {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

@media (min-width: 640px) {
  .account-settings__groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
