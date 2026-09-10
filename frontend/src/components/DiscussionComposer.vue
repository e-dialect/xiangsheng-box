<template>
  <view class="discussion-composer">
    <view
      v-if="replyTarget"
      class="discussion-composer__reply"
    >
      <text class="box-note">
        回复 {{ replyTarget.author_name }}
      </text>
      <BaseButton
        size="small"
        variant="ghost"
        text="取消回复"
        @click="$emit('cancel-reply')"
      />
    </view>
    <BaseField
      :model-value="modelValue"
      name="body"
      :label="label"
      type="textarea"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :error="error"
      :adjust-position="adjustPosition"
      @update:model-value="onInput"
      @confirm="submit"
    />
    <BaseButton
      block
      text="发送留言"
      :loading="sending"
      :disabled="disabled"
      @click="submit"
    />
  </view>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';

export default {
  name: 'DiscussionComposer',
  components: { BaseButton, BaseField },
  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, default: '写一条留言' },
    placeholder: { type: String, default: '你那里怎么说？' },
    maxlength: { type: Number, default: 2000 },
    replyTarget: { type: Object, default: null },
    sending: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    /* 面板自行抬升输入区时置 false，交给容器而不是原生层顶页 */
    adjustPosition: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'submit', 'cancel-reply'],
  data: () => ({ error: '' }),
  watch: {
    modelValue() { if (this.error) this.error = ''; },
  },
  methods: {
    onInput(value) {
      this.$emit('update:modelValue', value);
    },
    submit() {
      if (this.sending || this.disabled) return;
      const body = String(this.modelValue || '').trim();
      if (!body) {
        this.error = '先写下想说的话';
        return;
      }
      this.error = '';
      this.$emit('submit', body);
    },
  },
};
</script>

<style scoped>
.discussion-composer {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1rpx solid var(--border-color);
  padding-bottom: calc(var(--space-2) + env(safe-area-inset-bottom));
}

.discussion-composer__reply {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 88rpx;
}
</style>
