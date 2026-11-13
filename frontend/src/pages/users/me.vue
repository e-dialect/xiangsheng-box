<template>
  <AppShell
    title="我的账户"
    active="me"
  >
    <view class="account-page">
      <template v-if="loggedIn">
        <view
          v-if="loading"
          class="state-card"
        >
          正在读取你的乡音档案…
        </view>
        <view
          v-else-if="loadError"
          class="state-card"
        >
          <view>{{ loadError }}</view>
          <BaseButton
            class="state-action"
            block
            @click="getInfo"
          >
            重试
          </BaseButton>
        </view>
        <template v-else>
          <view class="hero">
            <image
              v-if="avatar"
              :src="avatar"
              class="avatar avatar--image pressable"
              mode="aspectFill"
              role="button"
              aria-label="编辑头像"
              @tap="toUserInfoPage"
            />
            <view
              v-else
              class="avatar avatar--fallback pressable"
              role="button"
              aria-label="编辑头像"
              @tap="toUserInfoPage"
            >
              {{ avatarFallback }}
            </view>
            <view class="hero-copy">
              <view class="name">
                {{ nickname || '未填写昵称' }}
              </view>
              <view class="handle">
                乡声号 {{ username || '未设置' }}
              </view>
              <view class="bio">
                {{ bioText }}
              </view>
              <view class="meta-row">
                <view
                  v-if="primaryDialect"
                  class="dialect-badge"
                >
                  {{ locationText }}
                </view>
                <view
                  v-else
                  class="meta"
                >
                  未填写方言点
                </view>
              </view>
            </view>
          </view>

          <view class="social-stats">
            <view class="social-stat">
              <view class="number">
                {{ recordingsCount }}
              </view>
              <view class="label">
                录音
              </view>
            </view>
            <view class="social-stat">
              <view class="number">
                {{ followingCount }}
              </view>
              <view class="label">
                关注
              </view>
            </view>
            <view class="social-stat">
              <view class="number">
                {{ followerCount }}
              </view>
              <view class="label">
                粉丝
              </view>
            </view>
          </view>

          <view class="profile-actions">
            <view class="action-slot">
              <BaseButton
                variant="ghost"
                size="small"
                block
                @click="toUserInfoPage"
              >
                编辑资料
              </BaseButton>
            </view>
            <view class="action-slot">
              <BaseButton
                variant="ghost"
                size="small"
                block
                @click="toMailsPage"
              >
                {{ unreadMailsCount > 0 ? `消息 ${unreadMailsCount}` : '消息' }}
              </BaseButton>
            </view>
          </view>

          <view
            v-if="followedDialects.length"
            class="dialect-follow"
          >
            <view class="section-kicker">
              关注的方言
            </view>
            <view class="chip-row">
              <view
                v-for="dialect in followedDialects"
                :key="dialect.id"
                class="dialect-badge"
              >
                {{ dialectCardLabel(dialect) }}
              </view>
            </view>
          </view>

          <view class="works">
            <view
              class="contribution-stats"
              aria-label="贡献概览"
            >
              <view
                v-for="item in contributionMetrics"
                :key="item.label"
                class="contribution-stat"
              >
                <text class="number">
                  {{ item.value }}
                </text>
                <text class="label">
                  {{ item.label }}
                </text>
              </view>
            </view>
            <BaseButton
              block
              variant="ghost"
              text="查看贡献履历"
              @click="toContributionHistory"
            />
          </view>

          <view class="archive-menu">
            <view class="section-kicker menu-kicker">
              档案导航
            </view>
            <t-cell
              title="我的集盒"
              note="按词条收集各地乡音"
              arrow
              hover
              custom-style="padding: var(--space-3); background: transparent;"
              aria-label="查看我的集盒"
              role="button"
              tabindex="0"
              @click="goCollections({ mine: true })"
              @keydown.enter="goCollections({ mine: true })"
              @keydown.space.prevent="goCollections({ mine: true })"
            />
            <t-cell
              title="录音草稿"
              note="仅保存在当前设备"
              arrow
              hover
              custom-style="padding: var(--space-3); background: transparent;"
              aria-label="查看录音草稿"
              role="button"
              tabindex="0"
              @click="goRecordingDrafts"
              @keydown.enter="goRecordingDrafts"
              @keydown.space.prevent="goRecordingDrafts"
            />
            <t-cell
              title="词条收藏"
              note="仅自己可见"
              arrow
              hover
              custom-style="padding: var(--space-3); background: transparent;"
              aria-label="查看词条收藏"
              role="button"
              tabindex="0"
              @click="toBookmarks"
              @keydown.enter="toBookmarks"
              @keydown.space.prevent="toBookmarks"
            />
            <t-cell
              title="关注方言"
              :note="`${followedDialects.length} 个`"
              arrow
              hover
              :bordered="false"
              custom-style="padding: var(--space-3); background: transparent;"
              :aria-label="`查看关注方言，当前 ${followedDialects.length} 个`"
              role="button"
              tabindex="0"
              @click="toCircleList"
              @keydown.enter="toCircleList"
              @keydown.space.prevent="toCircleList"
            />
          </view>

          <AccountSettingsMenu
            :theme-label="themeLabel"
            :email="email"
            :show-wechat="showWechatMenu"
            :wechat-bound="wechatBound"
            :wechat-busy="isBinding"
            @theme="toThemeCenter"
            @profile="toUserInfoPage"
            @email="toEmailPage"
            @password="toChangePasswordPage"
            @wechat="onWechatMenuTap"
            @logout="exit"
          />

          <view class="account-section">
            <view class="section-kicker">
              录音与授权
            </view>
            <view class="account-section__copy">
              每段录音独立保存授权说明；设备位置不会随录音上传。你可以在录音时填写引用范围。
            </view>
            <BaseButton
              class="account-section__action"
              size="small"
              variant="ghost"
              text="录一段并设置授权"
              @click="toCreate"
            />
          </view>

          <view class="account-section">
            <view class="section-kicker">
              产品改进统计
            </view>
            <view class="account-section__copy">
              只统计听、查、录、补证和整理任务是否成功；不记录搜索原词、录音内容、账号编号或设备位置。原始事件最长保留 90 天，之后只留日汇总。
            </view>
          </view>

          <view class="account-section">
            <view class="section-kicker">
              {{ curationSummary ? '管理与审核' : '申请成为整理员' }}
            </view>
            <view class="account-section__copy">
              <template v-if="curationSummary">
                当前有 {{ curatorPending }} 项待办。词条整理与地区整理按授权范围显示，不进入 Django 系统后台。
              </template>
              <template v-else>
                熟悉本地方言写法、读音或资料来源？可申请词条整理或地区整理权限；授权范围和期限会公开记录。
              </template>
            </view>
            <BaseButton
              class="account-section__action"
              size="small"
              :text="curationActionText"
              @click="toCuration"
            />
          </view>
        </template>
      </template>

      <template v-else>
        <view class="guest-profile immersive-shell">
          <view class="guest-profile__meta">
            <view class="guest-eyebrow">
              还没有登录 · 也可以先逛
            </view>
            <view
              class="guest-mark"
              aria-hidden="true"
            >
              乡
            </view>
          </view>
          <view class="guest-title">
            把自己的乡音带进来
          </view>
          <view class="guest-copy">
            登录后，录音、收藏和贡献履历都会稳稳留在你的档案里。公开乡音无需登录，先听也完全可以。
          </view>
          <view class="guest-benefits">
            <text>
              录下乡音
            </text>
            <text>
              收藏词条
            </text>
            <text>
              查看履历
            </text>
          </view>
          <BaseButton
            class="guest-action guest-primary login-button"
            block
            variant="light"
            @click="openLoginFromMine"
          >
            登录或创建账户
          </BaseButton>
          <view class="guest-shortcuts">
            <t-cell
              class="guest-shortcut pressable"
              title="听乡音"
              description="先逛逛"
              arrow
              hover
              :bordered="false"
              custom-style="min-height: 56px; padding: var(--space-3);"
              aria-label="先去听乡音"
              role="button"
              tabindex="0"
              @click="toHome"
              @keydown.enter.space.prevent="toHome"
            />
            <t-cell
              class="guest-shortcut pressable"
              title="查词条"
              description="找一找"
              arrow
              hover
              :bordered="false"
              custom-style="min-height: 56px; padding: var(--space-3);"
              aria-label="先去查词条"
              role="button"
              tabindex="0"
              @click="toSearch"
              @keydown.enter.space.prevent="toSearch"
            />
          </view>
        </view>
        <view class="menu guest-theme">
          <view class="section-kicker menu-kicker">
            主题
          </view>
          <t-cell
            class="guest-theme__action"
            title="主题中心"
            :note="themeLabel"
            arrow
            hover
            :bordered="false"
            custom-style="min-height: 48px; padding: var(--space-3) 0 0; background: transparent;"
            :aria-label="`打开主题中心，当前 ${themeLabel}`"
            role="button"
            tabindex="0"
            @click="toThemeCenter"
            @keydown.enter.space.prevent="toThemeCenter"
          />
        </view>
      </template>
    </view>
  </AppShell>
</template>

<script>
import TCell from '@tdesign/uniapp/cell/cell.vue';
import AppShell from '@/components/AppShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import confirmDialog from '@/components/ConfirmDialog';
import { notify, notifySuccess } from '@/services/feedback';
import { openLoginFromMine } from '@/services/authJourney';
import { getCurationSummary } from '@/services/entryRecording';
import { CAPABILITIES, isCapabilityEnabled } from '@/services/capabilities';
import {
  goCollections,
  goRecordingDrafts,
  goCircleList,
  goContributionHistory,
  goCurationWorkbench,
  goCuratorApplication,
  goHome,
  goMails,
  goRecord,
  goSearch,
  goEntryBookmarks,
  goThemeCenter,
  goUserEmail,
  goUserInformation,
  goUserPassword,
} from '@/services/navigation';
import { resolveSessionUserId } from '@/services/session';
import { getActiveTheme } from '@/services/themeCenter';
import { dialectCardLabel } from '@/utils/dialectTree';
import {
  bindingWechat as bindingWechatService,
  cancelBindingWechat as cancelBindingWechatService,
  clearUserInfo,
  getUserInfo,
} from '@/services/user';
import AccountSettingsMenu from './settings/components/AccountSettingsMenu.vue';

export default {
  components: {
    AppShell, BaseButton, TCell, AccountSettingsMenu,
  },
  data() {
    return {
      id: '',
      avatar: '',
      nickname: '',
      username: '',
      primaryDialect: null,
      recordingsCount: 0,
      sensesCount: 0,
      entriesCount: 0,
      evidenceCount: 0,
      followerCount: 0,
      followingCount: 0,
      unreadMailsCount: 0,
      followedDialects: [],
      email: '',
      themeLabel: getActiveTheme().name,
      wechatBound: false,
      canUseWechatAuth: isCapabilityEnabled(CAPABILITIES.WECHAT_AUTH),
      isBinding: false,
      loading: Boolean(uni.getStorageSync('token')),
      loadError: '',
      loggedIn: Boolean(uni.getStorageSync('token')),
      curationSummary: null,
    };
  },
  computed: {
    avatarFallback() {
      const displayName = String(this.nickname || '').trim()
        || String(this.username || '').trim();
      return displayName.slice(0, 1) || '乡';
    },
    locationText() {
      return dialectCardLabel(this.primaryDialect);
    },
    bioText() {
      const dialect = this.locationText;
      return `在「${dialect}」记录乡音`;
    },
    contributionMetrics() {
      return [
        { label: '录音', value: this.recordingsCount },
        { label: '词条', value: this.entriesCount },
        { label: '义项', value: this.sensesCount },
      ];
    },
    showWechatMenu() {
      return this.canUseWechatAuth || this.wechatBound;
    },
    curatorPending() {
      const pending = this.curationSummary?.pending || {};
      const currentKeys = [
        'legacy_candidates', 'entries', 'senses', 'recordings',
        'pronunciations', 'recording_links',
      ];
      if (currentKeys.some((key) => Object.prototype.hasOwnProperty.call(pending, key))) {
        return currentKeys.reduce((total, key) => total + Number(pending[key] || 0), 0);
      }
      return Object.values(pending).reduce(
        (total, value) => total + Number(value || 0),
        0,
      );
    },
    curationActionText() {
      if (!this.curationSummary) return '提交整理员申请';
      return `进入工作台${this.curatorPending ? `（${this.curatorPending}）` : ''}`;
    },
  },
  beforeMount() {
    this.getInfo();
  },
  onShow() {
    this.themeLabel = getActiveTheme().name;
    this.canUseWechatAuth = isCapabilityEnabled(CAPABILITIES.WECHAT_AUTH);
    this.loggedIn = Boolean(uni.getStorageSync('token'));
    if (this.loggedIn) this.getInfo();
  },
  methods: {
    dialectCardLabel,
    toMailsPage() {
      goMails();
    },
    toChangePasswordPage() {
      goUserPassword();
    },
    toEmailPage() {
      goUserEmail();
    },
    toThemeCenter() {
      goThemeCenter();
    },
    toUserInfoPage() {
      goUserInformation();
    },
    openLoginFromMine,
    toSearch() {
      goSearch();
    },
    toHome() {
      goHome();
    },
    toCreate() {
      goRecord();
    },
    goCollections,
    goRecordingDrafts,
    toBookmarks() { goEntryBookmarks(); },
    toCircleList() { goCircleList(); },
    toContributionHistory() {
      goContributionHistory();
    },
    toCuration() {
      if (this.curationSummary) goCurationWorkbench();
      else goCuratorApplication();
    },
    async getInfo() {
      const id = resolveSessionUserId();
      if (!id) {
        this.loading = false;
        if (!uni.getStorageSync('token')) this.loggedIn = false;
        return;
      }
      this.loading = true;
      this.loadError = '';
      try {
        const userInfo = await getUserInfo(id, true);
        this.id = userInfo.user.id;
        this.avatar = userInfo.user.avatar;
        this.username = userInfo.user.username || '';
        this.nickname = userInfo.user.nickname || userInfo.user.username;
        this.primaryDialect = userInfo.user.primary_dialect;
        this.recordingsCount = userInfo.contribution.recordings_total
          ?? userInfo.contribution.recordings ?? 0;
        this.entriesCount = userInfo.contribution.entries_total
          ?? userInfo.contribution.entries ?? 0;
        this.sensesCount = userInfo.contribution.senses_total
          ?? userInfo.contribution.senses ?? 0;
        this.evidenceCount = userInfo.contribution.evidence ?? 0;
        this.followerCount = userInfo.user.follower_count || 0;
        this.followingCount = userInfo.user.following_count || 0;
        this.followedDialects = userInfo.user.followed_dialects || [];
        this.unreadMailsCount = userInfo.notification
          ? userInfo.notification.statistics.unread
          : 0;
        this.email = userInfo.user.email || '';
        this.wechatBound = Boolean(userInfo.user.wechat);
        await this.loadCurationSummary();
      } catch (error) {
        this.loadError = error?.message || '档案加载失败，请检查网络后重试';
      } finally {
        this.loading = false;
      }
    },
    async loadCurationSummary() {
      try {
        this.curationSummary = await getCurationSummary();
      } catch (error) {
        this.curationSummary = null;
      }
    },
    async exit() {
      const confirmed = await confirmDialog({
        title: '退出登录？',
        content: '退出后将回到游客模式，本地草稿仍会保留。',
        confirmText: '退出',
        danger: true,
      });
      if (!confirmed) return;
      clearUserInfo();
      goHome(true);
      notifySuccess('登出成功');
    },
    async onWechatMenuTap() {
      const id = resolveSessionUserId();
      if (this.isBinding || !id) return;
      if (this.wechatBound) {
        await this.unbindWechat(id);
        return;
      }
      if (!this.canUseWechatAuth) return;
      await this.bindWechat(id);
    },
    async bindWechat(id) {
      const confirmed = await confirmDialog({
        title: '绑定当前微信？',
        content: '绑定后可用这个微信一键登录。头像请到编辑资料里授权，昵称请到修改昵称里填入。',
        confirmText: '去授权',
      });
      if (!confirmed) return;
      this.isBinding = true;
      try {
        await bindingWechatService(id, false);
        notifySuccess('绑定成功');
        await this.getInfo();
        const goEdit = await confirmDialog({
          title: '要用微信头像吗？',
          content: '去编辑资料可授权微信头像；去修改昵称可填入微信昵称。',
          confirmText: '去编辑资料',
          cancelText: '稍后',
        });
        if (goEdit) goUserInformation();
      } catch (err) {
        await this.handleBindError(id, err);
      } finally {
        this.isBinding = false;
      }
    },
    async handleBindError(id, err) {
      const message = err?.message || '绑定失败，请检查网络后重试';
      if (err?.statusCode === 409 && message.includes('该账户已绑定微信')) {
        const overwrite = await confirmDialog({
          title: '更换绑定的微信？',
          content: '这个账号已经绑过微信。要用现在这个微信替换吗？',
          confirmText: '替换',
        });
        if (!overwrite) return;
        try {
          await bindingWechatService(id, true);
          notifySuccess('绑定成功');
          await this.getInfo();
        } catch (retryError) {
          notify({ title: retryError?.message || '绑定失败，请检查网络后重试' });
        }
        return;
      }
      notify({ title: message });
    },
    async unbindWechat(id) {
      if (!this.email) {
        const goEmail = await confirmDialog({
          title: '还不能解绑',
          content: '解绑前请先绑定邮箱，否则可能无法再登录这个账号。',
          confirmText: '去绑定邮箱',
        });
        if (goEmail) goUserEmail();
        return;
      }
      const confirmed = await confirmDialog({
        title: '解绑微信？',
        content: '解绑后不能再用这个微信登录，邮箱和密码登录不受影响。',
        confirmText: '解绑',
        danger: true,
      });
      if (!confirmed) return;
      this.isBinding = true;
      try {
        await cancelBindingWechatService(id);
        notifySuccess('解绑成功');
        await this.getInfo();
      } catch (err) {
        notify({ title: (err && err.message) || '解绑失败，请检查网络后重试' });
      } finally {
        this.isBinding = false;
      }
    },
  },
};
</script>

<style scoped>
.account-page {
  color: var(--dress-home-bg-color, var(--text-color));
  background: var(--dress-home-bg-background, transparent);
}

.state-card,
.guest-theme {
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  box-sizing: border-box;
}

.state-card {
  color: var(--text-secondary-color);
}

.state-action {
  margin-top: var(--space-3);
}

.guest-profile {
  position: relative;
  max-width: 620rpx;
  margin: 24rpx auto 0;
  padding: 38rpx 34rpx 32rpx;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 88% 4%, var(--immersive-glow-color), transparent 32%),
    linear-gradient(
      150deg,
      var(--immersive-bg-strong-color),
      var(--immersive-bg-soft-color) 58%,
      var(--immersive-bg-color)
    );
  box-shadow: 0 24rpx 70rpx var(--immersive-veil-color);
  color: var(--on-immersive-color);
  box-sizing: border-box;
}

.guest-profile__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.guest-eyebrow {
  color: var(--immersive-accent-color);
  font-size: 19rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}

.guest-mark {
  width: 58rpx;
  height: 58rpx;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: var(--radius-pill);
  background: var(--immersive-surface-color);
  color: var(--on-immersive-color);
  font-family: STSong, SimSun, serif;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 58rpx;
  text-align: center;
}

.guest-title {
  max-width: 480rpx;
  margin-top: 26rpx;
  font-family: STSong, SimSun, serif;
  font-size: 44rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
  line-height: 1.2;
}

.guest-copy {
  margin-top: 16rpx;
  color: var(--on-immersive-muted-color);
  font-size: 24rpx;
  line-height: 1.65;
}

.guest-benefits {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1);
  margin-top: 24rpx;
  padding: 16rpx 18rpx;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: var(--radius-md);
  background: var(--immersive-surface-color);
  color: var(--on-immersive-muted-color);
  font-size: 20rpx;
  letter-spacing: 1rpx;
}

.guest-action {
  margin-top: 26rpx;
}

.guest-primary {
  border-color: transparent;
  background: var(--on-immersive-color);
  color: var(--immersive-bg-strong-color);
}

.guest-shortcuts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.guest-shortcut {
  --td-cell-bg-color: var(--immersive-surface-color);
  --td-cell-border-color: transparent;
  --td-cell-description-color: var(--on-immersive-muted-color);
  --td-cell-hover-color: var(--immersive-veil-color);
  --td-cell-right-icon-color: var(--immersive-accent-color);
  --td-cell-title-color: var(--on-immersive-color);

  min-width: 0;
  border: 1rpx solid var(--immersive-border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.guest-theme {
  max-width: 620rpx;
  margin-right: auto;
  margin-left: auto;
  text-align: left;
}

.guest-theme__action {
  --td-cell-bg-color: transparent;
  --td-cell-hover-color: var(--surface-subtle-color);
  --td-cell-note-color: var(--text-secondary-color);
  --td-cell-right-icon-color: var(--muted-color);
  --td-cell-title-color: var(--text-color);
}

.hero {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-subtle-color);
  color: var(--dress-avatar-frame-color, inherit);
  border:
    var(--dress-avatar-frame-border-width, 0px)
    solid var(--dress-avatar-frame-border-color, transparent);
  box-sizing: border-box;
  flex-shrink: 0;
}

.avatar--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dress-avatar-frame-color, var(--accent-color));
  font-family: STSong, SimSun, serif;
  font-size: 62rpx;
  font-weight: 900;
}

.hero-copy {
  min-width: 0;
  flex: 1;
}

.name {
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.handle,
.bio,
.meta {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-sm);
}

.bio {
  line-height: 1.5;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.dialect-badge {
  display: inline-flex;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
}

.dialect-badge {
  background: var(--accent-subtle-color);
  color: var(--accent-color);
}

.social-stats {
  display: flex;
  margin-top: var(--space-4);
}

.social-stat {
  flex: 1;
}

.number {
  font-size: var(--font-size-xl);
  font-weight: 800;
}

.label {
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.profile-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.action-slot {
  flex: 1;
  min-width: 0;
}

.dialect-follow {
  margin-top: var(--space-4);
}

.section-kicker {
  margin-bottom: var(--space-2);
  color: var(--muted-color);
  font-size: var(--font-size-xs);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.works,
.archive-menu,
.menu,
.account-section {
  margin-top: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-color);
  overflow: hidden;
}

.account-section {
  padding: var(--space-3);
}

.account-section__copy {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.65;
}

.account-section__action {
  margin-top: var(--space-3);
}

.menu-item {
  min-height: 92rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--border-color);
}

.menu-item:last-child {
  border-bottom: 0;
}

.menu-item.busy {
  opacity: 0.72;
}

.menu-value {
  color: var(--muted-color);
  font-size: var(--font-size-sm);
}

.danger {
  color: var(--danger-color);
}

.menu-kicker {
  margin: var(--space-3) var(--space-3) 0;
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
.hero-copy {
  min-width: 0;
}
.name,
.bio {
  overflow-wrap: anywhere;
}
.contribution-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  padding: var(--space-3);
}
.contribution-stat { display: grid; gap: var(--space-1); text-align: center; }
.profile-actions .action-slot { flex: 1; }
.works > .base-button { margin-top: var(--space-2); }
</style>
