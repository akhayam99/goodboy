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
  SESSION_ID,
  buildItem,
  buildThread,
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

const waitingComment = (): ResolveQueueItemWithThread => ({
  item: buildItem({
    id: 'mock-item-comment',
    threadId: 'PRRT_comment',
    approvalState: 'none',
    approvedRevision: null,
    deferredAt: null,
    deliveredAt: null,
    candidateRevision: 1,
    createdMinutesAgo: 5,
  }),
  thread: buildThread({
    threadId: 'PRRT_comment',
    state: 'needs_answer',
    stage: 'asking',
    revision: 1,
    activeAttemptId: null,
    disposition: null,
    replyDraft: null,
    question: 'Reject here or in the API?',
    createdMinutesAgo: 5,
  }),
});

describe('usePageSummaries counts comments and notes apart', () => {
  it('counts one waiting comment as need you and one waiting note on the Branch page', () => {
    useAppStore.setState({
      sessionResolveQueueItems: { [SESSION_ID]: [waitingComment(), waitingNote()] },
      sessionResolveAttempts: { [SESSION_ID]: [] },
    });
    const { result } = renderHook(() =>
      usePageSummaries({ session: aSession({ id: SESSION_ID }) }),
    );

    expect(result.current.branch).toBe('1 need you · 1 note');
  });

  it('says nothing about notes when only a comment waits', () => {
    useAppStore.setState({
      sessionResolveQueueItems: { [SESSION_ID]: [waitingComment()] },
      sessionResolveAttempts: { [SESSION_ID]: [] },
    });
    const { result } = renderHook(() =>
      usePageSummaries({ session: aSession({ id: SESSION_ID }) }),
    );

    expect(result.current.branch).toBe('1 need you');
  });
});
