<template>
  <PageShell
    title="页面走丢了"
    :show-back="false"
  >
    <view class="not-found-card">
      <view class="status-row">
        <view
          class="status-code"
          aria-hidden="true"
        >
          404
        </view>
        <view class="status-copy">
          <view class="eyebrow">
            路径暂时中断
          </view>
          <view class="title">
            {{ legacyTitle || '这条路没有找到页面' }}
          </view>
        </view>
      </view>

      <view class="description">
        可能是链接已过期，或地址里多了字符。当前只是这个链接打不开，你仍可以继续使用{{ productName }}。
      </view>

      <view
        v-if="requestedPath"
        class="attempted-path"
        role="note"
        aria-label="刚才访问的路径"
      >
        <view class="path-label">
          刚才访问
        </view>
        <text class="path-value">
          {{ requestedPath }}
        </text>
      </view>

      <view class="recovery-panel">
        <view
          class="recovery-mark"
          aria-hidden="true"
        />
        <view class="recovery-copy">
          <view class="recovery-title">
            从熟悉的地方重新开始
          </view>
          <view class="recovery-description">
            回到首页后，可以继续听乡音、查词条或录下会说的方言。
          </view>
        </view>
      </view>

      <BaseButton
        v-if="legacyTitle"
        block
        variant="ghost"
        text="查找词条"
        @click="search"
      />
      <BaseButton
        block
        size="large"
        text="回到首页"
        aria-label="返回首页"
        @click="goHome"
      />
    </view>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import PageShell from '@/components/PageShell.vue';
import { toIndexPage } from '@/routers';
import { currentProductName, loadProductProfile } from '@/services/productProfile';
import { goSearch, pageUrl, ROUTES } from '@/services/navigation';
import rawRequest from '@/utils/rawRequest';

const NOT_FOUND_ROUTE = '/pages/error/not-found';

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function pathnameOnly(value) {
  const raw = decodePath(String(value || '').trim());
  if (!raw) return '';
  const withoutQuery = raw.split(/[?#]/)[0];
  return withoutQuery.replace(/^https?:\/\/[^/]+/i, '') || '/';
}

export default {
  name: 'NotFoundPage',
  components: { BaseButton, PageShell },
  data() {
    return { requestedPath: '', legacyTitle: '', active: true };
  },
  computed: { productName: currentProductName },
  onLoad(query = {}) {
    this.requestedPath = this.resolveRequestedPath(query);
    this.resolveOldRoute(query);
  },
  onUnload() {
    this.active = false;
  },
  methods: {
    search() { goSearch(); },
    async resolveOldRoute(query) {
      const path = this.requestedPath;
      const word = /^\/words\/([1-9][0-9]{0,18})\/?$/.exec(path)?.[1]
        || (path === '/pages/words/details' && query.legacyWord);
      const tools = { '/pinyin': 'pinyin', '/PuxianExam': 'quiz' };
      const tool = Object.prototype.hasOwnProperty.call(tools, path) && tools[path];
      const search = path === '/search' && query.legacySearch;
      if (typeof window === 'undefined' || (!word && !tool && !search)) return;
      const profile = await loadProductProfile();
      if (!this.active || profile.key !== 'pxm') return;
      // Use an ordinary same-origin H5 URL so refreshing or copying it preserves one encoding.
      const mount = import.meta.env.BASE_URL.replace(/\/$/, '');
      const replace = (route, params) => window.location.replace(mount + pageUrl(route, params));
      if (tool) {
        replace(ROUTES.localTools, { tool, dialect: '闽.莆仙' });
      } else if (search) {
        replace(ROUTES.search, { keywords: search });
      } else if (/^[1-9][0-9]{0,18}$/.test(word)) {
        try {
          const entry = await rawRequest.get(`/entries/from-hinghwa/${word}/`, {}, {
            auth: false, loading: false, silent: true,
          });
          if (this.active) replace(ROUTES.entryDetail, { id: entry.id });
        } catch {
          if (this.active) this.legacyTitle = '暂时找不到这条旧词条对应的公开资料';
        }
      }
    },
    resolveRequestedPath(query = {}) {
      const explicitPath = query.path || query.from;
      const navigationState = typeof window !== 'undefined'
        ? window.history?.state
        : null;
      const historyPath = navigationState?.replaced === false
        ? navigationState.back
        : '';
      const path = pathnameOnly(explicitPath || historyPath);
      return path === NOT_FOUND_ROUTE ? '' : path;
    },
    goHome() {
      toIndexPage();
    },
  },
};
</script>

<style scoped>
.not-found-card {
  max-width: 640rpx;
  margin: var(--space-5) auto 0;
  padding: var(--space-5);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
}

.status-row,
.recovery-panel {
  display: flex;
  align-items: center;
}

.status-row {
  gap: var(--space-3);
}

.status-code {
  display: flex;
  width: 112rpx;
  height: 112rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--accent-color);
  border-radius: 50%;
  background: var(--accent-subtle-color);
  color: var(--accent-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-lg);
  font-weight: 900;
  letter-spacing: 0.04em;
}

.status-copy,
.recovery-copy {
  min-width: 0;
  flex: 1;
}

.eyebrow,
.path-label {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
}

.title {
  margin-top: var(--space-1);
  color: var(--text-color);
  font-family: STSong, SimSun, serif;
  font-size: var(--font-size-xl);
  font-weight: 900;
  line-height: 1.35;
}

.description,
.recovery-description {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.7;
}

.description {
  margin-top: var(--space-4);
}

.attempted-path {
  margin-top: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-subtle-color);
}

.path-value {
  display: block;
  margin-top: var(--space-1);
  color: var(--muted-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--font-size-xs);
  line-height: 1.6;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.recovery-panel {
  gap: var(--space-2);
  margin: var(--space-4) 0;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-color);
}

.recovery-mark {
  width: 12rpx;
  height: 12rpx;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--accent-color);
}

.recovery-title {
  color: var(--text-color);
  font-size: var(--font-size-sm);
  font-weight: 800;
}

.recovery-description {
  margin-top: var(--space-1);
}

@media (max-width: 360px) {
  .not-found-card {
    padding: var(--space-4);
  }

  .status-code {
    width: 96rpx;
    height: 96rpx;
  }
}
</style>
