// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { sceneInvoke } from '../../../../../test/sceneInvoke';
import { STORY_REVIEW } from '../../scenes/story/storyContent';
import {
  STORY_REVIEW_MOUNT_ID,
  STORY_REVIEW_SESSION_ID,
  STORY_REVIEW_THREAD,
  openStoryFixDrawer,
  seedStoryReview,
} from '../../scenes/story/storyReviewSeed';
import { installStoryReview } from './installStoryReview';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
  seedStoryReview();
  installStoryReview({ store });
});

afterEach(() => {
  vi.useRealTimers();
});

const entryOf = () =>
  (store.getState().sessionResolveQueueItems[STORY_REVIEW_SESSION_ID] ?? []).find(
    (entry) => entry.thread.threadId === STORY_REVIEW_THREAD,
  );

const fixAndApply = async () => {
  await store.getState().spawnAgent(STORY_REVIEW_SESSION_ID, {
    kindOverride: 'resolver',
    sourceThreadIds: [STORY_REVIEW_THREAD],
    name: 'Resolve: 1 review comment',
    humanPrompt: 'Fix this review comment.',
  });
  vi.advanceTimersByTime(8000);
  const entry = entryOf();
  if (entry === undefined) {
    throw new Error('no comment');
  }
  await store.getState().acceptResolveQueueItem({
    sessionId: STORY_REVIEW_SESSION_ID,
    itemId: entry.item.id,
    revision: entry.item.candidateRevision,
    reply: entry.thread.replyDraft ?? '',
  });
};

const forcePush = () =>
  store.getState().pushBranch({
    sessionId: STORY_REVIEW_SESSION_ID,
    mountId: STORY_REVIEW_MOUNT_ID,
    mode: 'lease',
    guard: { kind: 'confirmed', confirmedOnlyOnline: null, confirmedRemoteSha: null },
  });

describe('the review checkpoint', () => {
  it('shows one comment from nadia-p on a pull request dana-r opened', () => {
    const queue = store.getState().sessionResolveQueueItems[STORY_REVIEW_SESSION_ID] ?? [];
    expect(queue).toHaveLength(1);
    expect(store.getState().sessionGithub[STORY_REVIEW_SESSION_ID]?.pr?.author).toBe('dana-r');
    const comments =
      store.getState().sessionGithub[STORY_REVIEW_SESSION_ID]?.detail?.comments ?? [];
    expect(comments.map((comment) => comment.body)).toEqual([STORY_REVIEW.comment]);
    openStoryFixDrawer();
    expect(store.getState().drawer?.kind).toBe('fix-comments');
    expect(entryOf()?.thread.stage).toBe('new');
  });

  it('adds the test and drafts the reply, then opens the comment to apply it', async () => {
    await store.getState().spawnAgent(STORY_REVIEW_SESSION_ID, {
      kindOverride: 'resolver',
      sourceThreadIds: [STORY_REVIEW_THREAD],
      name: 'Resolve: 1 review comment',
      humanPrompt: 'Fix this review comment.',
    });
    expect(entryOf()?.thread.stage).toBe('working');
    vi.advanceTimersByTime(8000);
    expect(entryOf()?.thread).toMatchObject({ stage: 'proposed', replyDraft: STORY_REVIEW.reply });
    expect(store.getState().drawer).toMatchObject({
      kind: 'conversation',
      payload: { threadId: STORY_REVIEW_THREAD },
    });
  });

  it('applies the fix locally and leaves the host thread open', async () => {
    await fixAndApply();
    expect(entryOf()?.item.approvalState).toBe('accepted');
    expect(entryOf()?.thread.state).not.toBe('closed');
    expect(entryOf()?.thread.replyPostedAt).toBeNull();
    expect(store.getState().drawer).toBeNull();
  });
});

describe('rebasing and pushing the reviewed fix', () => {
  it('rebases on main and records a run that still sits ahead of origin', async () => {
    await fixAndApply();
    expect(store.getState().historyRuns[STORY_REVIEW_MOUNT_ID]).toBeUndefined();
    const outcome = await store.getState().rebaseBranch({
      sessionId: STORY_REVIEW_SESSION_ID,
      mountId: STORY_REVIEW_MOUNT_ID,
    });
    expect(outcome).toBe('rebased');
    expect(store.getState().historyRuns[STORY_REVIEW_MOUNT_ID]?.origin).toBe('rebase');
    expect(entryOf()?.thread.state).not.toBe('closed');
  });

  it('closes the thread only when the force push lands, publishing the drafted reply', async () => {
    await fixAndApply();
    await store.getState().rebaseBranch({
      sessionId: STORY_REVIEW_SESSION_ID,
      mountId: STORY_REVIEW_MOUNT_ID,
    });
    expect(entryOf()?.thread.replyPostedAt).toBeNull();
    const result = await forcePush();
    expect(result.ok).toBe(true);
    expect(entryOf()?.thread).toMatchObject({ state: 'closed', stage: 'resolved' });
    expect(entryOf()?.thread.replyPostedAt).not.toBeNull();
    expect(entryOf()?.item.deliveredAt).not.toBeNull();
  });
});
