<template>
  <view class="feedback-host">
    <t-toast
      id="app-toast"
      ref="toast"
    />
    <t-message
      id="app-message"
      ref="message"
    />
    <t-dialog
      id="app-dialog"
      :visible="dialog.visible"
      :title="dialog.title"
      :content="dialog.content"
      :confirm-btn="dialog.confirmBtn"
      :cancel-btn="dialog.cancelBtn"
      @confirm="resolveDialog(true)"
      @cancel="resolveDialog(false)"
      @close="resolveDialog(false)"
    />
  </view>
</template>

<script>
import TDialog from '@tdesign/uniapp/dialog/dialog.vue';
import TMessage from '@tdesign/uniapp/message/message.vue';
import TToast from '@tdesign/uniapp/toast/toast.vue';
import {
  registerFeedbackHost,
  unregisterFeedbackHost,
} from '@/services/feedback';

export default {
  name: 'FeedbackHost',
  components: { TDialog, TMessage, TToast },
  data() {
    return {
      dialog: {
        visible: false,
        title: '',
        content: '',
        confirmBtn: null,
        cancelBtn: null,
      },
      dialogResolver: null,
    };
  },
  mounted() {
    registerFeedbackHost(this);
  },
  beforeUnmount() {
    unregisterFeedbackHost(this);
    if (this.dialogResolver) this.dialogResolver(false);
    this.dialogResolver = null;
  },
  methods: {
    showToast({
      title, icon, duration, mask,
    }) {
      const { toast } = this.$refs;
      if (!toast || typeof toast.show !== 'function') return false;
      const theme = ['success', 'error', 'warning', 'loading'].includes(icon)
        ? icon
        : 'text';
      toast.show({
        message: title,
        theme,
        duration,
        preventScrollThrough: mask,
      });
      return true;
    },
    showMessage({
      content, theme, duration,
    }) {
      const { message } = this.$refs;
      if (!message || typeof message.setMessage !== 'function') return false;
      message.setMessage({
        content,
        duration,
        single: true,
      }, theme);
      return true;
    },
    confirm({
      title, content, confirmText, cancelText, danger,
    }) {
      if (this.dialogResolver) this.dialogResolver(false);
      this.dialog = {
        visible: true,
        title,
        content,
        confirmBtn: {
          content: confirmText,
          theme: danger ? 'danger' : 'primary',
        },
        cancelBtn: {
          content: cancelText,
          theme: 'default',
        },
      };
      return new Promise((resolve) => {
        this.dialogResolver = resolve;
      });
    },
    resolveDialog(confirmed) {
      if (!this.dialog.visible && !this.dialogResolver) return;
      const resolve = this.dialogResolver;
      this.dialog.visible = false;
      this.dialog.content = '';
      this.dialog.title = '';
      this.dialogResolver = null;
      if (resolve) resolve(confirmed);
    },
  },
};
</script>

<style scoped>
.feedback-host {
  width: 0;
  height: 0;
}
</style>
