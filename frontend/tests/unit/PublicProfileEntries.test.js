import { flushPromises, mount } from '@vue/test-utils';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import Profile from '@/pages/users/details.vue';
import { listPublicCreatorEntries } from '@/services/entryRecording';

vi.mock('@/services/entryRecording', async (original) => ({
  ...(await original()), listPublicCreatorEntries: vi.fn(), listRecordings: vi.fn(),
}));
vi.mock('@/services/shareMessages', () => ({ defaultMessage: () => ({}) }));

let wrapper;
const entry = { id: 1, display_writing: '乡音' };
const page = (results, next = null) => ({ results, next });
const button = (text) => wrapper.findAll('button').find((item) => item.text() === text);
async function open() {
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
  await wrapper.setData({ id: '9', loading: false, userInfo: { user: { id: 9, nickname: '乡友' }, contribution: { recordings: 2 } } });
  wrapper.vm.selectWorksTab('entries');
  await flushPromises();
}
beforeEach(() => { vi.stubGlobal('uni', { getStorageSync: () => '' }); listPublicCreatorEntries.mockReset(); });
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals(); });

describe('public profile entries', () => {
  it('preserves the profile and retries a failed first page', async () => {
    listPublicCreatorEntries.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([entry]));
    await open();
    expect(wrapper.text()).toContain('乡友');
    expect(wrapper.text()).toContain('暂时无法读取公开词条');
    await button('重新加载词条').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.profile-entry')).toHaveLength(1);
    expect(listPublicCreatorEntries.mock.calls).toEqual([['9', 1], ['9', 1]]);
  });
  it('keeps cards on a failed next page, retries the same page, and deduplicates', async () => {
    listPublicCreatorEntries.mockResolvedValueOnce(page([entry], 'page2')).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([entry, { id: 2, display_writing: '问候' }]));
    await open();
    await button('查看更多词条').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.profile-entry')).toHaveLength(1);
    await button('重试加载更多词条').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.profile-entry')).toHaveLength(2);
    expect(listPublicCreatorEntries.mock.calls.map(([, requestedPage]) => requestedPage))
      .toEqual([1, 2, 2]);
    expect(button('查看更多词条')).toBeUndefined();
  });
  it('ignores repeated requests while loading and retains cards across tab changes', async () => {
    let finish;
    listPublicCreatorEntries.mockImplementationOnce(
      () => new Promise((resolve) => { finish = resolve; }),
    );
    await open();
    wrapper.vm.selectWorksTab('entries');
    wrapper.vm.loadPublicEntries();
    expect(listPublicCreatorEntries).toHaveBeenCalledTimes(1);
    finish(page([entry]));
    await flushPromises();
    wrapper.vm.selectWorksTab('senses');
    await flushPromises();
    expect(wrapper.findAll('.profile-entry')).toHaveLength(0);
    wrapper.vm.selectWorksTab('entries');
    await flushPromises();
    expect(wrapper.findAll('.profile-entry')).toHaveLength(1);
    expect(listPublicCreatorEntries).toHaveBeenCalledTimes(1);
  });
  it('renders an empty public result without a next-page action', async () => {
    listPublicCreatorEntries.mockResolvedValueOnce(page([]));
    await open();
    expect(wrapper.text()).toContain('还没有可查看的公开词条');
    expect(button('查看更多词条')).toBeUndefined();
  });
  it('does not send duplicate next-page requests', async () => {
    let finish;
    listPublicCreatorEntries.mockResolvedValueOnce(page([entry], 'page2'))
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await open();
    await button('查看更多词条').trigger('click');
    wrapper.vm.loadPublicEntries(true);
    expect(listPublicCreatorEntries).toHaveBeenCalledTimes(2);
    finish(page([{ id: 2, display_writing: '问候', original_gloss: '问候' }]));
    await flushPromises();
    expect(wrapper.findAll('.profile-entry')).toHaveLength(2);
  });
});
