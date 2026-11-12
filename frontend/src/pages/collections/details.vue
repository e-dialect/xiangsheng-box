<template>
  <PageShell title="集盒目录">
    <BaseLoading
      v-if="loading"
      text="正在打开盒子…"
    />
    <EmptyState
      v-else-if="error"
      :title="error"
      action-text="重试"
      @action="load"
    />
    <view
      v-else-if="box"
      class="box-stack"
    >
      <view class="box-cover">
        <text class="box-kicker">
          乡声集盒 · {{ box.is_public ? '公开集盒' : '私人珍藏' }}
        </text>
        <text class="box-title">
          {{ box.title }}
        </text><text>{{ box.description }}</text>
        <text class="box-note">
          {{ box.entry_count }} 个词条 · {{ box.recording_count }} 段乡音
        </text>
        <view
          v-if="shareMessage"
          class="box-actions"
        >
          <BaseButton
            size="small"
            variant="ghost"
            :open-type="shareType"
            :text="shareType || canSystemShare ? '分享集盒' : '复制集盒链接'"
            @click="shareCollection"
          />
        </view>
        <BaseButton
          v-if="box.editable"
          variant="ghost"
          :text="organizing ? '完成目录整理' : '整理目录'"
          @click="organizing = !organizing"
        />
        <BaseButton
          v-if="box.editable"
          variant="ghost"
          :text="editing ? '收起编辑' : '编辑盒签'"
          @click="editing = !editing"
        />
      </view>
      <BaseForm
        v-if="editing && box.editable"
        ref="form"
        class="box-panel"
        :data="form"
        :rules="rules"
      >
        <BaseField
          v-model="form.title"
          name="title"
          label="集盒名称"
        />
        <BaseField
          v-model="form.description"
          name="description"
          label="盒子简介"
          type="textarea"
        />
        <view class="box-actions">
          <text>公开集盒</text><TSwitch
            :value="form.is_public"
            @change="form.is_public = $event.value"
          />
        </view>
        <text class="box-note">
          公开后其他人可浏览；隐藏的词条或录音不会因此公开。
        </text>
        <view class="box-actions">
          <BaseButton
            text="保存盒签"
            :loading="busy"
            @click="save"
          /><BaseButton
            variant="danger-ghost"
            text="删除集盒"
            :disabled="busy"
            @click="removeBox"
          />
        </view>
      </BaseForm>
      <view
        v-if="box.editable && organizing"
        class="box-panel"
      >
        <BaseField
          v-model="keyword"
          name="keyword"
          label="收进一个词条"
          placeholder="输入写法或意思"
          @confirm="findEntries"
        />
        <BaseButton
          variant="ghost"
          text="查找词条"
          :loading="finding"
          @click="findEntries"
        />
        <text
          v-if="entrySearched && !candidates.length"
          class="box-note"
        >
          没有找到词条，换一个线索试试。
        </text>
        <view
          v-for="entry in candidates"
          :key="entry.id"
          class="box-actions"
        >
          <text>{{ entryTitle(entry) }} · {{ entry.summary }}</text><BaseButton
            size="small"
            text="收纳"
            :disabled="busy"
            @click="addEntry(entry.id)"
          />
        </view>
      </view>
      <text
        v-if="box.editable && box.unavailable_count"
        class="box-note"
      >
        {{ box.unavailable_count }} 个收纳记录暂不可见，仍保留在盒中，恢复可见后可继续整理。
      </text>
      <EmptyState
        v-if="!box.sections.length"
        title="词条目录还是空的"
        description="从一个词开始，慢慢收集不同地方的声音。"
      />
      <view
        v-for="(section, index) in box.sections"
        :key="section.id"
        class="box-panel"
      >
        <view class="box-actions">
          <text class="box-kicker">
            {{ String(index + 1).padStart(2, '0') }}
          </text>
          <BaseButton
            class="box-entry-title"
            variant="ghost"
            :text="entryTitle(section.entry)"
            @click="goEntryDetail(section.entry.id)"
          />
          <BaseButton
            size="small"
            variant="ghost"
            :text="expanded[section.id] ? '收起录音' : `展开 ${section.recording_count} 段录音`"
            :aria-expanded="Boolean(expanded[section.id])"
            @click="expanded[section.id] = !expanded[section.id]"
          />
        </view>
        <text class="box-note">
          {{ section.entry.summary }}
        </text>
        <view
          v-if="box.editable && organizing"
          class="box-actions"
        >
          <BaseButton
            size="small"
            variant="ghost"
            text="上移词条"
            :disabled="busy || index === 0"
            @click="move(box.sections, index)"
          />
          <BaseButton
            size="small"
            variant="danger-ghost"
            text="移出词条"
            :disabled="busy"
            @click="remove('entries', section.id)"
          />
        </view>
        <view
          v-if="expanded[section.id]"
          class="box-directory"
        >
          <view
            v-for="group in groups(section)"
            :key="group.id"
          >
            <text class="box-heading">
              {{ group.label }}
            </text>
            <view
              v-for="item in group.items"
              :key="item.id"
              class="box-recording"
            >
              <text
                v-if="item.needs_review"
                class="box-note"
              >
                关联已变化，请重新确认这段录音的归属。
              </text>
              <EntryRecordingCard
                :compact="true"
                :community="false"
                :recording="item.recording"
                @open-entry="goEntryDetail"
                @continue="recordFor"
              />
              <view
                v-if="box.editable && organizing"
                class="box-actions"
              >
                <template v-if="item.needs_review">
                  <BaseButton
                    v-for="link in item.recording.entry_links"
                    :key="link.id"
                    size="small"
                    variant="ghost"
                    :text="`改放：${entryTitle(link.entry)}`"
                    :disabled="busy"
                    @click="reassignRecording(item, link.entry.id)"
                  />
                </template>
                <BaseButton
                  size="small"
                  variant="ghost"
                  text="上移录音"
                  :disabled="busy || section.recordings[0]?.id === item.id"
                  @click="moveRecording(section, item.id)"
                />
                <BaseButton
                  size="small"
                  variant="danger-ghost"
                  text="移出录音"
                  :disabled="busy"
                  @click="remove('recordings', item.id)"
                />
              </view>
            </view>
          </view>
          <text
            v-if="!section.recordings.length"
            class="box-note"
          >
            盒内还没有收录这个词的录音。
          </text>
          <view class="box-actions">
            <BaseButton
              v-if="box.editable && organizing"
              size="small"
              text="挑选录音"
              @click="chooseRecordings(section)"
            />
            <BaseButton
              size="small"
              variant="ghost"
              text="查看全部录音"
              @click="goEntryDetail(section.entry.id)"
            />
            <BaseButton
              v-if="!section.entry.recording_count"
              size="small"
              variant="ghost"
              text="补录音"
              @click="recordFor(section.entry.id)"
            />
          </view>
          <view
            v-if="pickingSection?.id === section.id"
            class="box-panel"
          >
            <BaseLoading
              v-if="picking"
              text="正在查找录音…"
            />
            <text
              v-if="pickError"
              role="alert"
            >
              {{ pickError }}
            </text>
            <view
              v-for="recording in recordings"
              :key="recording.id"
              class="box-recording"
            >
              <EntryRecordingCard
                :community="false"
                :recording="recording"
                @open-entry="goEntryDetail"
                @continue="recordFor"
              />
              <BaseButton
                size="small"
                text="收录这段"
                :disabled="busy"
                @click="addRecording(recording.id, section.entry.id)"
              />
            </view>
            <text
              v-if="!picking && !recordings.length && !pickError"
              class="box-note"
            >
              还没有可收录的录音。
            </text>
            <BaseButton
              v-if="recordingNext || pickError"
              variant="ghost"
              :text="pickError ? '重试' : '更多录音'"
              :disabled="picking"
              @click="chooseRecordings(section, !pickError)"
            />
            <BaseButton
              variant="ghost"
              text="收起选择"
              @click="pickingSection = null"
            />
          </view>
        </view>
      </view>
      <view
        v-if="box.pending.length"
        class="box-panel"
      >
        <BaseButton
          variant="ghost"
          :text="`${pendingOpen ? '收起' : '展开'}待整理录音 · ${box.pending.length}`"
          :aria-expanded="pendingOpen"
          @click="pendingOpen = !pendingOpen"
        />
        <template v-if="pendingOpen">
          <text class="box-note">
            先留下声音；关联词条后，再确认放入哪一页目录。
          </text>
          <view
            v-for="item in box.pending"
            :key="item.id"
            class="box-recording"
          >
            <EntryRecordingCard
              :community="false"
              :recording="item.recording"
              @open-entry="goEntryDetail"
              @continue="recordFor"
            />
            <view
              v-if="box.editable && organizing"
              class="box-actions"
            >
              <BaseButton
                v-for="link in item.recording.entry_links"
                :key="link.id"
                size="small"
                variant="ghost"
                :text="`归入：${entryTitle(link.entry)}`"
                :disabled="busy"
                @click="addRecording(item.recording.id, link.entry.id)"
              />
              <BaseButton
                variant="danger-ghost"
                size="small"
                text="移出"
                :disabled="busy"
                @click="remove('recordings', item.id)"
              />
            </view>
          </view>
        </template>
      </view>
    </view>
  </PageShell>
</template>
<script>
import TSwitch from '@tdesign/uniapp/switch/switch.vue';
import PageShell from '@/components/PageShell.vue';
import BaseButton from '@/components/BaseButton.vue';
import BaseForm from '@/components/BaseForm.vue';
import BaseField from '@/components/BaseField.vue';
import BaseLoading from '@/components/BaseLoading.vue';
import EmptyState from '@/components/EmptyState.vue';
import EntryRecordingCard from '@/components/EntryRecordingCard.vue';
import {
  getCollection, updateCollection, deleteCollection, addCollectionEntry,
  addCollectionRecording, removeCollectionItem, orderCollection,
} from '@/services/collections';
import {
  listEntries, listRecordings, entryTitle, dialectLabel, pageResults,
} from '@/services/entryRecording';
import { goEntryDetail, goRecord, goCollections } from '@/services/navigation';
import { confirm, notify } from '@/services/feedback';
import {
  collectionShareMessage, defaultContentShareMessage, syncContentShareMenu,
} from '@/services/contentShare';
import { canUseNativeMiniProgramShare } from '@/services/platform';
import {
  canUseSystemShare, hasShareTarget, sharePage, WECHAT_SHARE_IMAGE,
} from '@/services/pageShare';

export default {
  components: {
    TSwitch,
    PageShell,
    BaseButton,
    BaseForm,
    BaseField,
    BaseLoading,
    EmptyState,
    EntryRecordingCard,
  },
  data: () => ({
    id: null,
    box: null,
    loading: true,
    error: '',
    busy: false,
    editing: false,
    organizing: false,
    form: {},
    rules: {
      title: [{
        required: true,
        message: '请填写名称',
      }],
    },
    expanded: {},
    pendingOpen: false,
    keyword: '',
    candidates: [],
    finding: false,
    entrySearched: false,
    pickingSection: null,
    picking: false,
    pickError: '',
    recordings: [],
    recordingNext: null,
    recordingPage: 1,
  }),
  computed: {
    shareType() { return canUseNativeMiniProgramShare() ? 'share' : ''; },
    canSystemShare: canUseSystemShare,
    shareMessage() {
      if (!hasShareTarget() || this.loading || this.busy || this.error) return null;
      return collectionShareMessage(this.box);
    },
  },
  watch: {
    shareMessage(message) {
      syncContentShareMenu(this, Boolean(message));
    },
  },
  onLoad(options = {}) {
    this.id = options.id;
  },
  onShow() {
    syncContentShareMenu(this, false);
    this.load();
  },
  // #ifdef MP-WEIXIN || MP-QQ
  onShareAppMessage() {
    const { title, path } = this.shareMessage || defaultContentShareMessage();
    return { title, path, imageUrl: WECHAT_SHARE_IMAGE };
  },
  // #endif
  // #ifdef MP-WEIXIN
  onShareTimeline() {
    const { title, query = 'id=' } = this.shareMessage || defaultContentShareMessage();
    return { title, query, imageUrl: WECHAT_SHARE_IMAGE };
  },
  // #endif
  methods: {
    entryTitle,
    goEntryDetail,
    shareCollection() {
      // #ifdef H5 || APP-PLUS
      return sharePage(this.shareMessage, '集盒链接已复制');
      // #endif
    },
    recordFor(id) {
      goRecord({
        entry_id: id,
      });
    },
    groups(section) {
      const groups = [];
      section.recordings.forEach((item) => {
        const id = item.recording.usage_dialect?.id || 'unknown';
        let group = groups.find((row) => row.id === id);
        if (!group) {
          group = {
            id,
            label: dialectLabel(item.recording.usage_dialect),
            items: [],
          };
          groups.push(group);
        }
        group.items.push(item);
      });
      return groups;
    },
    async load() {
      this.loading = true;
      this.error = '';
      try {
        this.box = await getCollection(this.id);
        this.form = {
          title: this.box.title,
          description: this.box.description,
          is_public: this.box.is_public,
        };
      } catch (error) {
        this.error = '集盒不存在、已设为私有或暂时无法读取';
      } finally {
        this.loading = false;
      }
    },
    async mutate(operation) {
      if (this.busy) return;
      this.busy = true;
      try {
        await operation();
        await this.load();
      } catch (error) {
        notify({
          title: error.message || '操作失败，请重试',
        });
      } finally {
        this.busy = false;
      }
    },
    async save() {
      if ((await this.$refs.form.validate()) !== true) return;
      await this.mutate(() => updateCollection(this.id, this.form));
    },
    async removeBox() {
      if (!(await confirm({
        title: '删除这个集盒？',
        content: '只删除盒内编排，词条和原始录音会保留。',
        danger: true,
      }))) return;
      this.busy = true;
      try {
        await deleteCollection(this.id);
        goCollections({
          mine: true,
        });
      } catch (error) {
        notify({
          title: '删除失败，请重试',
        });
      } finally {
        this.busy = false;
      }
    },
    async findEntries() {
      if (!this.keyword.trim() || this.finding) return;
      this.finding = true;
      try {
        this.candidates = pageResults(await listEntries({
          search: this.keyword,
          page_size: 10,
        }));
        this.entrySearched = true;
      } catch (error) {
        notify({
          title: '查找失败，请重试',
        });
      } finally {
        this.finding = false;
      }
    },
    addEntry(id) {
      return this.mutate(() => addCollectionEntry(this.id, id));
    },
    addRecording(id, entryId) {
      return this.mutate(() => addCollectionRecording(this.id, id, entryId));
    },
    reassignRecording(item, entryId) {
      return this.mutate(async () => {
        await addCollectionRecording(this.id, item.recording.id, entryId);
        await removeCollectionItem(this.id, 'recordings', item.id);
      });
    },
    async remove(kind, id) {
      if (!(await confirm({
        title: '从集盒移出？',
        content: kind === 'entries' ? '该词条及其盒内录音编排会移出，原始资料仍保留。' : '原始录音仍会保留。',
      }))) return;
      await this.mutate(() => removeCollectionItem(this.id, kind, id));
    },
    moveRecording(section, id) {
      const index = section.recordings.findIndex((item) => item.id === id);
      this.move(section.recordings, index, section.id);
    },
    move(items, index, sectionId) {
      if (index < 1) return;
      const ids = items.map((item) => item.id);
      [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
      this.mutate(() => orderCollection(this.id, ids, sectionId));
    },
    async chooseRecordings(section, more = false) {
      if (this.picking) return;
      this.pickingSection = section;
      this.picking = true;
      this.pickError = '';
      const page = more === true ? this.recordingPage + 1 : 1;
      if (page === 1) this.recordings = [];
      try {
        const response = await listRecordings({
          entry_id: section.entry.id,
          page,
        });
        this.recordings = page === 1
          ? pageResults(response) : [...this.recordings, ...pageResults(response)];
        this.recordingPage = page;
        this.recordingNext = response.next;
      } catch (error) {
        this.pickError = '录音暂时无法读取';
      } finally {
        this.picking = false;
      }
    },
  },
};
</script>
<style src="@/styles/collections.scss" lang="scss"></style>
