<template>
  <PageShell title="地方工具">
    <view class="tools-wrap">
      <view class="tools-selector">
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

      <view class="tools-nav">
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
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import DialectSelector from '@/components/DialectSelector.vue';
import EmptyState from '@/components/EmptyState.vue';
import KinshipCalculator from '@/components/localtools/KinshipCalculator.vue';
import LocalQuiz from '@/components/localtools/LocalQuiz.vue';
import MaterialSource from '@/components/localtools/MaterialSource.vue';
import PinyinGuide from '@/components/localtools/PinyinGuide.vue';
import PageShell from '@/components/PageShell.vue';
import { listAllDialects } from '@/services/guantou';
import {
  loadLocalMaterials, quizShareMessage, readLocalParam, resolveLocalDialect,
} from '@/services/localTools';
import { hasShareTarget, sharePage, showWechatShareMenu } from '@/services/pageShare';
import { isWechatMiniProgram } from '@/services/platform';
import { resolveSessionUserId } from '@/services/session';
import { getUserInfo } from '@/services/user';

const TOOLS = Object.freeze([
  { id: 'pinyin', label: '拼音方案' },
  { id: 'quiz', label: '聪明花开' },
  { id: 'kinship', label: '亲戚计算器' },
]);

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
      tools: TOOLS,
      tool: 'pinyin',
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
    dialect() {
      return resolveLocalDialect({
        chosen: this.selectedDialect,
        shared: this.quizVersion ? this.routeDialect : '',
        profile: this.profileDialect,
        route: this.routeDialect,
      });
    },
    material() {
      return this.packs[this.tool];
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
    this.routeDialect = readLocalParam(query.dialect);
    this.quizVersion = readLocalParam(query.quiz);
    this.tool = TOOLS.some((item) => item.id === query.tool) ? query.tool : 'pinyin';
    this.userId = resolveSessionUserId();
    if (this.userId && !this.quizVersion && query.tool !== 'pinyin') {
      const cachedUser = getApp().globalData.userInfo;
      try {
        const user = cachedUser?.id === this.userId
          ? cachedUser : (await getUserInfo(this.userId, true)).user;
        this.profileDialect = user?.primary_dialect?.qualified_code || '';
      } catch {
        // The requested station dialect still works if the profile is unavailable.
      }
    }
    await this.refresh();
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
      this.loading = Boolean(this.dialect);
      if (!this.dialect) return;
      try {
        const response = await loadLocalMaterials(this.dialect, this.quizVersion);
        if (request !== this.generation) return;
        this.currentDialect = response.dialect;
        this.packs = response.packs || {};
        this.quizUnavailable = response.quiz_unavailable;
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
