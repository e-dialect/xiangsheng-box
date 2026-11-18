import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { goRecordingDrafts } from '@/services/navigation';
import RecordingCreate from '@/pages/recordings/create.vue';
import { saveRecordingDraft, draftOwner } from '@/services/recordingDrafts';
import Picker from '@/components/CollectionPicker.vue';
import Search from '@/pages/search.vue';
import Detail from '@/components/DiscussionThread.vue';
import { addCollectionEntry, addCollectionRecording } from '@/services/collections';
import { suggestEntries } from '@/services/entrySearchAssist';
import { createComment, listComments } from '@/services/recordingSocial';

vi.mock('@/services/recordingDrafts', () => ({
  draftOwner: vi.fn(() => 'user:1'), saveRecordingDraft: vi.fn(), restoreRecordingDraft: vi.fn(), deleteRecordingDraft: vi.fn(),
}));
vi.mock('@/services/collections', () => ({
  listCollections: vi.fn(),
  createCollection: vi.fn(),
  addCollectionEntry: vi.fn(),
  addCollectionRecording: vi.fn(),
  getCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  removeCollectionItem: vi.fn(),
  orderCollection: vi.fn(),
}));
vi.mock('@/services/entrySearchAssist', () => ({
  suggestEntries: vi.fn(),
  popularEntries: vi.fn(),
  searchHistory: vi.fn(() => []),
  rememberSearch: vi.fn(),
  clearSearchHistory: vi.fn(),
}));
vi.mock('@/services/recordingSocial', () => ({
  likeRecording: vi.fn(), listComments: vi.fn(), createComment: vi.fn(), deleteComment: vi.fn(), likeComment: vi.fn(), commentRequestId: vi.fn(() => 'same-request'),
}));
vi.mock('@/services/authGuard', () => ({ requireAuth: vi.fn(() => true) }));
vi.mock('@/services/feedback', () => ({ notify: vi.fn(), confirm: vi.fn(async () => true) }));
vi.mock('@/services/navigation', async (importOriginal) => ({
  ...await importOriginal(), goRecordingDrafts: vi.fn(),
}));
const context = (component, extra = {}) => ({
  ...component.data(), ...component.methods, ...extra,
});
beforeEach(() => { vi.clearAllMocks(); });
describe('restored journeys', () => {
  it('retries with the saved native path after draft index persistence fails', async () => {
    const error = Object.assign(new Error('草稿空间不足'), { persistedAudio: { path: 'wxfile://saved', persisted: true, mediaId: 'a' } });
    saveRecordingDraft.mockRejectedValueOnce(error);
    const page = context(RecordingCreate, { ownerScope: 'user:1', audio: { path: 'wxfile://temporary' } });
    await page.saveDraft();
    expect(page.audio.path).toBe('wxfile://saved');
    expect(page.draftMessage).toBe('草稿空间不足');
    saveRecordingDraft.mockResolvedValueOnce({ id: 'draft-a', audio: error.persistedAudio });
    await page.saveDraft();
    expect(saveRecordingDraft.mock.calls.at(-1)[0].audio.path).toBe('wxfile://saved');
  });
  it('keeps a mini-program recording submit-ready after saving moves its temporary file', async () => {
    saveRecordingDraft.mockResolvedValue({ id: 'draft-a', audio: { path: 'wxfile://saved', persisted: true, mediaId: 'a' } });
    const page = context(RecordingCreate, { ownerScope: 'user:1', audio: { path: 'wxfile://temporary' } });
    await page.saveDraft();
    expect(page.audio.path).toBe('wxfile://saved');
    expect(page.draftId).toBe('draft-a');
  });
  it('collects just an entry without automatically collecting all of its recordings', async () => {
    const picker = context(Picker, { entryId: 9, recording: null });
    await picker.collect(1);
    expect(addCollectionEntry).toHaveBeenCalledWith(1, 9);
    expect(addCollectionRecording).not.toHaveBeenCalled();
  });
  it('uses the chosen entry only as collection placement', async () => {
    const picker = context(Picker, { recording: { id: 5 }, selectedEntry: 7 });
    await picker.collect(1);
    expect(addCollectionRecording).toHaveBeenCalledWith(1, 5, 7);
    expect(addCollectionEntry).not.toHaveBeenCalled();
  });
  it('ignores a late suggestion response after the user changes the query', async () => {
    vi.useFakeTimers();
    let resolveFirst;
    suggestEntries.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce([{ id: 2 }]);
    const search = context(Search);
    Search.watch['filters.keyword'].call(search, '月');
    await vi.advanceTimersByTimeAsync(250);
    Search.watch['filters.keyword'].call(search, '雨');
    await vi.advanceTimersByTimeAsync(250);
    resolveFirst([{ id: 1 }]); await Promise.resolve();
    expect(search.suggestions).toEqual([{ id: 2 }]);
    vi.useRealTimers();
  });
  it('retains a comment request id after a failed send to prevent duplicate comments', async () => {
    const detail = context(Detail, {
      targetId: 5, targetType: 'recording', form: { body: '乡音' }, $refs: { commentForm: { validate: async () => true } },
    });
    createComment.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 1 });
    listComments.mockResolvedValue({ results: [], next: null });
    await detail.sendTopLevel(); expect(detail.form.body).toBe('乡音');
    await detail.sendTopLevel();
    expect(createComment.mock.calls[0][0].client_id).toBe(createComment.mock.calls[1][0].client_id);
    expect(detail.form.body).toBe('');
  });
});

describe('draft interruption recovery', () => {
  it('debounces editing and persists a dirty form when the page is hidden', async () => {
    vi.useFakeTimers();
    saveRecordingDraft.mockResolvedValue({ id: 'auto', audio: null });
    const page = context(RecordingCreate, { draftReady: true, ownerScope: 'user:1' });
    page.form.original_gloss = '月娘';
    page.scheduleDraft();
    page.form.original_gloss = '月娘出来了';
    page.scheduleDraft();
    await vi.advanceTimersByTimeAsync(700);
    expect(saveRecordingDraft).toHaveBeenCalledTimes(1);
    expect(saveRecordingDraft.mock.calls[0][0].form.original_gloss).toBe('月娘出来了');
    page.form.original_gloss = '又改了一句';
    RecordingCreate.onHide.call(page);
    await page.draftSavePromise;
    expect(saveRecordingDraft.mock.calls.at(-1)[0].form.original_gloss).toBe('又改了一句');
    vi.useRealTimers();
  });
  it('does not recreate a submitted draft or persist an untouched empty form', async () => {
    const page = context(RecordingCreate, { draftReady: true, ownerScope: 'user:1' });
    await page.persistDirtyDraft();
    expect(saveRecordingDraft).not.toHaveBeenCalled();
    page.form.original_gloss = '已经提交';
    page.submitted = true;
    await page.persistDirtyDraft();
    await page.saveDraft();
    expect(saveRecordingDraft).not.toHaveBeenCalled();
  });
  it('keeps the currently selected replacement audio during an in-flight save', async () => {
    let finish;
    saveRecordingDraft.mockImplementationOnce(() => new Promise((resolve) => {
      finish = resolve;
    }));
    const page = context(RecordingCreate, { ownerScope: 'user:1', audio: { path: 'wxfile://old' } });
    const saving = page.saveDraft();
    await Promise.resolve(); await Promise.resolve();
    page.audio = { path: 'wxfile://replacement' };
    finish({ id: 'a', audio: { path: 'wxfile://saved-old' } });
    await saving;
    expect(page.audio.path).toBe('wxfile://replacement');
    expect(page.savedDraftSignature).not.toBe(page.draftSignature());
  });
});

describe('entry discussion payload', () => {
  it('posts to Entry discussion without accidentally attaching a Recording', async () => {
    const detail = context(Detail, {
      targetId: 9, targetType: 'entry', form: { body: '另一种用法' }, $refs: { commentForm: { validate: async () => true } },
    });
    createComment.mockResolvedValue({ id: 1, created_at: '2026-09-01T00:00:00Z' });
    await detail.sendTopLevel();
    expect(createComment).toHaveBeenCalledWith(expect.objectContaining({ entry_id: 9 }), 'entry');
    expect(createComment.mock.calls[0][0]).not.toHaveProperty('recording_id');
    expect(detail.comments.map((comment) => comment.id)).toEqual([1]);
  });

  it('keeps a new top-level comment visible past page one without duplicating it later', async () => {
    const firstPage = Array.from({ length: 15 }, (_, index) => ({
      id: index + 1,
      body: `留言${index + 1}`,
      created_at: `2026-09-01T00:${String(index).padStart(2, '0')}:00Z`,
    }));
    const newest = {
      id: 16,
      body: '留言16',
      created_at: '2026-09-01T00:15:00Z',
    };
    createComment.mockResolvedValue(newest);
    listComments.mockResolvedValue({ results: [newest], next: null });
    const detail = context(Detail, {
      targetId: 5,
      targetType: 'recording',
      comments: firstPage,
      commentsPage: 1,
      commentsNext: 'next-page',
      form: { body: newest.body },
      $refs: { commentForm: { validate: async () => true } },
    });

    await detail.sendTopLevel();

    expect(detail.comments.map((comment) => comment.id)).toEqual([
      ...firstPage.map((comment) => comment.id),
      newest.id,
    ]);
    expect(detail.form.body).toBe('');
    expect(listComments).not.toHaveBeenCalled();

    await detail.loadComments(true);

    expect(listComments).toHaveBeenCalledWith(5, 2, 'recording');
    expect(detail.comments.filter((comment) => comment.id === newest.id)).toHaveLength(1);
  });
});

describe('discussion replies sheet', () => {
  const makeReply = (n, parentId) => ({
    id: n,
    parent_id: parentId,
    body: `回复${n}`,
    author_name: 'A',
    like_count: 0,
    liked: false,
    editable: false,
    reply_to_id: null,
    reply_to_author_name: '',
  });

  it('loads additional reply pages from the full replies sheet', async () => {
    listComments.mockImplementation(async (id, page, type, parentId) => (
      page === 1
        ? { results: Array.from({ length: 15 }, (_, i) => makeReply(i + 1, parentId)), next: 'next-page' }
        : { results: [makeReply(16, parentId)], next: null }
    ));

    const detail = context(Detail, { targetId: 5, targetType: 'recording' });
    await detail.openReplies({ id: 1, author_name: '楼主', body: '顶层留言' });

    expect(detail.sheetReplies).toHaveLength(15);
    expect(detail.sheetNext).toBe('next-page');

    await detail.loadSheetReplies(true);

    expect(detail.sheetReplies).toHaveLength(16);
    expect(detail.sheetNext).toBeNull();
  });

  it('ignores a stale replies response when switching discussion threads', async () => {
    let resolveSlow;
    listComments
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSlow = resolve; }))
      .mockImplementationOnce(async (id, page, type, parentId) => ({
        results: [makeReply(200, parentId)],
        next: null,
      }));

    const detail = context(Detail, { targetId: 5, targetType: 'recording' });
    const slow = detail.openReplies({ id: 1, author_name: 'A', body: 'A顶层' });
    await Promise.resolve();
    const fast = detail.openReplies({ id: 2, author_name: 'B', body: 'B顶层' });
    await fast;

    expect(detail.sheet.parent.id).toBe(2);

    resolveSlow({ results: [makeReply(100, 1)], next: null });
    await slow;

    expect(detail.sheet.parent.id).toBe(2);
    expect(detail.sheetReplies[0].parent_id).toBe(2);
  });

  it('keeps the newest reply visible after sending past the first page', async () => {
    const firstPage = Array.from({ length: 15 }, (_, i) => makeReply(i + 1, 1));
    listComments.mockImplementation(async (id, page, type, parentId) => (
      page === 1
        ? { results: firstPage, next: 'next-page' }
        : { results: [makeReply(16, parentId)], next: null }
    ));
    createComment.mockResolvedValue({ id: 16, parent_id: 1, body: '回复16' });

    const detail = context(Detail, {
      targetId: 5,
      targetType: 'recording',
      sheet: {
        visible: true,
        parent: {
          id: 1, author_name: '楼主', body: '顶层留言', reply_count: 15,
        },
        replyTarget: null,
      },
      replyDraft: { body: '回复16' },
      $refs: { replyForm: { validate: async () => true } },
    });

    await detail.sendReply();

    expect(detail.sheetReplies.map((item) => item.id)).toEqual([
      ...firstPage.map((item) => item.id),
      16,
    ]);
    expect(detail.sheetNext).toBeNull();
    expect(detail.sheet.parent.reply_count).toBe(16);
  });

  it('loads and focuses a top-level comment anchor from a later page', async () => {
    listComments
      .mockResolvedValueOnce({
        results: [{
          id: 1, author_name: 'A', body: '首页评论', recent_replies: [], reply_count: 0,
        }],
        next: 'next-page',
      })
      .mockResolvedValueOnce({
        results: [{
          id: 42, author_name: 'B', body: '目标评论', recent_replies: [], reply_count: 0,
        }],
        next: null,
      });
    globalThis.uni = { pageScrollTo: vi.fn() };

    const detail = context(Detail, {
      targetId: 5,
      targetType: 'recording',
      anchorCommentId: 42,
      anchorRootId: 42,
      $nextTick: vi.fn(),
    });
    await detail.loadComments();
    await detail.focusAnchor();

    expect(detail.comments.map((comment) => comment.id)).toEqual([1, 42]);
    expect(uni.pageScrollTo).toHaveBeenCalledWith({
      selector: '#comment-42',
      duration: 300,
    });
    delete globalThis.uni;
  });

  it('opens the parent thread and focuses a reply anchor from a later page', async () => {
    const root = {
      id: 1, author_name: '楼主', body: '顶层留言', reply_count: 16,
    };
    listComments.mockImplementation(async (id, page, type, parentId) => {
      if (!parentId) return { results: [root], next: null };
      return page === 1
        ? {
          results: Array.from({ length: 15 }, (_, index) => makeReply(index + 1, parentId)),
          next: 'next-page',
        }
        : { results: [makeReply(16, parentId)], next: null };
    });

    const detail = context(Detail, {
      targetId: 5,
      targetType: 'recording',
      anchorCommentId: 16,
      anchorRootId: 1,
    });
    await detail.loadComments();
    await detail.focusAnchor();

    expect(detail.sheet.visible).toBe(true);
    expect(detail.sheet.parent.id).toBe(1);
    expect(detail.sheetReplies.map((reply) => reply.id)).toContain(16);
    expect(detail.sheetScrollTarget).toBe('reply-16');
  });
});

it('clears displayed draft content when returning under another account', () => {
  const page = context(RecordingCreate, {
    draftReady: true, ownerScope: 'user:1', draftId: 'old', audio: { path: 'wxfile://old' }, form: { original_gloss: 'private' },
  });
  draftOwner.mockReturnValueOnce('user:2');
  RecordingCreate.onShow.call(page);
  expect(page.form.original_gloss).toBe('');
  expect(page.audio.path).toBe('');
  expect(page.draftId).toBe('');
  expect(goRecordingDrafts).toHaveBeenCalledTimes(1);
  expect(saveRecordingDraft).not.toHaveBeenCalled();
});

describe('review regressions', () => {
  it('persists clearing an existing draft instead of restoring stale content', async () => {
    saveRecordingDraft.mockResolvedValueOnce({ id: 'existing', audio: null });
    const page = context(RecordingCreate, {
      draftReady: true, ownerScope: 'user:1', draftId: 'existing', savedDraftSignature: 'previous content',
    });
    await page.persistDirtyDraft();
    expect(saveRecordingDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 'existing', form: expect.objectContaining({ original_gloss: '' }) }), 'user:1');
  });
  it('retries incomplete audio persistence on leaving the page', async () => {
    saveRecordingDraft.mockResolvedValueOnce({ id: 'retry', audio: null, audioError: true }).mockResolvedValueOnce({ id: 'retry', audio: { path: 'saved' } });
    const page = context(RecordingCreate, { draftReady: true, ownerScope: 'user:1', audio: { path: 'temporary' } });
    await page.persistDirtyDraft();
    expect(page.savedDraftSignature).not.toBe(page.draftSignature());
    await page.persistDirtyDraft();
    expect(saveRecordingDraft).toHaveBeenCalledTimes(2);
    expect(page.savedDraftSignature).toBe(page.draftSignature());
  });
  it('does not repopulate a cleared page with another account’s in-flight save', async () => {
    let finish;
    saveRecordingDraft.mockImplementationOnce(() => new Promise((resolve) => {
      finish = resolve;
    }));
    const page = context(RecordingCreate, { draftReady: true, ownerScope: 'user:1', audio: { path: 'old' } });
    const saving = page.saveDraft();
    await Promise.resolve(); await Promise.resolve();
    draftOwner.mockReturnValue('user:2');
    RecordingCreate.onShow.call(page);
    finish({ id: 'private-draft', audio: { path: 'saved' } });
    await saving;
    expect(page.draftId).toBe('');
    expect(page.audio.path).toBe('');
    expect(goRecordingDrafts).toHaveBeenCalledTimes(1);
    draftOwner.mockReturnValue('user:1');
  });
});
