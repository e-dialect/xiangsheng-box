<template>
  <view
    class="avatar-frame"
    :style="frameStyle"
    :aria-label="ariaLabel"
  >
    <image
      v-if="src"
      class="avatar-frame__image"
      :src="src"
      mode="aspectFill"
    />
    <text
      v-else
      class="avatar-frame__fallback"
      aria-hidden="true"
    >
      {{ fallbackText }}
    </text>
  </view>
</template>

<script>
export default {
  name: 'AvatarFrame',
  props: {
    src: { type: String, default: '' },
    name: { type: String, default: '' },
    size: { type: [Number, String], default: 44 },
  },
  computed: {
    normalizedSize() {
      if (typeof this.size === 'number') return `${this.size}rpx`;
      return /^\d+(?:\.\d+)?$/.test(this.size) ? `${this.size}rpx` : this.size;
    },
    frameStyle() {
      return {
        width: this.normalizedSize,
        height: this.normalizedSize,
      };
    },
    fallbackText() {
      return String(this.name || '乡').trim().slice(0, 1) || '乡';
    },
    ariaLabel() {
      return `${this.name || '乡音贡献者'}的头像`;
    },
  },
};
</script>

<style scoped>
.avatar-frame {
  flex: 0 0 auto;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border:
    var(--dress-avatar-frame-border-width, 0px)
    solid var(--dress-avatar-frame-border-color, transparent);
  border-radius: var(--dress-avatar-frame-border-radius, 50%);
  box-shadow: var(--dress-avatar-frame-shadow, none);
  background: var(--dress-avatar-frame-background, var(--surface-subtle-color));
  color: var(--dress-avatar-frame-color, var(--accent-color));
}

.avatar-frame__image {
  width: 100%;
  height: 100%;
}

.avatar-frame__fallback {
  font-size: 0.48em;
  font-weight: 800;
  line-height: 1;
}
</style>
