<template>
  <PageShell title="地方工具">
    <view class="tools-wrap">
      <view
        v-if="tools.length && tool"
        class="tools-selector"
      >
        <view>
          <text class="tools-caption">
            当前方言
          </text>
          <text class="tools-region">
            {{ currentDialect?.name || dialect || '请先选择' }}
          </text>
        </view>
        <BaseButton
          size="small"
          variant="ghost"
          text="选择方言"
          @click="openSelector"
        />
      </view>
      <EmptyState
        v-if="catalogError && !selectorVisible"
        title="无法加载方言目录"
        action-text="重试"
        @action="openSelector"
      />

      <view
        v-if="tools.length && tool"
        class="tools-nav"
      >
        <BaseButton
          v-for="item in tools"
          :key="item.id"
          size="small"
          :variant="tool === item.id ? 'primary' : 'ghost'"
          :text="item.label"
          @click="tool = item.id"
        />
      </view>

      <BaseLoading
        v-if="loading"
        text="正在加载地方资料…"
      />
      <EmptyState
        v-else-if="!toolEnabled"
        title="当前站点暂未启用这项工具"
        :description="tools.length ? '还可以使用上方其他工具。' : '可以返回继续查词或听乡音。'"
      />
      <EmptyState
        v-else-if="error"
        title="无法加载地方资料"
        description="请检查网络后重试。"
        action-text="重试"
        @action="refresh"
      />
      <EmptyState
        v-else-if="!material"
        :title="missingTitle"
        :description="missingDescription"
        :action-text="tool === 'kinship' && dialect ? '补充当地称谓' : ''"
        @action="suggestKinship"
      />
      <view
        v-else
        class="tools-panel"
      >
        <text class="tools-title">
          {{ material.title }}
        </text>
        <MaterialSource :material="material" />
        <PinyinGuide
          v-if="tool === 'pinyin'"
          :sections="material.content.sections"
        />
        <template v-else-if="tool === 'quiz'">
          <LocalQuiz
            :key="`${dialect}:${material.version}`"
            :questions="material.content.questions"
          />
          <BaseButton
            v-if="canShare"
            class="tools-share"
            size="small"
            variant="ghost"
            :open-type="wechat ? 'share' : ''"
            text="分享这组题"
            @click="shareQuiz"
          />
        </template>
        <KinshipCalculator
          v-else
          :key="`${dialect}:${material.version}`"
          :content="material.content"
          :version="material.version"
        />
      </view>
    </view>

    <DialectSelector
      v-model:visible="selectorVisible"
      :value="currentDialect?.id || ''"
      :dialects="dialects"
      :owner-scope="userId || 'guest'"
      title="选择工具使用的方言"
      @change="selectDialect"
    />
  </PageShell>
</template>

<script>
import { observeSharedOpen } from '@/services/shareObservation';
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import EmptyState from '@/components/EmptyState.vue';
import KinshipCalculator from '@/components/localtools/KinshipCalculator.vue';
import LocalQuiz from '@/components/localtools/LocalQuiz.vue';
import MaterialSource from '@/components/localtools/MaterialSource.vue';
import PinyinGuide from '@/components/localtools/PinyinGuide.vue';
import PageShell from '@/components/PageShell.vue';
import { requireAuth } from '@/services/authGuard';
import { contentFeedbackParams } from '@/services/contentFeedback';
import { listAllDialects } from '@/services/guantou';
import {
  loadLocalMaterials, quizShareMessage, readLocalParam, resolveLocalDialect,
} from '@/services/localTools';
import { hasShareTarget, sharePage, showWechatShareMenu } from '@/services/pageShare';
import { openPage, ROUTES } from '@/services/navigation';
import { isWechatMiniProgram } from '@/services/platform';
import { enabledLocalTools, loadProductProfile, LOCAL_TOOL_OPTIONS } from '@/services/productProfile';
import { resolveSessionUserId } from '@/services/session';
import { getUserInfo } from '@/services/user';

export default {
  components: {
    BaseButton,
    BaseLoading,
    DialectSelector,
    EmptyState,
    KinshipCalculator,
    LocalQuiz,
    MaterialSource,
    PageShell,
    PinyinGuide,
  },
  data() {
    return {
      tool: '',
      routeDialect: '',
      selectedDialect: '',
      profileDialect: '',
      quizVersion: '',
      loading: true,
      error: false,
      generation: 0,
      currentDialect: null,
      packs: {},
      quizUnavailable: false,
      selectorVisible: false,
      catalogError: false,
      dialects: [],
      userId: '',
      wechat: isWechatMiniProgram(),
    };
  },
  computed: {
    tools: enabledLocalTools,
    toolEnabled() {
      return this.tools.some(({ id }) => id === this.tool);
    },
    dialect() {
      return resolveLocalDialect({
        chosen: this.selectedDialect,
        shared: this.quizVersion ? this.routeDialect : '',
        profile: this.profileDialect,
        route: this.routeDialect,
      });
    },
    material() {
      return this.toolEnabled ? this.packs[this.tool] : null;
    },
    shareMessage() {
      return this.tool === 'quiz'
        ? quizShareMessage(this.currentDialect?.qualified_code, this.material) : null;
    },
    canShare() {
      return Boolean(this.shareMessage && hasShareTarget());
    },
    missingTitle() {
      if (!this.dialect) return '先选择一种方言';
      if (this.tool === 'quiz' && this.quizUnavailable) return '分享的这组题暂不可用';
      const label = this.tools.find((item) => item.id === this.tool)?.label;
      return `当前方言暂无发布的${label}`;
    },
    missingDescription() {
      return this.dialect ? '可以换一种方言看看。' : '用上方的「选择方言」查看当地资料。';
    },
  },
  watch: {
    shareMessage() {
      this.syncShareMenu();
    },
  },
  async onLoad(query = {}) {
    const { generation } = this;
    this.routeDialect = readLocalParam(query.dialect);
    this.quizVersion = readLocalParam(query.quiz);
    await loadProductProfile();
    if (generation !== this.generation) return;
    this.tool = LOCAL_TOOL_OPTIONS.some((item) => item.id === query.tool)
      ? query.tool : (this.tools[0]?.id || '');
    this.userId = resolveSessionUserId();
    if (this.userId && !this.quizVersion && query.tool !== 'pinyin') {
      const cachedUser = getApp().globalData.userInfo;
      try {
        const user = cachedUser?.id === this.userId
          ? cachedUser : (await getUserInfo(this.userId, true)).user;
        if (generation !== this.generation) return;
        this.profileDialect = user?.primary_dialect?.qualified_code || '';
      } catch {
        // The requested station dialect still works if the profile is unavailable.
      }
    }
    if (generation === this.generation) await this.refresh();
  },
  onShow() {
    this.syncShareMenu();
  },
  onUnload() {
    this.generation += 1;
  },
  onShareAppMessage() {
    return this.shareMessage;
  },
  onShareTimeline() {
    const message = this.shareMessage;
    return message ? { title: message.title, query: message.path.split('?')[1] } : null;
  },
  methods: {
    suggestKinship() {
      const params = contentFeedbackParams('kinship', this.dialect);
      if (params && requireAuth('content_feedback', params)) openPage(ROUTES.mailSend, params);
    },
    syncShareMenu() {
      if (!this.wechat) return;
      if (this.shareMessage) showWechatShareMenu();
      else uni.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'], fail() {} });
    },
    async refresh() {
      this.generation += 1;
      const request = this.generation;
      this.currentDialect = null;
      this.packs = {};
      this.quizUnavailable = false;
      this.error = false;
      this.loading = Boolean(this.dialect && this.tools.length);
      if (!this.loading) return;
      try {
        const response = await loadLocalMaterials(this.dialect, this.quizVersion);
        if (request !== this.generation) return;
        this.currentDialect = response.dialect;
        this.packs = response.packs || {};
        this.quizUnavailable = response.quiz_unavailable;
        if (this.quizVersion && this.tool === 'quiz' && this.toolEnabled && this.packs.quiz) {
          const shared = quizShareMessage(this.currentDialect.qualified_code, this.packs.quiz);
          observeSharedOpen(shared?.path);
        }
      } catch {
        if (request === this.generation) this.error = true;
      } finally {
        if (request === this.generation) this.loading = false;
      }
    },
    async openSelector() {
      this.catalogError = false;
      try {
        if (!this.dialects.length) this.dialects = await listAllDialects();
        this.selectorVisible = true;
      } catch {
        this.catalogError = true;
      }
    },
    selectDialect({ dialect }) {
      this.selectedDialect = dialect.qualified_code;
      this.quizVersion = '';
      this.refresh();
    },
    shareQuiz() {
      if (!this.wechat) sharePage(this.shareMessage, '已复制题集链接');
    },
  },
};
</script>

<style scoped>
.tools-wrap {
  display: grid;
  gap: var(--space-3);
  max-width: 700px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-3) var(--space-5);
}
.tools-selector,
.tools-panel {
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}
.tools-selector {
  display: flex;
  gap: var(--space-2);
  justify-content: space-between;
  align-items: center;
}
.tools-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.tools-caption,
.tools-region,
.tools-title {
  display: block;
}
.tools-caption {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
}
.tools-region,
.tools-title {
  font-weight: 700;
  overflow-wrap: anywhere;
}
.tools-title {
  font-size: var(--font-size-xl);
}
.tools-share {
  margin-top: 18px;
}
</style>
