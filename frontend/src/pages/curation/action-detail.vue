<template>
  <PageShell title="整理决定与依据">
    <view class="action-layout">
      <BaseLoading
        v-if="loading"
        text="正在读取整理记录…"
      />
      <EmptyState
        v-else-if="error"
        :title="error"
        action-text="重试"
        @action="load"
      />
      <template v-else-if="action">
        <view class="action-card">
          <view class="eyebrow">
            {{ actionLabel(action.action_type) }}
          </view>
          <view class="action-title">
            {{ action.target_label || '整理记录' }}
          </view>
          <view class="muted">
            {{ action.created_at || '时间未提供' }} · 整理员 #{{ action.actor?.id || '未提供' }}
          </view>
          <view class="action-label">
            决定理由
          </view>
          <view class="reason">
            {{ action.reason || '理由未提供' }}
          </view>
          <template v-if="action.action_type === 'narrow_scope'">
            <view class="scope-change">
              <view>
                <text class="muted">
                  修改前
                </text>
                <view>{{ scopeLabel(action.before_snapshot) }}</view>
              </view>
              <text aria-label="变为">
                →
              </text>
              <view>
                <text class="muted">
                  修改后
                </text>
                <view>{{ scopeLabel(action.after_snapshot) }}</view>
              </view>
            </view>
          </template>
          <template v-else>
            <view class="muted">
              此类操作提供有限只读摘要。
            </view>
            <view>修改前状态：{{ action.before_snapshot?.status || '未提供' }}</view>
            <view>修改后状态：{{ action.after_snapshot?.status || '未提供' }}</view>
          </template>
          <BaseButton
            variant="ghost"
            text="复制此记录的站内链接"
            @click="copyLink"
          />
        </view>

        <view class="action-card">
          <view class="action-title">
            操作时授权
          </view>
          <view
            v-for="line in authorityLines(action.authority_snapshot)"
            :key="line"
          >
            {{ line }}
          </view>
          <view class="muted">
            以上来自操作时快照；当前授权不能代替历史授权。
          </view>
          <view
            v-if="action.grant === null"
            class="muted"
          >
            当前授权管理信息未开放。
          </view>
        </view>

        <view class="action-card">
          <view class="action-title">
            本次引用的来源
          </view>
          <view class="muted">
            提交来源不等于事实已证实。仅显示服务器为当前账号提供的可见依据。
          </view>
          <BaseLoading
            v-if="sourcesLoading"
            text="正在读取引用来源…"
          />
          <view
            v-for="item in sources"
            :key="item.id"
          >
            <EvidenceSource
              v-if="item.source"
              :source="item.source"
            />
            <EmptyState
              v-else
              :title="item.error"
              action-text="重新读取获准来源"
              @action="loadSources"
            />
          </view>
          <EmptyState
            v-if="!sourcesLoading && !sources.length"
            title="依据未提供或无权查看"
          />
        </view>
      </template>
      <BaseButton
        v-if="entryId"
        variant="ghost"
        text="返回词条来源与历史"
        @click="openHistory"
      />
    </view>
  </PageShell>
</template>

<script>
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageShell from '@/components/PageShell.vue';
import EvidenceSource from '@/components/EvidenceSource.vue';
import { dialectBreadcrumb } from '@/utils/dialectTree';
import { openPage, pageUrl, ROUTES } from '@/services/navigation';
import {
  getAction, getEvidence, actionLabel, authorityLines, reviewError, reviewSession,
} from '@/services/curationReview';

export default {
  components: {
    BaseButton, BaseLoading, EmptyState, PageShell, EvidenceSource,
  },
  mixins: [reviewSession],
  data() {
    return {
      id: null, entryId: null, action: null, loading: false, error: '', sources: [], sourcesLoading: false,
    };
  },
  onLoad(options = {}) {
    this.id = Number(options.id) || null;
    this.entryId = Number(options.entry_id) || null;
  },
  onShow() { this.clearReview(); this.load(); },
  methods: {
    dialectBreadcrumb,
    actionLabel,
    authorityLines,
    sessionChanged() { this.entryId = null; this.error = '账号已变更，请重新加载'; },
    scopeLabel(snapshot) {
      return dialectBreadcrumb(snapshot?.usage_dialect || snapshot?.dialect);
    },
    resetReview() {
      this.action = null; this.sources = []; this.loading = false;
      this.sourcesLoading = false; this.error = '';
    },
    async load() {
      if (!this.id) { this.error = '缺少有效的整理记录链接'; return; }
      const valid = this.reviewGuard();
      this.action = null; this.sources = []; this.loading = true; this.error = '';
      try {
        const result = await getAction(this.id);
        if (!valid()) return;
        this.action = result;
        if (result.target_type === 'entry') this.entryId = result.target_id;
        await this.loadSources();
      } catch (error) {
        if (valid()) this.error = reviewError(error);
      } finally {
        if (valid()) this.loading = false;
      }
    },
    async loadSources() {
      if (this.sourcesLoading || !this.action) return;
      const valid = this.reviewGuard();
      const ids = [...new Set(this.action.evidence_ids || [])];
      this.sourcesLoading = true;
      const results = await Promise.allSettled(ids.map((id) => getEvidence(id)));
      if (!valid()) return;
      this.sources = results.map((result, index) => ({
        id: ids[index],
        source: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? reviewError(result.reason) : '',
      }));
      this.sourcesLoading = false;
    },
    openHistory() { openPage(ROUTES.entryReview, { entry_id: this.entryId }); },
    copyLink() {
      const route = pageUrl(ROUTES.curationActionDetail, { id: this.id });
      let link = route;
      // #ifdef H5
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      link = `${window.location.origin}${base}${route}`;
      // #endif
      uni.setClipboardData({ data: link });
    },
  },
};
</script>

<style scoped>
.action-layout {
  display: grid;
  gap: var(--space-3);
  max-width: 960px;
  margin: 0 auto;

}
.action-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface-color);
  overflow-wrap: anywhere;

}
.action-title {
  font-size: var(--font-size-xl);
  color: var(--text-color);
  font-weight: 800;

}
.eyebrow, .action-label {
  font-weight: 700;
  color: var(--accent-color);

}
.muted {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.7;

}
.reason {
  white-space: pre-wrap;
  line-height: 1.8;

}
.scope-change {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3);
  background: var(--accent-subtle-color);
  border-radius: var(--radius-md);
  line-height: 1.7;

}
</style>
