<template>
  <view
    class="recording-context"
    :class="{ 'recording-context--expanded': expanded }"
  >
    <view class="recording-context__states">
      <text>{{ visibilityLabel }}</text>
      <text>{{ statusLabel }}</text>
    </view>
    <view class="recording-context__rights">
      <text class="recording-context__label">
        授权说明：
      </text>
      <text>{{ rightsText }}</text>
    </view>
    <text
      v-if="expanded"
      class="recording-context__note"
    >
      公开可见不表示已核对或获准引用，请查看贡献者的授权说明。
    </text>
  </view>
</template>

<script>
export default {
  name: 'RecordingContext',
  props: {
    recording: { type: Object, required: true },
    expanded: { type: Boolean, default: false },
  },
  computed: {
    visibilityLabel() {
      if (this.recording.visibility === true) return '公开可见';
      if (this.recording.visibility === false) return '未公开';
      return '可见性未提供';
    },
    statusLabel() {
      return {
        draft: this.recording.visibility === false ? '未公开初稿' : '初稿·待核对',
        published: '记录状态：已公开',
        disputed: '有分歧',
        rejected: '不采用',
      }[this.recording.status] || '整理状态未提供';
    },
    rightsText() {
      return String(this.recording.rights_statement || '').trim() || '暂未补充引用授权说明';
    },
  },
};
</script>

<style scoped>
.recording-context {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-2);
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.recording-context__states {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.recording-context__states text {
  padding: 2rpx var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--surface-subtle-color);
}
.recording-context__label {
  font-weight: 700;
}
.recording-context__note {
  color: var(--muted-color);
}
</style>
