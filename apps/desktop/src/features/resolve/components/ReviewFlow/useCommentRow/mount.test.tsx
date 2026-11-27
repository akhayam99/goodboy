// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

const startBatch = vi.hoisted(() => vi.fn(async () => ({ count: 1 })));
vi.mock('../../../startBatch', () => ({ startBatch }));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { brandId, type MountId, type PrComment, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import {
  ledgerCore,
  mountGithubOf,
  mountOf,
  sessionOf,
} from '../../../../workspace/testing/sessionColumn';
import { buildItem, buildThread } from '../../../../../app/components/MockScene/scenes/resolveSeed';
import { buildResolveQueueRows } from '../../../buildResolveQueueRows';
import { useReviewCommentController } from '../../../hooks/useReviewCommentController';
import type { ReviewEntry } from '../useReviewEntries';
import { useCommentRow } from '.';

const SESSION = sessionOf({ goal: 'Ledger export' });
const SESSION_ID = brandId<SessionId>({ value: SESSION.id });
const THREAD_ID = 'PRRT_other_branch';
const PR = 20;

const mountNamed = ({ name }: { readonly name: string }) => ({
  ...mountOf({ session: SESSION, project: ledgerCore }),
  mountId: brandId<MountId>({ value: `mount-${name}` }),
  worktreePath: `/work/ledger-core-${name}`,
  branch: `hl/${name}`,
});

const CURRENT = mountNamed({ name: 'current' });
const OTHER = mountNamed({ name: 'other' });

const COMMENT: PrComment = {
  id: 'c-1',
  author: 'Maya Ortiz',
  authorAvatarUrl: null,
  body: 'Cap the retries at three.',
  createdAt: '2026-10-10T09:00:00.000Z',
  url: '',
  source: 'review',
  path: 'src/webhooks.ts',
  line: 42,
  threadId: THREAD_ID,
};

const entryOf = (): ReviewEntry => {
  const thread = {
    ...buildThread({
      threadId: THREAD_ID,
      state: 'open',
      stage: 'new',
      revision: 1,
      activeAttemptId: null,
      disposition: null,
      replyDraft: null,
      question: null,
      createdMinutesAgo: 10,
    }),
    prNumber: PR,
    projectId: ledgerCore.id,
    sessionId: SESSION_ID,
  };
  const item = buildItem({
    id: 'item-1',
    threadId: THREAD_ID,
    approvalState: 'none',
    approvedRevision: null,
    deferredAt: null,
    deliveredAt: null,
    candidateRevision: 1,
    createdMinutesAgo: 10,
  });
  const [row] = buildResolveQueueRows({
    entries: [{ item, thread }],
    attempts: [],
    deliveryReceipts: [],
    comments: [COMMENT],
  });
  if (row === undefined) {
    throw new Error('the seed built no row');
  }
  return {
    row,
    threadId: THREAD_ID,
    state: 'new',
    toneKey: 'new',
    resolveWord: 'open',
    isQueued: false,
    word: 'Open',
    chips: [],
    change: null,
    newReplies: [],
    remote: null,
    facts: null,
    view: null,
    isChecking: false,
    checkError: null,
    checkAgentId: null,
    lane: 'fix',
    isFixable: true,
    isAcceptable: false,
    fix: null,
    run: null,
  };
};

let store: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  startBatch.mockClear();
  const github = mountGithubOf({ mount: OTHER, number: PR });
  store.setState({
    sessions: [SESSION],
    projects: [ledgerCore],
    sessionProjectMounts: { [SESSION_ID]: [CURRENT, OTHER] },
    sessionActiveMount: { [SESSION_ID]: CURRENT.mountId },
    diffMountPath: { [SESSION_ID]: CURRENT.worktreePath },
    mountGithub: {
      [OTHER.mountId]: { ...github, prs: github.pr === null ? [] : [github.pr] },
    },
    sessionResolveThreads: { [SESSION_ID]: [entryOf().row.thread] },
  });
});

describe('a fix started from a comment on another branch', () => {
  it('names the branch of the comment from the row Fix action', async () => {
    const { result } = renderHook(() => useCommentRow({ sessionId: SESSION_ID, entry: entryOf() }));

    await act(async () => result.current.fix());

    await vi.waitFor(() => expect(startBatch).toHaveBeenCalled());
    expect(startBatch).toHaveBeenCalledWith(
      expect.objectContaining({ threadIds: [THREAD_ID], mountId: OTHER.mountId }),
    );
  });

  it('names the branch of the comment when the controller starts it over', async () => {
    const { result } = renderHook(() =>
      useReviewCommentController({ sessionId: SESSION_ID, entries: [entryOf()] }),
    );

    await act(async () => result.current.startOver(THREAD_ID));

    expect(startBatch).toHaveBeenCalledWith(
      expect.objectContaining({ threadIds: [THREAD_ID], mountId: OTHER.mountId }),
    );
  });
});
