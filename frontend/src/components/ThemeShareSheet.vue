<template>
  <view
    v-if="target"
    class="sheet-mask"
    @tap="$emit('close')"
  >
    <view class="sheet-mask-dim" />
    <view
      class="sheet"
      @tap.stop
    >
      <view class="sheet-title">
        分享这个{{ kindLabel }}
      </view>
      <view class="muted">
        {{ copy }}
      </view>
      <BaseButton
        class="share-row"
        size="medium"
        variant="ghost"
        shape="rectangle"
        aria-label="分享给好友"
        block
        @click="onFriend"
      >
        分享给好友
      </BaseButton>
      <BaseButton
        v-if="isMiniProgram"
        class="share-row"
        size="medium"
        variant="ghost"
        shape="rectangle"
        aria-label="分享到微信"
        block
        open-type="share"
        @click="onMpShare"
      >
        分享到微信
      </BaseButton>
      <BaseButton
        v-else
        class="share-row"
        size="medium"
        variant="ghost"
        shape="rectangle"
        aria-label="分享到微信"
        block
        @click="onWechatH5"
      >
        分享到微信
      </BaseButton>
      <BaseButton
        v-if="!isMiniProgram"
        class="share-row"
        size="medium"
        variant="ghost"
        shape="rectangle"
        aria-label="复制链接"
        block
        @click="onCopy"
      >
        复制链接
      </BaseButton>
      <BaseButton
        class="share-row"
        size="medium"
        variant="ghost"
        shape="rectangle"
        aria-label="生成分享图片"
        block
        @click="posterOpen = true"
      >
        生成分享图片
      </BaseButton>
      <view
        v-if="posterOpen"
        class="poster"
      >
        <view class="poster-logo">
          {{ appName }}
        </view>
        <view
          class="poster-shot"
          :class="`shot-${target.item.preview || 'default'}`"
        >
          <view class="shot-home">
            <view class="shot-nav" />
            <view class="shot-feed" />
            <view class="shot-tab" />
          </view>
        </view>
        <view class="poster-name">
          {{ target.item.name }}
        </view>
        <view class="muted">
          {{ copy }}
        </view>
        <BaseButton
          class="save-btn"
          size="small"
          @click="onSavePoster"
        >
          保存到相册
        </BaseButton>
      </view>
      <view class="hint">
        好友点开后仍需满足对应权限，不能直接免费获取。
      </view>
      <BaseButton
        variant="ghost"
        size="small"
        @click="$emit('close')"
      >
        取消
      </BaseButton>
    </view>
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import { APP_NAME } from '@/const/branding';
import { notify, notifySuccess } from '@/services/feedback';
import { goMailSend } from '@/services/navigation';
import { THEME_FAULT_TOAST } from '@/services/themeFault';
import { trackThemeShare } from '@/services/themeAnalytics';
import {
  copyThemeShareLink,
  saveThemePoster,
  themeShareCopy,
} from '@/utils/themeShare';

export default {
  name: 'ThemeShareSheet',
  components: { BaseButton },
  props: {
    target: {
      type: Object,
      default: null,
    },
    isMiniProgram: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      appName: APP_NAME,
      posterOpen: false,
    };
  },
  computed: {
    kindLabel() {
      return this.target?.kind === 'dress' ? '装扮' : '主题';
    },
    copy() {
      if (!this.target?.item) return '';
      return themeShareCopy(this.target.item, this.target.kind);
    },
  },
  watch: {
    target() {
      this.posterOpen = false;
    },
  },
  methods: {
    onFriend() {
      trackThemeShare(this.target.kind, this.target.item, 'friend');
      goMailSend('', {
        title: `分享${this.kindLabel}：${this.target.item.name}`,
        content: this.copy,
      });
    },
    onWechatH5() {
      trackThemeShare(this.target.kind, this.target.item, 'wechat');
      copyThemeShareLink(this.target.kind, this.target.item, () => {
        notifySuccess('链接已复制');
      });
    },
    onMpShare() {
      trackThemeShare(this.target.kind, this.target.item, 'mp_share');
    },
    onCopy() {
      trackThemeShare(this.target.kind, this.target.item, 'copy_link');
      copyThemeShareLink(this.target.kind, this.target.item, () => {
        notifySuccess('链接已复制');
      });
    },
    async onSavePoster() {
      trackThemeShare(this.target.kind, this.target.item, 'save_poster');
      const result = await saveThemePoster(this.target.kind, this.target.item);
      if (!result.ok) {
        notify({
          title: result.reason === 'album'
            ? THEME_FAULT_TOAST.album
            : THEME_FAULT_TOAST.resource,
        });
        return;
      }
      notifySuccess('海报已保存到相册');
    },
  },
};
</script>

<style scoped>
.sheet-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  box-sizing: border-box;
}

.sheet-mask-dim {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: var(--text-color);
  opacity: 0.46;
}

.sheet {
  position: relative;
  z-index: 1;
  width: 100%;
  max-height: 80vh;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  box-sizing: border-box;
  overflow: auto;
}

.sheet-title {
  font-weight: 700;
}

.muted,
.hint {
  margin-top: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
  line-height: 1.55;
}

.hint {
  font-size: var(--font-size-xs);
}

.share-row {
  margin-top: var(--space-2);
}

.poster {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--page-color);
}

.poster-logo {
  color: var(--accent-color);
  font-weight: 700;
}

.poster-name {
  margin-top: var(--space-2);
  font-weight: 700;
}

.poster-shot {
  display: flex;
  height: 160rpx;
  margin-top: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--accent-subtle-color);
  box-sizing: border-box;
}

.shot-home {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.shot-nav,
.shot-feed,
.shot-tab {
  height: 16rpx;
  border-radius: var(--radius-sm);
  background: var(--accent-color);
}

.shot-feed {
  height: 36rpx;
  background: var(--surface-color);
}

.save-btn {
  margin-top: var(--space-2);
}

.pressable {
  transition: opacity 200ms ease, transform 200ms ease;
}

.pressable:active {
  opacity: 0.72;
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .pressable {
    transition: none;
  }

  .pressable:active {
    transform: none;
  }
}
</style>
