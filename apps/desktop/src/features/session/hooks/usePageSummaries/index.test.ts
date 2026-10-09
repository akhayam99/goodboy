// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { aSession } from '@goodboy/types/testing';
import type { IsoDateTime, ResolveQueueItemWithThread } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { noteRow } from '../../../../app/components/MockScene/scenes/resolveGitlabSeed';
import {
  QUEUE_ITEMS,
  SESSION_ID,
  buildItem,
  buildThread,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { usePageSummaries } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const waitingNote = (): ResolveQueueItemWithThread => {
  const row = noteRow({
    note: {
      id: 'mock-note-1',
      sessionId: SESSION_ID,
      filePath: 'src/a.ts',
      body: 'Cap it',
      status: 'open',
      createdAt: '2026-10-07T00:00:00.000Z' as IsoDateTime,
      authorKind: 'user',
    },
  });
  return { item: row.item, thread: { ...row.thread, state: 'needs_answer', stage: 'asking' } };
};

describe('usePageSummaries counts comments and notes apart', () => {
  it('counts the comments that need you once, and one waiting note on the Branch page', () => {
    seedResolveScene({ expandedThreadId: null });
    useAppStore.setState({
      sessionResolveQueueItems: { [SESSION_ID]: [...QUEUE_ITEMS, waitingNote()] },
    });
    const { result } = renderHook(() =>
      usePageSummaries({ session: aSession({ id: SESSION_ID }) }),
    );

    expect(result.current.branch).toBe('4 need you · 1 note');
  });

  it('says nothing about notes when only comments wait', () => {
    seedResolveScene({ expandedThreadId: null });
    const { result } = renderHook(() =>
      usePageSummaries({ session: aSession({ id: SESSION_ID }) }),
    );

    expect(result.current.branch).toBe('4 need you');
  });

  it('counts a question, a proposal to review and a failed push as the same need', () => {
    seedResolveScene({ expandedThreadId: null });
    const pushFailed = {
      item: buildItem({
        id: 'mock-item-push-failed',
        threadId: 'PRRT_push_failed',
        approvalState: 'accepted',
        approvedRevision: 1,
        deferredAt: null,
        deliveredAt: null,
        candidateRevision: 1,
        createdMinutesAgo: 5,
      }),
      thread: {
        ...buildThread({
          threadId: 'PRRT_push_failed',
          state: 'failed',
          stage: 'failed',
          revision: 1,
          activeAttemptId: null,
          disposition: 'fix',
          replyDraft: 'Done.',
          question: null,
          createdMinutesAgo: 5,
        }),
        stateReason: 'publication_failed:rejected',
      },
    };
    useAppStore.setState({
      sessionResolveQueueItems: { [SESSION_ID]: [...QUEUE_ITEMS, pushFailed] },
    });
    const { result } = renderHook(() =>
      usePageSummaries({ session: aSession({ id: SESSION_ID }) }),
    );

    expect(result.current.branch).toBe('5 need you');
  });

  it('says nothing when no pull request is selected, as the Comments tab does', () => {
    seedResolveScene({ expandedThreadId: null });
    useAppStore.setState({ sessionGithub: {} });
    const { result } = renderHook(() =>
      usePageSummaries({ session: aSession({ id: SESSION_ID }) }),
    );

    expect(result.current.branch).toBeUndefined();
  });
});
