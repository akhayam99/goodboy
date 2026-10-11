// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  SESSION_ID,
  THREAD_IDS,
  seedResolveScene,
} from '../../../app/components/MockScene/scenes/resolveSeed';
import { replyOnHostThread, resolveHostThread } from './hostThreadVerbs';
import { hostDiffThreadId } from './threadIds';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveScene({ expandedThreadId: null });
});

const rowOf = (threadId: string) => {
  const entry = (useAppStore.getState().sessionResolveQueueItems[SESSION_ID] ?? []).find(
    (candidate) => candidate.thread.threadId === threadId,
  );
  if (entry === undefined) {
    throw new Error(`no row ${threadId}`);
  }
  return entry;
};

describe('the host thread verbs of Files', () => {
  it('sends a reply as the reply only answer of the thread, the way Comments does', async () => {
    const refuseResolveQueueItem = vi.fn(async () => undefined);
    useAppStore.setState({ refuseResolveQueueItem });
    const entry = rowOf(THREAD_IDS.typo);

    await replyOnHostThread({
      getState: useAppStore.getState,
      sessionId: SESSION_ID,
      id: hostDiffThreadId({ threadId: THREAD_IDS.typo }),
      body: 'Fixed in 9e4c1a7',
    });

    expect(refuseResolveQueueItem).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      itemId: entry.item.id,
      revision: entry.thread.revision,
      reply: 'Fixed in 9e4c1a7',
    });
  });

  it('resolves a thread without a reply', async () => {
    const resolveWithoutReply = vi.fn(async () => undefined);
    useAppStore.setState({ resolveWithoutReply });
    const entry = rowOf(THREAD_IDS.typo);

    await resolveHostThread({
      getState: useAppStore.getState,
      sessionId: SESSION_ID,
      id: hostDiffThreadId({ threadId: THREAD_IDS.typo }),
    });

    expect(resolveWithoutReply).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      itemId: entry.item.id,
    });
  });

  it('says the comment is gone when its row is no longer in Comments', async () => {
    await expect(
      replyOnHostThread({
        getState: useAppStore.getState,
        sessionId: SESSION_ID,
        id: hostDiffThreadId({ threadId: 'PRRT_gone' }),
        body: 'Anyone there?',
      }),
    ).rejects.toThrow('This comment is no longer in Comments');
  });
});
