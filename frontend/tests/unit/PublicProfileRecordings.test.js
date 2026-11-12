import { flushPromises, mount } from '@vue/test-utils';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import Profile from '@/pages/users/details.vue';
import { listRecordings } from '@/services/entryRecording';

vi.mock('@/services/entryRecording', async (original) => ({
  ...(await original()), listRecordings: vi.fn(),
}));
vi.mock('@/services/shareMessages', () => ({ defaultMessage: () => ({}) }));

let wrapper;
const recording = { id: 1, original_gloss: '乡音' };
const page = (results, next = null) => ({ results, next });
const button = (text) => wrapper.findAll('button').find((item) => item.text() === text);
async function open(publicCount = 2) {
  wrapper = mount(Profile, {
    global: {
      stubs: {
        PageShell: { template: '<div><slot /></div>' },
        BaseButton: { props: ['text', 'loading'], template: '<button @click="$emit(\'click\')">{{ text }}<slot /></button>' },
        EmptyState: { props: ['title', 'actionText'], template: '<div>{{ title }}<button v-if="actionText" @click="$emit(\'action\')">{{ actionText }}</button></div>' },
        BaseLoading: { props: ['text'], template: '<div>{{ text }}</div>' },
        EntryRecordingCard: { props: ['recording'], template: '<div class="recording">{{ recording.original_gloss }}</div>' },
      },
    },
  });
  await wrapper.setData({ id: '9', loading: false, userInfo: { user: { id: 9, nickname: '乡友' }, contribution: { recordings: publicCount } } });
  wrapper.vm.selectWorksTab('recordings');
  await flushPromises();
}
beforeEach(() => { vi.stubGlobal('uni', { getStorageSync: () => '' }); listRecordings.mockReset(); });
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals(); });

describe('public profile recordings', () => {
  it('preserves the profile and retries a failed first page', async () => {
    listRecordings.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([recording]));
    await open();
    expect(wrapper.text()).toContain('乡友');
    expect(wrapper.text()).toContain('暂时无法读取公开录音');
    await button('重新加载录音').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.recording')).toHaveLength(1);
    expect(listRecordings.mock.calls.map(([query]) => query)).toEqual([{ recorder_id: '9', page: 1 }, { recorder_id: '9', page: 1 }]);
  });
  it('keeps cards on a failed next page, retries the same page, and deduplicates', async () => {
    listRecordings.mockResolvedValueOnce(page([recording], 'page2')).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([recording, { id: 2, original_gloss: '问候' }]));
    await open();
    await button('听更多乡音').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.recording')).toHaveLength(1);
    await button('重试加载更多乡音').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.recording')).toHaveLength(2);
    expect(listRecordings.mock.calls.map(([query]) => query.page)).toEqual([1, 2, 2]);
    expect(button('听更多乡音')).toBeUndefined();
  });
  it('ignores repeated requests while loading and retains cards across tab changes', async () => {
    let finish;
    listRecordings.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await open();
    wrapper.vm.selectWorksTab('recordings');
    wrapper.vm.loadPublicRecordings();
    expect(listRecordings).toHaveBeenCalledTimes(1);
    finish(page([recording]));
    await flushPromises();
    wrapper.vm.selectWorksTab('senses');
    await flushPromises();
    expect(wrapper.findAll('.recording')).toHaveLength(0);
    wrapper.vm.selectWorksTab('recordings');
    await flushPromises();
    expect(wrapper.findAll('.recording')).toHaveLength(1);
    expect(listRecordings).toHaveBeenCalledTimes(1);
  });
  it('renders an empty public result without a next-page action', async () => {
    listRecordings.mockResolvedValueOnce(page([]));
    await open();
    expect(wrapper.text()).toContain('暂时没有可听的公开录音');
    expect(button('听更多乡音')).toBeUndefined();
  });
  it('does not send duplicate next-page requests', async () => {
    let finish;
    listRecordings.mockResolvedValueOnce(page([recording], 'page2'))
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await open();
    await button('听更多乡音').trigger('click');
    wrapper.vm.loadPublicRecordings(true);
    expect(listRecordings).toHaveBeenCalledTimes(2);
    finish(page([{ id: 2, display_writing: '问候', original_gloss: '问候' }]));
    await flushPromises();
    expect(wrapper.findAll('.recording')).toHaveLength(2);
  });

  it('does not request a list when the profile has no public recordings', async () => {
    await open(0);
    expect(wrapper.text()).toContain('还没有公开录音');
    expect(listRecordings).not.toHaveBeenCalled();
  });
});
