<template>
  <view
    class="audio-capture"
    :class="{
      'audio-capture--recording': recording,
      'audio-capture--playing': playing,
      'audio-capture--ready': Boolean(audio.path),
      'audio-capture--disabled': !supported,
    }"
  >
    <view class="record-copy">
      <text class="record-title">
        {{ titleText }}
      </text>
      <text class="record-subtitle">
        {{ subtitleText }}
      </text>
    </view>

    <view
      class="sound-wave"
      aria-hidden="true"
    >
      <view
        v-for="index in 11"
        :key="index"
        class="sound-wave__bar"
        :class="{ 'sound-wave__bar--active': waveBarActive(index) }"
      />
    </view>

    <view class="record-controls">
      <view class="record-actions">
        <BaseButton
          class="record-action"
          variant="light"
          size="small"
          :disabled="disabled || !fileSelectionSupported || selectingFile"
          @click="chooseFile"
        >
          {{ audio.path ? '选择其他录音' : '选择本地录音' }}
        </BaseButton>
      </view>
      <BaseButton
        v-if="!audio.path || recording"
        class="record-primary"
        :disabled="disabled || !supported || selectingFile
          || (nativeBusy && !recording && !nativeStopFailed)"
        variant="light"
        shape="circle"
        :aria-label="primaryLabel"
        @click="handlePrimaryAction"
      >
        <view class="record-primary__content">
          <text class="record-primary__icon">
            {{ primaryIcon }}
          </text>
          <text class="record-primary__label">
            {{ primaryLabel }}
          </text>
        </view>
      </BaseButton>

      <view
        v-if="audio.path && !recording"
        class="record-ready-actions"
      >
        <BaseButton
          class="record-ready-action record-ready-action--secondary"
          variant="ghost"
          size="large"
          icon="refresh"
          :disabled="disabled || selectingFile || (nativeBusy && !nativeStopFailed)"
          block
          @click="restartRecording"
        >
          {{ nativeStopFailed ? '重试停止' : '重新录制' }}
        </BaseButton>
        <BaseButton
          class="record-ready-action record-ready-action--primary"
          size="large"
          :icon="playing ? 'pause-circle' : 'play-circle'"
          block
          @click="togglePlayback"
        >
          {{ playing ? '暂停播放' : '播放录音' }}
        </BaseButton>
      </view>
    </view>
  </view>
</template>

<script>
import { reactive } from 'vue';
import BaseButton from '@/components/BaseButton.vue';
import { notify } from '@/services/feedback';
import { chooseAudioFile, supportsAudioFileSelection } from '@/services/file';
import { playAudio, playManaged, stopAudio } from '@/utils/audio';

const MAX_RECORD_MS = 15 * 1000;
const MIN_RECORD_MS = 1000;
// The WeChat manager survives component disposal and does not tag its callbacks.
const nativeSessions = reactive(new WeakMap());

function formatSeconds(milliseconds) {
  return `${Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000))} 秒`;
}

export default {
  name: 'AudioCapture',
  components: { BaseButton },
  props: {
    disabled: { type: Boolean, default: false },
    audio: {
      type: Object,
      default: () => ({}),
    },
    invalid: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['change', 'clear', 'error'],
  data() {
    return {
      selectionRequest: 0,
      recorder: null,
      recorderManager: null,
      nativeSession: null,
      selectingFile: false,
      stream: null,
      releaseMicrophone: null,
      recordingRequest: 0,
      starting: false,
      disposed: false,
      recording: false,
      supported: true,
      recordingSupported: true,
      fileSelectionSupported: supportsAudioFileSelection(),
      startAt: 0,
      recordingElapsed: 0,
      stopTimer: null,
      progressTimer: null,
      playing: false,
      playbackHandle: null,
      playbackPosition: 0,
      playbackDuration: 0,
    };
  },
  computed: {
    nativeBusy() {
      return Boolean(this.recorderManager && nativeSessions.has(this.recorderManager));
    },
    nativeStopFailed() {
      return Boolean(this.recorderManager && nativeSessions.get(this.recorderManager)?.stopFailed);
    },
    resolvedDurationMs() {
      return Number(this.audio.durationMs || this.audio.duration || this.playbackDuration || 0);
    },
    playbackProgress() {
      if (!this.resolvedDurationMs) return 0;
      return Math.min(1, this.playbackPosition / this.resolvedDurationMs);
    },
    titleText() {
      if (this.nativeStopFailed) return '录音尚未结束';
      if (this.starting) return '等待麦克风授权';
      if (this.playing) return '正在播放';
      if (this.recording) return '录音中';
      if (this.invalid) return '录音已失效';
      if (this.audio.path) return '录好了';
      if (!this.supported) return '当前环境不能直接录音';
      return '让这句乡音留下来';
    },
    subtitleText() {
      if (this.nativeStopFailed) return '停止录音失败，请重试停止后继续';
      if (this.starting) return '请允许使用麦克风，也可选择已有录音';
      if (this.recording) {
        return `${formatSeconds(this.recordingElapsed)} / ${formatSeconds(MAX_RECORD_MS)}`;
      }
      if (this.playing) {
        return `${formatSeconds(this.playbackPosition)} / ${formatSeconds(this.resolvedDurationMs)}`;
      }
      if (this.invalid) return '请重新录制，或选择一段录音';
      if (this.audio.path) {
        return `${formatSeconds(this.resolvedDurationMs)} · 点击播放检查一下`;
      }
      return '点击开始，说一次你熟悉的家乡话，最长 15 秒';
    },
    primaryIcon() {
      if (this.playing) return 'Ⅱ';
      if (this.recording) return '■';
      if (this.audio.path) return '▶';
      return '●';
    },
    primaryLabel() {
      if (this.nativeStopFailed) return '重试停止';
      if (this.starting) return '等待授权';
      if (this.playing) return '暂停';
      if (this.recording) return '点击完成';
      if (this.audio.path) return '播放';
      return '开始录音';
    },
  },
  watch: {
    disabled(value) {
      if (value) this.selectionRequest += 1;
    },
    audio: {
      deep: true,
      handler() {
        this.stopPlayback();
      },
    },
  },
  mounted() {
    this.initRecorder();
  },
  beforeUnmount() {
    this.disposed = true;
    this.cancelNativeRecording();
    this.cancelH5Recording();
    this.clearTimer();
    this.stopPlayback();
  },
  methods: {
    emitAudio(payload) {
      if (!this.disabled) this.$emit('change', payload);
    },
    waveBarActive(index) {
      if (this.recording) return true;
      if (!this.playing) return false;
      return index / 11 <= this.playbackProgress;
    },
    clearTimer() {
      if (this.stopTimer) clearTimeout(this.stopTimer);
      if (this.progressTimer) clearInterval(this.progressTimer);
      this.stopTimer = null;
      this.progressTimer = null;
    },
    stopPlayback() {
      if (this.playbackHandle) {
        stopAudio();
        this.playbackHandle = null;
      }
      this.playing = false;
      this.playbackPosition = 0;
    },
    initRecorder() {
      // #ifdef MP-WEIXIN
      if (typeof uni.getRecorderManager === 'function') {
        this.recorderManager = uni.getRecorderManager();
        this.recorder = this.recorderManager;
        this.recorderManager.onStop(
          (res) => {
            const session = this.nativeSession;
            if (!session) return;
            nativeSessions.delete(this.recorderManager);
            this.nativeSession = null;
            this.recording = false;
            this.clearTimer();
            if (!this.disposed && session && !session.cancelled) {
              this.onRecordStop(res.tempFilePath, res.duration);
            }
          },
        );
        this.recorderManager.onError((error) => {
          const session = this.nativeSession;
          if (!session) return;
          nativeSessions.delete(this.recorderManager);
          this.nativeSession = null;
          this.recording = false;
          this.clearTimer();
          if (!this.disposed && !session.cancelled) this.$emit('error', error);
        });
      }
      // #endif

      // #ifdef H5
      this.supported = Boolean(
        typeof navigator !== 'undefined'
        && navigator.mediaDevices
        && typeof navigator.mediaDevices.getUserMedia === 'function'
        && typeof MediaRecorder !== 'undefined',
      );
      this.recordingSupported = this.supported;
      // #endif
    },
    retryNativeStop() {
      const session = this.recorderManager && nativeSessions.get(this.recorderManager);
      if (!session?.stopFailed) return;
      session.stopFailed = false;
      if (this.nativeSession) this.recording = false;
      try {
        this.recorderManager.stop();
      } catch (error) {
        session.stopFailed = true;
        if (this.nativeSession) this.recording = true;
        if (!this.disposed) this.$emit('error', error);
      }
    },
    cancelNativeRecording() {
      const session = this.recorderManager && nativeSessions.get(this.recorderManager);
      if (!session) return;
      session.cancelled = true;
      if (session.stopFailed) {
        this.retryNativeStop();
        return;
      }
      // Keep the session until onStop/onError: the singleton manager does not
      // identify callbacks, so a new recording must not start before it settles.
      if (this.recording) this.stopRecord();
    },
    cancelH5Recording() {
      if (this.recorderManager) return;
      this.recordingRequest += 1;
      this.starting = false;
      const wasRecording = this.recording;
      this.recording = false;
      this.clearTimer();
      if (wasRecording && this.recorder) {
        try {
          this.recorder.stop();
        } catch (error) {
          // A failed or already stopped recorder still needs its tracks released.
        }
      }
      this.releaseMicrophone?.();
      this.releaseMicrophone = null;
      this.stream = null;
      this.recorder = null;
    },
    async prepareH5Recorder(request) {
      // #ifdef H5
      if (!this.supported) return false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.disposed || request !== this.recordingRequest) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      this.stream = stream;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        stream.getTracks().forEach((track) => track.stop());
        if (this.recordingRequest === request) this.stream = null;
      };
      this.releaseMicrophone = release;
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      this.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        try {
          if (this.disposed || request !== this.recordingRequest) return;
          this.recording = false;
          this.clearTimer();
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const duration = Date.now() - this.startAt;
          this.onRecordStop(URL.createObjectURL(blob), duration, blob);
        } finally {
          release();
        }
      };
      return true;
      // #endif
      // #ifndef H5
      // eslint-disable-next-line no-unreachable
      return true;
      // #endif
    },
    async handlePrimaryAction() {
      if (this.recording) {
        this.stopRecord();
        return;
      }
      if (this.audio.path) {
        this.togglePlayback();
        return;
      }
      await this.startRecord();
    },
    async startRecord() {
      if (this.disabled || this.disposed || this.starting || this.selectingFile) return;
      if (this.nativeBusy) {
        this.retryNativeStop();
        return;
      }
      if (this.recording) return;
      this.stopPlayback();
      if (!this.recordingSupported) {
        notify({ title: '请选择已有录音', icon: 'none' });
        return;
      }
      this.starting = true;
      this.recordingRequest += 1;
      const request = this.recordingRequest;
      try {
        if (!this.recorderManager) {
          const ready = await this.prepareH5Recorder(request);
          if (!ready || this.disposed || request !== this.recordingRequest) return;
        }
        const activeRecorder = this.recorderManager || this.recorder;
        if (!activeRecorder) return;
        this.recording = true;
        this.recordingElapsed = 0;
        this.startAt = Date.now();
        this.progressTimer = setInterval(() => {
          this.recordingElapsed = Math.min(MAX_RECORD_MS, Date.now() - this.startAt);
        }, 200);
        this.stopTimer = setTimeout(() => this.stopRecord(true), MAX_RECORD_MS);

        // #ifdef MP-WEIXIN
        if (this.recorderManager) {
          this.nativeSession = { cancelled: false };
          nativeSessions.set(this.recorderManager, this.nativeSession);
          activeRecorder.start({ duration: MAX_RECORD_MS, format: 'mp3' });
        }
        // #endif
        // #ifdef H5
        if (activeRecorder !== this.recorderManager) activeRecorder.start();
        // #endif
      } catch (error) {
        if (this.disposed || request !== this.recordingRequest) return;
        if (this.recorderManager) nativeSessions.delete(this.recorderManager);
        this.nativeSession = null;
        this.cancelH5Recording();
        this.recording = false;
        this.clearTimer();
        this.$emit('error', error);
      } finally {
        if (request === this.recordingRequest) this.starting = false;
      }
    },
    stopRecord(autoStopped = false) {
      const activeRecorder = this.recorderManager || this.recorder;
      if (!this.recording || !activeRecorder) return;
      this.recordingElapsed = Date.now() - this.startAt;
      this.recording = false;
      this.clearTimer();
      try {
        if (this.nativeSession) this.nativeSession.stopFailed = false;
        activeRecorder.stop();
        if (autoStopped) notify({ title: '已自动截取前15秒', icon: 'none' });
      } catch (error) {
        if (this.nativeSession) {
          // Preserve callback ownership until a successful retry settles it.
          this.nativeSession.stopFailed = true;
          this.recording = true;
        }
        if (!this.disposed) this.$emit('error', error);
      }
    },
    onRecordStop(path, duration, blob = null) {
      const resolvedDuration = Number(duration || this.recordingElapsed || 0);
      if (resolvedDuration < MIN_RECORD_MS) {
        notify({ title: '录音太短了，再试一次吧', icon: 'none' });
        return;
      }
      this.emitAudio({
        path,
        name: '刚录好的乡音',
        durationMs: Math.min(resolvedDuration, MAX_RECORD_MS),
        origin: 'record',
        available: true,
        invalid: false,
        mimeType: blob?.type || 'audio/mpeg',
        ...(blob ? { blob } : {}),
      });
    },
    togglePlayback() {
      if (!this.audio.path) return;
      if (this.playing) {
        this.stopPlayback();
        return;
      }
      this.playbackPosition = 0;
      this.playbackDuration = Number(this.audio.durationMs || this.audio.duration || 0);
      this.playing = true;
      this.playbackHandle = playManaged(this.audio.path, {
        onTimeUpdate: ({ currentTime, duration } = {}) => {
          this.playbackPosition = Number(currentTime || 0) * 1000;
          if (duration) this.playbackDuration = Number(duration) * 1000;
        },
        onEnded: () => {
          this.playing = false;
          this.playbackHandle = null;
          this.playbackPosition = 0;
        },
        onError: () => {
          this.playing = false;
          this.playbackHandle = null;
          notify({ title: '录音播放失败', icon: 'none' });
        },
      });
    },
    previewAudio() {
      if (this.audio.path) playAudio(this.audio.path);
    },
    clearAudio() {
      if (this.disabled) return;
      this.cancelNativeRecording();
      this.cancelH5Recording();
      this.stopPlayback();
      this.$emit('clear');
    },
    restartRecording() {
      if (this.disabled || this.disposed || this.selectingFile) return;
      if (this.nativeBusy) {
        this.retryNativeStop();
        return;
      }
      this.cancelH5Recording();
      this.stopPlayback();
      this.$emit('clear');
      this.$nextTick(() => this.startRecord());
    },
    async chooseFile() {
      if (this.disabled || this.disposed || this.selectingFile) return;
      this.selectingFile = true;
      this.cancelNativeRecording();
      this.cancelH5Recording();
      this.selectionRequest += 1;
      const request = this.selectionRequest;
      this.stopPlayback();
      try {
        const selected = await chooseAudioFile();
        if (
          this.disposed || !selected || this.disabled || request !== this.selectionRequest
        ) return;
        this.emitAudio({ ...selected, origin: selected.origin || 'upload' });
      } catch (error) {
        if (this.disposed || this.disabled || request !== this.selectionRequest) return;
        notify({ title: error?.message || '选择录音失败', icon: 'none' });
      } finally {
        this.selectingFile = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.audio-capture {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-5) var(--space-4) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  background: var(--accent-color);
  color: var(--on-accent-color);
  box-shadow: 0 12rpx 32rpx var(--border-color);
}

.record-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.record-title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  line-height: 1.25;
}

.record-subtitle {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  opacity: 0.82;
}

.sound-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 72rpx;
  margin-top: var(--space-5);
}

.sound-wave__bar {
  width: 6rpx;
  height: 18rpx;
  border-radius: var(--radius-pill);
  background: var(--on-accent-color);
  opacity: 0.35;
  transition: height 160ms ease, opacity 160ms ease;
}

.sound-wave__bar:nth-child(2n) { height: 34rpx; }
.sound-wave__bar:nth-child(3n) { height: 50rpx; }
.sound-wave__bar:nth-child(5n) { height: 64rpx; }

.sound-wave__bar--active {
  opacity: 1;
}

.audio-capture--recording .sound-wave__bar--active {
  animation: wave-pulse 720ms ease-in-out infinite alternate;
}

.audio-capture--recording .sound-wave__bar:nth-child(2n) {
  animation-delay: 120ms;
}

.audio-capture--recording .sound-wave__bar:nth-child(3n) {
  animation-delay: 240ms;
}

.audio-capture :deep(.record-primary.t-button) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 184rpx;
  min-width: 184rpx;
  max-width: 184rpx;
  height: 184rpx;
  min-height: 184rpx;
  box-sizing: border-box;
  margin-top: var(--space-3);
  padding: 0;
  border: 12rpx solid var(--accent-subtle-color);
  border-radius: 50%;
  background: var(--surface-color);
  color: var(--accent-color);
  line-height: 1;
}

.record-primary::after {
  border: 0;
}

.record-primary__content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.record-primary:active {
  transform: scale(0.97);
}

.record-primary__icon {
  font-size: 46rpx;
  font-weight: 700;
}

.record-primary__label {
  margin-top: 14rpx;
  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;
}

.record-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 64rpx;
  margin-top: var(--space-2);
}

.record-ready-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  width: 100%;
  max-width: 520rpx;
  margin-top: var(--space-4);
}

.record-ready-action {
  min-width: 0;
}

:deep(.record-ready-action.t-button) {
  border-radius: var(--radius-pill);
}

.audio-capture--disabled {
  opacity: 0.72;
}

.audio-capture--ready:not(.audio-capture--playing):not(.audio-capture--recording) {
  border-color: var(--border-color);
  background: var(--surface-color);
  color: var(--text-color);
}

.audio-capture--ready:not(.audio-capture--playing):not(.audio-capture--recording) .sound-wave__bar {
  background: var(--success-color);
  opacity: 0.62;
}

.audio-capture--ready:not(.audio-capture--playing):not(.audio-capture--recording) .record-primary {
  border-color: var(--accent-subtle-color);
  background: var(--success-color);
  color: var(--on-accent-color);
}

.audio-capture--ready:not(.audio-capture--playing):not(.audio-capture--recording)
  :deep(.record-action),
.audio-capture--ready:not(.audio-capture--playing):not(.audio-capture--recording)
  :deep(.record-action .t-button__content) {
  color: var(--muted-color);
}

@keyframes wave-pulse {
  from { transform: scaleY(0.55); }
  to { transform: scaleY(1); }
}

@media (prefers-reduced-motion: reduce) {
  .audio-capture--recording .sound-wave__bar--active {
    animation: none;
  }
}
.record-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  justify-items: center;
  gap: var(--space-2);
  width: 100%;
}
.record-controls .record-actions {
  margin: 0;
  min-width: 0;
}
.record-controls .record-ready-actions {
  grid-column: 1 / -1;
}
.audio-capture :deep(.record-action.t-button) {
  white-space: normal;
  height: auto;
  min-height: 88rpx;
}
@media screen and (max-width: 360px) {
  .record-controls {
    grid-template-columns: minmax(0, 1fr);
  }
  .record-controls .record-actions {
    order: 2;
    margin-top: var(--space-2);
  }
}
</style>
