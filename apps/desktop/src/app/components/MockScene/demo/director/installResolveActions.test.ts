// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { SESSION_ID, seedResolveScene } from '../../scenes/resolveSeed';
import { installResolveActions } from './installResolveActions';

const THREAD = 'PRRT_thread_retry_constant';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  seedResolveScene({ expandedThreadId: null });
  installResolveActions({ store });
});

afterEach(() => {
  vi.useRealTimers();
});

const entryOf = () =>
  (store.getState().sessionResolveQueueItems[SESSION_ID] ?? []).find(
    (entry) => entry.thread.threadId === THREAD,
  );

const startFix = async () =>
  store.getState().spawnAgent(SESSION_ID, {
    kindOverride: 'resolver',
    sourceThreadIds: [THREAD],
    name: 'Resolve: 1 review comment',
    humanPrompt: 'Fix this review comment.',
  });

describe('the simulated review fix', () => {
  it('keeps the comment working until the fix and the drafted reply exist', async () => {
    const agentId = await startFix();
    expect(entryOf()?.thread.stage).toBe('working');
    expect(entryOf()?.thread.replyDraft).toBeNull();
    vi.advanceTimersByTime(4000);
    expect(entryOf()?.thread.stage).toBe('working');
    vi.advanceTimersByTime(4000);
    expect(entryOf()?.thread).toMatchObject({
      state: 'fixed',
      stage: 'proposed',
      disposition: 'fix',
    });
    expect(entryOf()?.thread.replyDraft?.length).toBeGreaterThan(0);
    expect(store.getState().agentTurnState[agentId]?.kind).toBe('idle');
    const attempt = store
      .getState()
      .sessionResolveAttempts[SESSION_ID]?.find((entry) => entry.agentId === agentId);
    expect(attempt?.phase).toBe('finished');
  });

  it('approves the fix locally and keeps the drafted reply ready to publish', async () => {
    await startFix();
    vi.advanceTimersByTime(8000);
    const entry = entryOf();
    if (entry === undefined) {
      throw new Error('no comment');
    }
    await store.getState().acceptResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: entry.item.id,
      revision: entry.item.candidateRevision,
      reply: entry.thread.replyDraft ?? '',
    });
    expect(entryOf()?.item.approvalState).toBe('accepted');
    expect(entryOf()?.thread.stage).toBe('approved');
    expect(entryOf()?.thread.replyPostedAt).toBeNull();
  });

  it('stops a fix in flight and lets the visitor start it again', async () => {
    const first = await startFix();
    vi.advanceTimersByTime(2000);
    await store.getState().forceCloseResolver(SESSION_ID, first);
    expect(entryOf()?.thread).toMatchObject({ state: 'open', stage: 'new' });
    vi.advanceTimersByTime(10000);
    expect(entryOf()?.thread.replyDraft).toBeNull();
    await startFix();
    vi.advanceTimersByTime(8000);
    expect(entryOf()?.thread.stage).toBe('proposed');
  });

  it('previews the approved fix for the push, then says publishing stays local', async () => {
    await startFix();
    vi.advanceTimersByTime(8000);
    const entry = entryOf();
    if (entry === undefined) {
      throw new Error('no comment');
    }
    await store.getState().acceptResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: entry.item.id,
      revision: entry.item.candidateRevision,
      reply: entry.thread.replyDraft ?? '',
    });
    const preview = await store.getState().preparePublication({ sessionId: SESSION_ID });
    expect(preview.blocker).toBeNull();
    expect(preview.replies.map((reply) => reply.threadId)).toContain(THREAD);
    expect(preview.commits.flatMap((commit) => commit.threadIds)).toContain(THREAD);
    expect(store.getState().activePublicationPreview[SESSION_ID]).toEqual(preview);
    const publicationId = preview.publicationId;
    if (publicationId === null) {
      throw new Error('no publication');
    }
    await expect(
      store.getState().publishConversations({ sessionId: SESSION_ID, publicationId }),
    ).rejects.toThrow();
    expect(store.getState().undoNotices.at(-1)?.toast.title).toBe('In the app');
    expect(entryOf()?.thread.replyPostedAt).toBeNull();
  });

  it('keeps publishing local and says so', async () => {
    await expect(
      store.getState().publishThreadNow({ sessionId: SESSION_ID, threadId: THREAD }),
    ).rejects.toThrow();
    const notice = store.getState().undoNotices.at(-1);
    expect(notice?.toast.title).toBe('In the app');
    expect(entryOf()?.thread.replyPostedAt).toBeNull();
  });
});

describe('keeping a draft after the reviewer edits the comment', () => {
  it('keeps the comment list and the draft and clears the change', async () => {
    const typo = 'PRRT_thread_typo';
    const before = store.getState().sessionResolveQueueItems[SESSION_ID] ?? [];
    expect(
      store.getState().sessionResolveSourceSnapshots[SESSION_ID]?.[typo]?.changed,
    ).not.toBeNull();
    void store
      .getState()
      .settleResolveSourceChange({ sessionId: SESSION_ID, threadId: typo, keepDraft: true });
    await vi.advanceTimersByTimeAsync(0);
    const state = store.getState();
    expect(state.sessionResolveQueueItems[SESSION_ID]).toEqual(before);
    expect(state.sessionResolveSourceSnapshots[SESSION_ID]?.[typo]).toMatchObject({
      fingerprint: 'mock-typo-after',
      changed: null,
    });
    expect(
      state.sessionResolveSourceSnapshots[SESSION_ID]?.['PRRT_thread_retry_metrics'],
    ).toBeDefined();
  });
});
