<template>
  <PageShell
    :title="mine ? '我的集盒' : '主题集盒'"
    :refreshable="!mine"
    :refreshing="refreshing"
    @refresh="refresh"
  >
    <view class="box-stack">
      <view class="box-cover">
        <text class="box-kicker">
          乡声集盒 · 一盒一段风土
        </text><text class="box-title">
          把散落的乡音，收在一起
        </text>
        <text class="box-note">
          从一个词出发，听见不同地方的说法。
        </text>
        <view class="box-actions">
          <BaseButton
            :variant="mine ? 'ghost' : 'primary'"
            text="逛集盒"
            @click="switchMode(false)"
          /><BaseButton
            :variant="mine ? 'primary' : 'ghost'"
            text="我的集盒"
            @click="switchMode(true)"
          />
        </view>
      </view>
      <view
        v-if="!mine"
        class="box-panel box-search"
      >
        <BaseField
          :model-value="searchInput"
          name="collection-search"
          label="找主题集盒"
          placeholder="例如：拜年、称呼"
          confirm-type="search"
          clearable
          @update:model-value="updateSearchInput"
          @confirm="searchCollections"
        />
        <BaseButton
          text="查找集盒"
          @click="searchCollections"
        />
      </view>
      <BaseForm
        v-if="mine"
        ref="form"
        class="box-panel"
        :data="form"
        :rules="rules"
      >
        <BaseField
          v-model="form.title"
          name="title"
          label="新集盒名称"
          placeholder="例如：灶边的乡音"
        />
        <BaseButton
          text="创建私有集盒"
          :loading="busy"
          @click="create"
        />
      </BaseForm>
      <text
        v-if="refreshError"
        class="box-note"
        role="status"
        aria-live="polite"
      >
        {{ refreshError }}
      </text>
      <BaseLoading
        v-if="loading && !boxes.length"
        text="正在打开集盒…"
      />
      <EmptyState
        v-else-if="error"
        :title="error"
        action-text="重试"
        @action="load"
      />
      <template v-else>
        <EmptyState
          v-if="!boxes.length"
          :title="emptyTitle"
          :action-text="!mine && searchTerm ? '查看全部集盒' : ''"
          @action="clearSearch"
        />
        <view
          v-for="box in boxes"
          :key="box.id"
          class="box-panel"
        >
          <text class="box-kicker">
            {{ box.is_public ? '公开集盒' : '私人珍藏' }}
          </text>
          <text class="box-heading">
            {{ box.title }}
          </text><text class="box-note">
            {{ box.description || '等待你收进第一段乡音' }}
          </text>
          <BaseButton
            variant="ghost"
            text="打开盒子"
            @click="goCollectionDetail(box.id)"
          />
        </view>
        <text
          v-if="loadMoreError"
          class="box-note"
          role="status"
          aria-live="polite"
        >
          {{ loadMoreError }}
        </text>
        <BaseButton
          v-if="next"
          variant="ghost"
          :text="loadMoreError ? '重试加载更多' : '更多集盒'"
          :loading="loading"
          @click="load('append')"
        />
      </template>
    </view>
  </PageShell>
</template>
<script>
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import { listCollections, createCollection } from '@/services/collections';
import { pageResults } from '@/services/entryRecording';
import { goCollectionDetail } from '@/services/navigation';
import { requireAuth } from '@/services/authGuard';
import { notify } from '@/services/feedback';

export default {
  components: {
    PageShell,
    BaseButton,
    BaseForm,
    BaseField,
    BaseLoading,
    EmptyState,
  },
  data: () => ({
    mine: false,
    boxes: [],
    next: null,
    page: 1,
    loading: false,
    refreshing: false,
    busy: false,
    error: '',
    loadMoreError: '',
    refreshError: '',
    searchInput: '',
    searchTerm: '',
    loadRequest: 0,
    form: {
      title: '',
    },
    rules: {
      title: [{
        required: true,
        message: '请填写名称',
      }],
    },
  }),
  computed: {
    emptyTitle() {
      if (this.mine) return '还没有自己的集盒';
      return this.searchTerm ? '没有找到相关集盒' : '还没有公开集盒';
    },
  },
  onLoad(options = {}) {
    this.mine = options.mine === 'true';
  },
  onShow() {
    if (!this.mine || requireAuth('manage_collection')) this.load();
  },
  onUnload() { this.loadRequest += 1; },
  methods: {
    goCollectionDetail,
    switchMode(mine) {
      if (mine && !requireAuth('manage_collection')) return;
      this.mine = mine;
      this.load();
    },
    updateSearchInput(value) {
      this.searchInput = value;
      if (!value && this.searchTerm) this.searchCollections();
    },
    searchCollections() {
      this.searchTerm = String(this.searchInput || '').trim();
      this.load();
    },
    clearSearch() {
      this.searchInput = '';
      this.searchCollections();
    },
    async refresh() {
      if (this.mine || this.loading) return;
      await this.load('refresh');
    },
    async load(mode = 'replace') {
      const append = mode === 'append';
      if (append && (this.loading || !this.next)) return;
      this.loadRequest += 1;
      const requestId = this.loadRequest;
      this.loading = true;
      this.refreshing = mode === 'refresh';
      this.error = '';
      this.loadMoreError = '';
      this.refreshError = '';
      const page = append ? this.page + 1 : 1;
      if (mode === 'replace') {
        this.boxes = [];
        this.next = null;
      }
      try {
        const response = await listCollections({
          ...(this.mine ? { mine: true } : {}),
          ...(!this.mine && this.searchTerm ? { search: this.searchTerm } : {}),
          page,
        });
        if (requestId !== this.loadRequest) return;
        this.boxes = page === 1 ? pageResults(response) : [...this.boxes, ...pageResults(response)];
        this.page = page;
        this.next = response?.next || null;
      } catch (error) {
        if (requestId !== this.loadRequest) return;
        if (append) this.loadMoreError = '更多集盒暂时没加载出来，请重试。';
        else if (mode === 'refresh' && this.boxes.length) {
          this.refreshError = '刷新失败，仍显示上次加载的集盒。';
        } else this.error = '集盒暂时无法读取';
      } finally {
        if (requestId === this.loadRequest) {
          this.loading = false;
          this.refreshing = false;
        }
      }
    },
    async create() {
      if (this.busy || (await this.$refs.form.validate()) !== true) return;
      this.busy = true;
      try {
        const box = await createCollection(this.form);
        this.form.title = '';
        goCollectionDetail(box.id);
      } catch (error) {
        notify({
          title: error.message || '创建失败',
        });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
<style src="@/styles/collections.scss" lang="scss"></style>
<style scoped lang="scss">
.box-search {
  display: grid;
  align-items: end;
  gap: var(--space-2);
}

@media (min-width: 640px) {
  .box-search {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}
</style>
