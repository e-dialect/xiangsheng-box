<template>
  <view
    class="recording-card"
    :class="{ 'recording-card--compact': compact }"
  >
    <view
      v-if="!compact"
      class="recording-card__texture"
      aria-hidden="true"
    />
    <view
      class="recording-card__author"
    >
      <AvatarFrame
        :src="recording.recorder?.avatar || ''"
        :name="recorderName"
        :size="compact ? 36 : 48"
      />
      <text class="recording-card__author-name">
        {{ recorderName }}
      </text>
      <text
        v-if="compact"
        class="recording-card__duration"
      >
        · {{ Math.round((recording.duration_ms || 0) / 1000) }} 秒
      </text>
    </view>
    <view
      v-if="!compact"
      class="recording-card__meta"
    >
      <text class="recording-card__dialect">
        {{ dialectText }}
      </text>
      <text class="recording-card__type">
        {{ typeText }}
      </text>
    </view>

    <view
      v-if="!compact"
      class="recording-card__title"
    >
      {{ title }}
    </view>
    <view class="recording-card__gloss">
      {{ recording.original_gloss || '贡献者暂未补充大意' }}
    </view>

    <view
      v-if="pronunciationText && !compact"
      class="recording-card__pronunciation"
    >
      {{ pronunciationText }}
    </view>

    <view class="recording-card__actions">
      <BaseButton
        v-if="detailLink"
        size="small"
        variant="ghost"
        text="录音详情"
        @click="goRecordingDetail(recording.id)"
      />
      <BaseButton
        size="small"
        :text="playing ? '停止' : '听录音'"
        @click="toggleAudio"
      />
      <BaseButton
        v-if="entry && !compact"
        size="small"
        variant="ghost"
        text="看词条"
        @click="$emit('open-entry', entry.id)"
      />
    </view>

    <view
      v-if="entry && community"
      class="recording-card__community"
    >
      <BaseButton
        size="small"
        variant="ghost"
        :disabled="attested"
        :text="attested ? '已确认本地使用' : '我这里也这么说'"
        @click="$emit('attest', { entryId: entry.id, dialectId: recording.usage_dialect?.id })"
      />
      <BaseButton
        size="small"
        variant="ghost"
        text="录下我这边的说法"
        @click="$emit('continue', entry.id)"
      />
    </view>
  </view>
</template>

<script>
import { goRecordingDetail } from '@/services/navigation';
import BaseButton from '@/components/BaseButton.vue';
import AvatarFrame from '@/components/AvatarFrame.vue';
import {
  dialectLabel,
  entryTitle,
  primaryEntryLink,
} from '@/services/entryRecording';
import { onExternalStop, playManaged, stopAudio } from '@/utils/audio';

const TYPE_LABELS = {
  word: '词',
  phrase: '短语',
  example: '例句',
  other: '其他录音',
};

export default {
  name: 'EntryRecordingCard',
  components: { AvatarFrame, BaseButton },
  props: {
    recording: { type: Object, required: true },
    community: { type: Boolean, default: true },
    compact: { type: Boolean, default: false },
    detailLink: { type: Boolean, default: true },
    attested: { type: Boolean, default: false },
  },
  emits: ['attest', 'continue', 'open-entry'],
  data() {
    return {
      playing: false,
      playbackHandle: null,
    };
  },
  computed: {
    primaryLink() {
      return primaryEntryLink(this.recording);
    },
    entry() {
      return this.primaryLink?.entry || null;
    },
    recorderName() {
      return this.recording.recorder?.nickname
        || this.recording.recorder?.username
        || '乡音贡献者';
    },
    title() {
      return this.entry ? entryTitle(this.entry) : '待整理乡音';
    },
    dialectText() {
      return dialectLabel(this.recording.usage_dialect);
    },
    typeText() {
      return TYPE_LABELS[this.recording.recording_type] || TYPE_LABELS.other;
    },
    pronunciationText() {
      const variant = this.entry?.pronunciation_variants?.[0];
      return variant?.surface_romanization || variant?.base_romanization || variant?.ipa || '';
    },
  },
  mounted() {
    this.unsubscribeAudio = onExternalStop((handle) => {
      if (handle !== this.playbackHandle) return;
      this.playing = false;
      this.playbackHandle = null;
    });
  },
  beforeUnmount() {
    if (this.playbackHandle) stopAudio();
    this.unsubscribeAudio?.();
  },
  methods: {
    goRecordingDetail,
    toggleAudio() {
      if (this.playing) {
        stopAudio();
        this.playing = false;
        this.playbackHandle = null;
        return;
      }
      this.playing = true;
      this.playbackHandle = playManaged(this.recording.audio_url, {
        onEnded: () => {
          this.playing = false;
          this.playbackHandle = null;
        },
        onError: () => {
          this.playing = false;
          this.playbackHandle = null;
          uni.showToast({ title: '录音播放失败', icon: 'none' });
        },
      });
      if (!this.playbackHandle) this.playing = false;
    },
  },
};
</script>

<style scoped>
.recording-card.recording-card--compact {
  padding: 0;
  border: 0;
  box-shadow: none;
  background: transparent;
}
.recording-card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: var(--dress-card-padding, 30rpx);
  border-radius: var(--dress-card-border-radius, var(--radius-lg));
  background: var(--dress-card-background, var(--surface-color));
  border:
    var(--dress-card-border-width, 1rpx)
    solid var(--dress-card-border-color, var(--border-color));
  box-shadow: var(--dress-card-shadow, none);
}

.recording-card__texture {
  position: absolute;
  z-index: -1;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  opacity: var(--dress-card-texture-opacity, var(--dress-grain-opacity, 0));
  background-image: var(--dress-card-texture-image, var(--dress-grain-image, none));
  background-size: var(--dress-card-texture-size, var(--dress-grain-size, 46rpx 46rpx));
}

.recording-card__author {
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: var(--muted-color);
  font-size: 22rpx;
}

.recording-card__author-name {
  min-width: 0;
  max-width: 60%;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recording-card__duration {
  flex: 0 0 auto;
}

.recording-card__meta,
.recording-card__actions,
.recording-card__community {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.recording-card__meta {
  margin-top: 16rpx;
  justify-content: space-between;
  color: var(--muted-color);
  font-size: 22rpx;
}

.recording-card__dialect {
  padding: var(--dress-card-tag-padding, 6rpx 14rpx);
  border:
    var(--dress-card-tag-border-width, 0px)
    solid var(--dress-card-tag-border-color, transparent);
  border-radius: var(--dress-card-tag-border-radius, var(--radius-pill));
  background: var(--dress-card-tag-background, var(--accent-subtle-color));
  color: var(--dress-card-tag-color, var(--accent-color));
}

.recording-card__title {
  margin-top: 18rpx;
  color: var(--text-color);
  font-size: 42rpx;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.recording-card__gloss {
  margin-top: 12rpx;
  color: var(--text-secondary-color);
  font-size: 28rpx;
  line-height: 1.65;
}

.recording-card__pronunciation {
  margin-top: 14rpx;
  color: var(--accent-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.recording-card__actions {
  margin-top: 24rpx;
}

.recording-card__community {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid var(--border-color);
  flex-wrap: wrap;
}
</style>
