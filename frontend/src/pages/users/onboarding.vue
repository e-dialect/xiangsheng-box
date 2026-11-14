<template>
  <PageShell
    :title="pageTitle"
    :show-back="false"
    content-class="auth-page"
  >
    <AuthJourney
      eyebrow="完善乡声身份"
      :title="stepTitle"
      :lead="stepCopy"
      :step="journeyStep"
      :step-total="journeyTotal"
      :step-label="journeyStepLabel"
    >
      <view
        v-if="step === 1"
        class="auth-form"
      >
        <BaseField
          v-model="nickname"
          class="nickname-input"
          name="nickname"
          label="怎么称呼你"
          placeholder="输入昵称"
          :maxlength="100"
          :error="error"
          @input="error = ''"
        />
        <BaseButton
          block
          @click="next"
        >
          继续选择主方言
        </BaseButton>
      </view>

      <template v-else>
        <view class="dialect-card">
          <view class="field-label">
            主方言（必选）
          </view>
          <view class="field-hint">
            选择你日常最常说的方言。
          </view>
          <view
            v-if="loadingDialects"
            class="loading-shell loading-shell--dialects"
          >
            <BaseLoading text="正在加载方言树…" />
          </view>
          <EmptyState
            v-else-if="dialectsError"
            title="方言树加载失败"
            description="检查网络后重试；也可以先退出账号回游客模式，稍后再完成设置。"
            action-text="重新加载"
            @action="loadDialects"
          />
          <template v-else-if="selectedDialect">
            <view
              class="dialect-selection"
              role="button"
              aria-label="更换主方言"
              @tap="dialectPickerOpen = true"
            >
              <view>
                <view class="dialect-selection__name">
                  {{ selectedDialectCardLabel }}
                </view>
                <view class="dialect-selection__path">
                  {{ selectedDialectLabel }}
                </view>
              </view>
              <text class="dialect-selection__action">
                更换 ›
              </text>
            </view>
          </template>
          <BaseButton
            v-else
            block
            variant="ghost"
            text="逐级选择主方言"
            @click="dialectPickerOpen = true"
          />
        </view>

        <DialectSelector
          v-model:visible="dialectPickerOpen"
          :value="selectedDialectId"
          :dialects="dialects"
          :default-dialect="currentUserDialect"
          :owner-scope="userId"
          title="选择主方言"
          @change="onDialectChange"
        />

        <view
          v-if="selectedDialectId"
          class="sample-card"
        >
          <view class="sample-kicker">
            真实乡音样本
          </view>
          <view
            v-if="loadingSample"
            class="loading-copy"
          >
            正在寻找公开录音…
          </view>
          <template v-else-if="sample">
            <view class="sample-title">
              {{ sampleTitle }}
            </view>
            <view class="sample-meta">
              {{ selectedDialectLabel }} · {{ sampleDuration }}
            </view>
            <BaseButton
              variant="ghost"
              size="small"
              @click="playSample"
            >
              ▶ 试听这段乡音
            </BaseButton>
          </template>
          <view
            v-else
            class="sample-empty"
          >
            这个方言点暂时没有公开录音，仍然可以选为主方言。
          </view>
        </view>

        <view
          v-if="error"
          class="error"
        >
          {{ error }}
        </view>
        <view class="button-row">
          <BaseButton
            variant="ghost"
            :disabled="saving"
            @click="previous"
          >
            上一步
          </BaseButton>
          <BaseButton
            :disabled="saving"
            @click="finish"
          >
            {{ saving ? '正在保存…' : '完成设置' }}
          </BaseButton>
        </view>
      </template>

      <template #footer>
        <view
          class="logout-button"
          @tap="abandon"
        >
          退出账号，返回游客模式
        </view>
      </template>
    </AuthJourney>
  </PageShell>
</template>

<script>
import AuthJourney from '@/pages/login/components/AuthJourney.vue';
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import { goLogin, goSearch } from '@/services/navigation';
import { toFollowRecommendations } from '@/routers/user';
import {
  loadDialectSample,
  normalizeOnboardingReason,
  ONBOARDING_REASONS,
  saveDialectProfile,
} from '@/services/dialectOnboarding';
import { listAllDialects } from '@/services/guantou';
import { entryTitle, primaryEntryLink } from '@/services/entryRecording';
import { resumeInterruptedPageAfterLogin } from '@/services/login';
import { clearUserInfo } from '@/services/user';
import { markRaw } from 'vue';
import { onExternalStop, playManaged, stopAudio } from '@/utils/audio';
import { dialectBreadcrumb, dialectCardLabel } from '@/utils/dialectTree';

export default {
  components: {
    AuthJourney, PageShell, BaseButton, BaseField, BaseLoading, DialectSelector, EmptyState,
  },
  data() {
    const user = getApp().globalData.userInfo || {};
    return {
      dialects: [],
      dialectsError: false,
      dialectPickerOpen: false,
      error: '',
      loadingDialects: true,
      loadingSample: false,
      nickname: user.nickname || user.username || '',
      reason: ONBOARDING_REASONS.MISSING_DIALECT,
      sample: null,
      sampleRequestId: 0,
      samplePlayback: null,
      pageActive: true,
      saving: false,
      saveGeneration: 0,
      selectedDialectId: user.primary_dialect?.id || null,
      step: 1,
      userId: user.id || uni.getStorageSync('id'),
    };
  },
  computed: {
    isNewUser() {
      return this.reason === ONBOARDING_REASONS.NEW_USER;
    },
    pageTitle() {
      return this.isNewUser ? '欢迎加入乡声集盒' : '补选主方言';
    },
    journeyStep() {
      return this.isNewUser ? this.step + 2 : this.step;
    },
    journeyTotal() {
      return this.isNewUser ? 4 : 2;
    },
    journeyStepLabel() {
      return this.step === 1 ? '设置称呼' : '选择主方言';
    },
    stepTitle() {
      if (this.step === 1) return this.isNewUser ? '先认识一下' : '确认你的昵称';
      return '选择主方言';
    },
    stepCopy() {
      if (this.step === 1) {
        return this.isNewUser
          ? '昵称和主方言会组成你的基础方言身份。'
          : '你的账号还没有主方言，补全后才能继续贡献。';
      }
      return '设置后仍可浏览和贡献其他方言。';
    },
    selectedDialect() {
      return this.dialects.find((dialect) => dialect.id === this.selectedDialectId) || null;
    },
    currentUserDialect() {
      return getApp().globalData.userInfo?.primary_dialect || null;
    },
    selectedDialectLabel() {
      return this.selectedDialect
        ? dialectBreadcrumb(this.selectedDialect, this.dialects)
        : '';
    },
    selectedDialectCardLabel() {
      return this.selectedDialect
        ? dialectCardLabel(this.selectedDialect, this.dialects)
        : '';
    },
    sampleTitle() {
      return entryTitle(primaryEntryLink(this.sample || {})?.entry || {})
        || this.sample?.original_gloss
        || '未命名乡音';
    },
    sampleDuration() {
      const milliseconds = Number(this.sample?.duration_ms || 0);
      return milliseconds ? `${Math.max(1, Math.round(milliseconds / 1000))} 秒` : '时长未知';
    },
  },
  created() {
    this.unsubscribeSampleStop = onExternalStop((handle) => {
      if (this.samplePlayback?.handle === handle) this.samplePlayback = null;
    });
  },
  onShow() {
    this.pageActive = true;
    if (this.selectedDialectId && !this.sample && !this.loadingSample) {
      this.loadSample(this.selectedDialectId);
    }
  },
  onHide() {
    this.leaveSample();
  },
  onUnload() {
    this.leaveSample();
  },
  beforeUnmount() {
    this.leaveSample();
    this.unsubscribeSampleStop?.();
  },
  async onLoad(options = {}) {
    this.reason = normalizeOnboardingReason(options.reason);
    if (!this.userId) {
      goLogin({}, { reset: true });
      return;
    }
    await this.loadDialects();
  },
  onBackPress() {
    uni.showToast({ title: '请先完成主方言设置，或退出账号', icon: 'none' });
    return true;
  },
  methods: {
    async loadDialects() {
      this.loadingDialects = true;
      this.dialectsError = false;
      try {
        this.dialects = await listAllDialects();
        if (this.selectedDialectId) await this.loadSample(this.selectedDialectId);
      } catch (error) {
        this.dialectsError = true;
      } finally {
        this.loadingDialects = false;
      }
    },
    next() {
      const nickname = String(this.nickname || '').trim();
      if (!nickname) {
        this.error = '请输入昵称';
        return;
      }
      this.nickname = nickname;
      this.error = '';
      this.step = 2;
    },
    previous() {
      this.stopSample();
      this.step = 1;
    },
    stopSample() {
      if (!this.samplePlayback) return;
      this.samplePlayback = null;
      // External replacement and terminal callbacks clear ownership first.
      stopAudio();
    },
    leaveSample() {
      this.saveGeneration += 1;
      this.pageActive = false;
      this.sampleRequestId += 1;
      this.loadingSample = false;
      this.stopSample();
    },
    async selectDialect(dialect) {
      this.stopSample();
      this.selectedDialectId = dialect.id;
      this.error = '';
      await this.loadSample(dialect.id);
    },
    async onDialectChange({ dialect }) {
      await this.selectDialect(dialect);
    },
    async loadSample(dialectId) {
      if (!this.pageActive) return;
      this.sample = null;
      const requestId = this.sampleRequestId + 1;
      this.sampleRequestId = requestId;
      this.loadingSample = true;
      try {
        const sample = await loadDialectSample(dialectId);
        if (requestId === this.sampleRequestId) this.sample = sample;
      } catch (error) {
        if (requestId === this.sampleRequestId) this.sample = null;
      } finally {
        if (requestId === this.sampleRequestId) this.loadingSample = false;
      }
    },
    playSample() {
      if (!this.pageActive || this.step !== 2 || this.loadingSample) return;
      const src = this.sample?.audio_url;
      if (!src || src === 'null') {
        uni.showToast({ title: '不是一个可用文件', icon: 'error' });
        return;
      }
      this.stopSample();
      const playback = markRaw({ handle: null });
      this.samplePlayback = playback;
      const settle = (failed = false) => {
        if (this.samplePlayback !== playback) return;
        this.samplePlayback = null;
        playback.handle?.destroy();
        if (failed) uni.showToast({ title: '播放失败', icon: 'none' });
      };
      uni.showToast({ title: '正在播放...', icon: 'none' });
      try {
        playback.handle = playManaged(src, {
          onEnded: () => settle(),
          onError: () => settle(true),
        });
        if (playback.handle) {
          // Both this page and newer shared players may release on completion.
          // Make our handle safe to release once without touching other audio.
          const destroy = playback.handle.destroy.bind(playback.handle);
          let disposed = false;
          playback.handle.destroy = () => {
            if (disposed) return;
            disposed = true;
            destroy();
          };
        }
        if (this.samplePlayback !== playback) playback.handle?.destroy();
      } catch (error) {
        settle(true);
      }
    },
    async finish() {
      if (this.saving || !this.pageActive) return;
      if (!this.selectedDialectId) {
        this.error = '请选择主方言';
        return;
      }
      this.stopSample();
      this.error = '';
      this.saving = true;
      const generation = this.saveGeneration;
      try {
        const user = await saveDialectProfile(this.userId, {
          nickname: this.nickname,
          primaryDialectId: this.selectedDialectId,
        });
        if (!user || generation !== this.saveGeneration || !this.pageActive) return;
        uni.showToast({ title: '方言身份已设置', icon: 'success' });
        if (!resumeInterruptedPageAfterLogin(this.userId)) toFollowRecommendations(true);
      } catch (error) {
        if (generation === this.saveGeneration && this.pageActive) {
          this.error = error.message || '暂时无法保存，请重试';
        }
      } finally {
        this.saving = false;
      }
    },
    abandon() {
      this.leaveSample();
      clearUserInfo();
      goSearch({ reset: true });
    },
  },
};
</script>

<style scoped>
.sample-kicker {
  color: var(--accent-color);
  font-size: 22rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
}

.field-hint {
  margin-top: 12rpx;
  color: var(--text-secondary-color);
  font-size: 26rpx;
  line-height: 1.6;
}

.sample-card {
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 28rpx;
}

.dialect-card {
  padding: 2rpx 0 4rpx;
}

.field-label {
  color: var(--text-color);
  font-size: 29rpx;
  font-weight: 800;
}

/* 方言树加载占位与列表高度对齐，避免加载完成后布局跳动 */
.loading-shell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-shell--dialects {
  min-height: 320rpx;
}

.sample-empty {
  padding: 28rpx 0 8rpx;
  color: var(--muted-color);
  font-size: 25rpx;
  line-height: 1.5;
}

.dialect-selection {
  min-height: 104rpx;
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border: 1rpx solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--accent-subtle-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  box-sizing: border-box;
}

.dialect-selection__name {
  font-size: 28rpx;
  font-weight: 700;
}

.dialect-selection__path {
  margin-top: 6rpx;
  color: var(--muted-color);
  font-size: 22rpx;
}

.dialect-selection__action {
  flex: 0 0 auto;
  color: var(--accent-color);
  font-size: 24rpx;
}

.sample-card {
  margin-top: 20rpx;
  background: var(--accent-subtle-color);
}

.sample-title {
  margin-top: 14rpx;
  color: var(--text-color);
  font-size: 34rpx;
  font-weight: 800;
}

.sample-meta {
  margin-top: 8rpx;
  color: var(--muted-color);
  font-size: 24rpx;
}

.sample-card .base-button {
  margin-top: 22rpx;
}

.error {
  margin-top: 18rpx;
  color: var(--danger-color);
  font-size: 25rpx;
}

.button-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin-top: 24rpx;
}

.logout-button {
  margin: 28rpx auto 2rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid var(--border-color);
  color: var(--muted-color);
  font-size: 24rpx;
  text-align: center;
  transition: color 0.2s ease;
}

.logout-button:active {
  color: var(--danger-color);
}

@media (prefers-reduced-motion: reduce) {
  .dialect-selection,
  .logout-button {
    transition: none;
  }
}

:deep(.auth-page) {
  background: linear-gradient(
    180deg,
    var(--accent-subtle-color) 0%,
    var(--page-color) 36%,
    var(--surface-subtle-color) 100%
  );
}
.button-row > .base-button {
  width: 100%;
}
.dialect-selection > view {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
