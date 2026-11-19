<template>
  <PageShell
    title="逐字查音"
    :back-fallback="searchRoute"
  >
    <view class="lookup">
      <BaseForm
        ref="form"
        :data="form"
        :rules="rules"
      >
        <BaseField
          v-model="form.text"
          name="text"
          label="要查的汉字"
          help="最多 32 个字符。逐字查看各地资料，不能据此推断整句自然读法。"
          placeholder="输入一个字或一串汉字"
          clearable
          @confirm="lookup"
        />
        <BaseButton
          text="查字音"
          variant="ghost"
          block
          :loading="loading"
          @click="lookup"
        />
      </BaseForm>
      <BaseLoading
        v-if="loading"
        text="正在查找字音…"
      />
      <EmptyState
        v-else-if="error"
        title="字音资料读取失败"
        description="输入已保留，可以修改或重试。"
        action-text="重试"
        @action="lookup"
      />
      <view
        v-for="(row, index) in rows"
        :key="index"
        class="character"
      >
        <text class="character__title">
          {{ row.character.trim() || '空格' }}
        </text>
        <text
          v-if="!row.entries.length"
          class="note"
        >
          {{ missingLabel(row.kind) }}
        </text>
        <view
          v-for="entry in row.entries"
          :key="entry.id"
          class="entry"
        >
          <text>{{ entry.writings.join('、') }} · {{ entry.summary || '释义待补' }}</text>
          <text
            v-if="entry.status === 'disputed'"
            class="note"
          >
            词条有分歧
          </text>
          <text
            v-if="!entry.readings.length"
            class="note"
          >
            尚无公开读音标注
          </text>
          <view
            v-for="reading in entry.readings"
            :key="reading.id"
            class="reading"
          >
            <text>{{ reading.district }}{{ reading.status === 'disputed' ? ' · 读音有分歧' : '' }}</text>
            <PronunciationForms :variant="reading" />
            <text
              v-for="source in reading.sources"
              :key="source.id"
              class="note"
            >
              {{ source.relation }} · {{ source.citation }}
            </text>
            <text
              v-if="!reading.sources.length"
              class="note"
            >
              此读音的直接出处待补
            </text>
          </view>
          <view class="links">
            <BaseButton
              size="small"
              variant="ghost"
              text="查看词条"
              @click="goEntryDetail(entry.id)"
            />
            <BaseButton
              size="small"
              variant="ghost"
              text="查看词条来源"
              @click="openSources(entry.id)"
            />
          </view>
          <BaseButton
            v-for="recording in entry.recordings"
            :key="recording.id"
            size="small"
            variant="ghost"
            :text="`听词条录音 · ${recording.district}`"
            @click="goRecordingDetail(recording.id)"
          />
          <text
            v-if="!entry.recordings.length"
            class="note"
          >
            尚无已确认授权的词条录音
          </text>
        </view>
      </view>
    </view>
  </PageShell>
</template>

<script>
import PageShell from '@/components/PageShell.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseField from '@/components/BaseField.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import PronunciationForms from '@/components/PronunciationForms.vue';
import { lookupCharacterReadings } from '@/services/entryRecording';
import {
  goEntryDetail, goRecordingDetail, openPage, ROUTES,
} from '@/services/navigation';

export default {
  components: {
    PageShell, BaseForm, BaseField, BaseButton, BaseLoading, EmptyState, PronunciationForms,
  },
  data() {
    return {
      searchRoute: ROUTES.search,
      form: { text: '' },
      rules: {
        text: [{
          validator: (value) => Boolean(value?.trim()) && Array.from(value).length <= 32,
          message: '请输入 1 至 32 个字符',
        }],
      },
      rows: [],
      loading: false,
      error: false,
      version: 0,
    };
  },
  watch: {
    'form.text': function clearPreviousLookup() {
      this.version += 1;
      this.rows = [];
      this.loading = false;
      this.error = false;
    },
  },
  onLoad(options = {}) {
    let text = options.text || '';
    // #ifdef MP-WEIXIN
    try { text = decodeURIComponent(text); } catch { /* Preserve literal percent signs. */ }
    // #endif
    this.form.text = text;
  },
  methods: {
    goEntryDetail,
    goRecordingDetail,
    openSources(id) { openPage(ROUTES.entryReview, { entry_id: id }); },
    missingLabel(kind) {
      if (kind === 'separator') return '标点或空白，无单字读音';
      if (kind === 'other') return '非汉字，未查读音';
      return '尚无这个字的公开词条';
    },
    async lookup() {
      if ((await this.$refs.form.validate()) !== true) return;
      if (this.loading) return;
      const version = this.version + 1;
      this.version = version;
      this.loading = true;
      this.error = false;
      this.rows = [];
      try {
        const rows = await lookupCharacterReadings(this.form.text);
        if (version === this.version) this.rows = rows;
      } catch {
        if (version === this.version) this.error = true;
      } finally {
        if (version === this.version) this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.lookup, .character, .entry, .reading { display: grid; gap: var(--space-3); min-width: 0; }
.lookup { max-width: 700px; margin: 0 auto; padding: var(--space-4); }
.character {
  padding: var(--space-4);
  background: var(--surface-color);
  border-radius: var(--radius-lg);
  overflow-wrap: anywhere;
}
.character__title { font-size: 1.35rem; font-weight: 700; }
.entry, .reading { border-top: 1px solid var(--border-color); padding-top: var(--space-3); }
.links { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.note { color: var(--text-secondary-color); font-size: 0.875rem; }
</style>
