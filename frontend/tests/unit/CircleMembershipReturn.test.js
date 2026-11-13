import { flushPromises, shallowMount } from '@vue/test-utils';
import {
  beforeEach, expect, it, vi,
} from 'vitest';
import Directory from '@/pages/circles/index.vue';
import Details from '@/pages/circles/details.vue';
import {
  getCircle, joinCircle, leaveCircle, listCircles, listCircleRecordings,
} from '@/services/guantou';
import { membershipSession, publishMembership } from '@/services/circleMembership';

vi.mock('@/services/authGuard', () => ({ requireAuth: () => true }));
vi.mock('@/services/guantou', () => ({
  joinCircle: vi.fn(),
  leaveCircle: vi.fn(),
  listCircles: vi.fn(),
  getCircle: vi.fn(),
  listCircleRecordings: vi.fn(),
}));
const circle = {
  id: 1, name: '测试圈', is_member: false, member_count: 3,
};
let token = 0;
beforeEach(() => {
  vi.clearAllMocks();
  token += 1;
  vi.stubGlobal('uni', { getStorageSync: vi.fn().mockReturnValue(String(token)) });
  membershipSession();
});

it('updates retained directory after join and leave without resetting search or pagination', async () => {
  const directory = shallowMount(Directory);
  const detail = shallowMount(Details);
  await directory.setData({
    circles: [circle], search: 'draft', appliedSearch: 'query', page: 3, next: true,
  });
  await detail.setData({ circle });
  joinCircle.mockResolvedValue({ is_member: true, member_count: 4 });
  await detail.vm.toggleMembership();
  expect(directory.vm.circles[0]).toMatchObject({ is_member: true, member_count: 4 });
  expect(directory.vm.search).toBe('draft');
  expect(directory.vm.appliedSearch).toBe('query');
  expect(directory.vm.page).toBe(3);
  expect(directory.vm.next).toBe(true);
  leaveCircle.mockResolvedValue({ is_member: false, member_count: 3 });
  await directory.vm.toggleMembership(directory.vm.circles[0]);
  expect(leaveCircle).toHaveBeenCalledWith(1);
  expect(directory.vm.circles[0].is_member).toBe(false);
  directory.unmount();
  detail.unmount();
});

it('does not publish failure or a result for an old account', async () => {
  const directory = shallowMount(Directory);
  const detail = shallowMount(Details);
  await directory.setData({ circles: [circle] });
  await detail.setData({ circle });
  joinCircle.mockRejectedValueOnce(new Error('offline'));
  await expect(detail.vm.toggleMembership()).rejects.toThrow('offline');
  expect(directory.vm.circles[0]).toEqual(circle);
  let resolve;
  joinCircle.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const pending = detail.vm.toggleMembership();
  uni.getStorageSync.mockReturnValue('other');
  resolve({ is_member: true, member_count: 4 });
  await pending;
  expect(directory.vm.circles[0]).toEqual(circle);
  directory.unmount();
  detail.unmount();
});

it('overlays a successful detail mutation on a stale pending directory response', async () => {
  const directory = shallowMount(Directory);
  const detail = shallowMount(Details);
  await detail.setData({ circle });
  let resolve;
  listCircles.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const pending = directory.vm.load(1);
  joinCircle.mockResolvedValue({ is_member: true, member_count: 4 });
  await detail.vm.toggleMembership();
  resolve({ results: [circle], count: 1 });
  await pending;
  expect(directory.vm.circles[0]).toMatchObject({ is_member: true, member_count: 4 });
  Directory.onShow.call(directory.vm);
  Directory.onShow.call(directory.vm);
  expect(listCircles).toHaveBeenCalledTimes(1);
  directory.unmount();
  detail.unmount();
});

it('rejects a previous session result even after returning to the same account', () => {
  const oldSession = membershipSession();
  uni.getStorageSync.mockReturnValue('different');
  membershipSession();
  uni.getStorageSync.mockReturnValue(String(token));
  const current = membershipSession();
  expect(publishMembership(current, 1, { is_member: true, member_count: 4 })).toBe(true);
  expect(publishMembership(oldSession, 1, { is_member: false, member_count: 3 })).toBe(false);
});

it('publishes a successful mutation after detail unload and blocks a competing retained button', async () => {
  const directory = shallowMount(Directory);
  const detail = shallowMount(Details);
  await directory.setData({ circles: [circle] });
  await detail.setData({ circle });
  let resolve;
  joinCircle.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const pending = detail.vm.toggleMembership();
  detail.unmount();
  await directory.vm.toggleMembership(circle);
  expect(joinCircle).toHaveBeenCalledTimes(1);
  resolve({ is_member: true, member_count: 4 });
  await pending;
  expect(directory.vm.circles[0]).toMatchObject({ is_member: true, member_count: 4 });
  expect(detail.vm.circle).toEqual(circle);
  directory.unmount();
});

it('reloads a retained detail for a new account before enabling its membership button', async () => {
  const detail = shallowMount(Details);
  await detail.setData({ circle, circleId: 1, membershipAccount: membershipSession() });
  uni.getStorageSync.mockReturnValue('new account');
  getCircle.mockResolvedValue({ ...circle, is_member: true, member_count: 4 });
  listCircleRecordings.mockResolvedValue({ results: [] });
  Details.onShow.call(detail.vm);
  expect(detail.vm.circle).toBe(null);
  await flushPromises();
  expect(detail.vm.circle.is_member).toBe(true);
  detail.unmount();
});

it('does not display recordings from the old account after switching', async () => {
  const detail = shallowMount(Details);
  const previousRecording = { id: 10, original_gloss: '旧账号可见录音' };
  const currentRecording = { id: 20, original_gloss: '当前账号可见录音' };
  await detail.setData({
    circle, circleId: 1, membershipAccount: membershipSession(), recordings: [previousRecording],
  });
  let resolveOldRequest;
  listCircleRecordings
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOldRequest = resolve; }))
    .mockResolvedValueOnce({ results: [currentRecording] });
  const previousRequest = detail.vm.loadRecordings();
  uni.getStorageSync.mockReturnValue('new account');
  getCircle.mockResolvedValue(circle);
  Details.onShow.call(detail.vm);
  expect(detail.vm.recordings).toEqual([]);
  await flushPromises();
  expect(detail.vm.recordings).toEqual([currentRecording]);
  resolveOldRequest({ results: [previousRecording], next: '/old-page' });
  await previousRequest;
  expect(detail.vm.recordings).toEqual([currentRecording]);
  expect(detail.vm.hasMoreRecordings).toBe(false);
  detail.unmount();
});
