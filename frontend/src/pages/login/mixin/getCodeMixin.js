const RESEND_SECONDS = 30;

export default {
  data() {
    return {
      codeRequests: new Map(),
      codeTimer: null,
    };
  },
  computed: {
    codeRequest() {
      return this.codeRequests.get(this.codeDestination);
    },
    sendCodeMsg() {
      if (!this.codeRequest) return '获取验证码';
      if (this.codeRequest.pending) return '发送中…';
      return `重新获取(${this.codeRequest.seconds})`;
    },
  },
  onUnload() {
    this.clearCodeRequests();
  },
  beforeUnmount() {
    this.clearCodeRequests();
  },
  methods: {
    async sendVerificationCode(request, onSuccess, onError) {
      const destination = this.codeDestination;
      if (!destination || this.codeRequests.has(destination)) return;

      this.codeRequests.set(destination, { pending: true });
      let response;
      try {
        response = await request();
      } catch (error) {
        if (!this.codeRequests.delete(destination)) return;
        if (destination === this.codeDestination) onError(error);
        return;
      }
      if (!this.codeRequests.has(destination)) return;

      this.codeRequests.set(destination, {
        expiresAt: Date.now() + RESEND_SECONDS * 1000,
        seconds: RESEND_SECONDS,
      });
      if (this.codeTimer === null) {
        this.codeTimer = setInterval(this.tickCodeRequests, 1000);
      }
      if (destination === this.codeDestination) onSuccess(response);
    },
    tickCodeRequests() {
      const now = Date.now();
      let hasCooldown = false;
      this.codeRequests.forEach((request, destination) => {
        if (request.pending) return;
        const seconds = Math.ceil((request.expiresAt - now) / 1000);
        if (seconds <= 0) {
          this.codeRequests.delete(destination);
          return;
        }
        request.seconds = seconds;
        hasCooldown = true;
      });
      if (!hasCooldown) {
        clearInterval(this.codeTimer);
        this.codeTimer = null;
      }
    },
    clearCodeRequests() {
      clearInterval(this.codeTimer);
      this.codeTimer = null;
      this.codeRequests.clear();
    },
  },
};
