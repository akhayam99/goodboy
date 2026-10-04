// @vitest-environment happy-dom

const { listBranchCommits } = vi.hoisted(() => ({
  listBranchCommits: vi.fn<(path: string) => Promise<ReadonlyArray<BranchCommit>>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../../worktree/worktree', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../worktree/worktree')>()),
  listBranchCommits,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  BranchCommit,
  MountId,
  ProjectId,
  ResolveAttempt,
  ResolveSourceSnapshot,
  SessionProjectMount,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { resolverBriefOf } from '../../../resolve/hooks/useResolverBrief';
import { AgentBriefResolver } from './AgentBriefResolver';

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

const RESOLVER = 'agent-brief-entries' as AgentId;
const SHA = 'c81e5aaaaaa';
const MOUNT: SessionProjectMount = {
  mountId: 'mount-brief-entries' as MountId,
  sessionId: SESSION.id,
  projectId: 'project-brief-entries' as ProjectId,
  mountName: 'payments-api',
  worktreePath: '/repo/payments-api',
  lastWorktreePath: null,
  repoRoot: '/repo/payments-api',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};
const ATTEMPT: ResolveAttempt = {
  id: 'a-entries',
  sessionId: SESSION.id,
  agentId: RESOLVER,
  prNumber: 318,
  threadIds: [EXPANDED_THREAD_ID],
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase: 'finished',
  mountTarget: null,
  startedAt: 1,
  endedAt: 2,
  error: null,
  createdAt: 1,
  batchId: null,
  copyPath: null,
  launchChoice: null,
};
const SNAPSHOT: ResolveSourceSnapshot = {
  body: 'Cap the retry backoff at 30 seconds, it grows without a bound.',
  author: 'maya',
  fingerprint: 'fp-1',
  seenAt: 1_700_000_000_000,
  replyIds: [],
  changed: null,
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  listBranchCommits.mockReset();
  listBranchCommits.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  restore = {};
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const agent: Agent = {
  id: RESOLVER,
  sessionId: SESSION.id,
  ordinal: 1,
  name: 'resolve: comment',
  kind: 'resolver',
  status: 'completed',
};

const reshape = ({
  stage,
  commitShas,
  deliveredAt = null,
  prNumber = 318,
}: {
  readonly stage: 'approved' | 'resolved' | 'proposed';
  readonly commitShas: ReadonlyArray<string> | null;
  readonly deliveredAt?: number | null;
  readonly prNumber?: number;
}): void => {
  const items = useAppStore.getState().sessionResolveQueueItems[SESSION.id] ?? [];
  useAppStore.setState({
    sessionResolveQueueItems: {
      [SESSION.id]: items.map((entry) =>
        entry.thread.threadId === EXPANDED_THREAD_ID
          ? {
              item: {
                ...entry.item,
                approvalState: stage === 'proposed' ? 'none' : 'accepted',
                approvedRevision: stage === 'proposed' ? null : 1,
                deliveredAt,
              },
              thread: { ...entry.thread, stage, commitShas, prNumber },
            }
          : entry,
      ),
    },
  });
};

const mount = async ({
  prepare,
}: {
  readonly prepare?: () => void;
} = {}): Promise<void> => {
  seedResolveScene({ expandedThreadId: null });
  useAppStore.setState({
    sessionResolveAttempts: { [SESSION.id]: [ATTEMPT] },
    sessionProjectMounts: { [SESSION.id]: [MOUNT] },
  });
  prepare?.();
  const brief = resolverBriefOf({ attempts: [ATTEMPT], agentId: RESOLVER });
  if (brief === null) {
    throw new Error('no brief');
  }
  render(
    <ToastProvider>
      <AgentBriefResolver session={SESSION} agent={agent} brief={brief} />
    </ToastProvider>,
  );
  await settle();
};

describe('the resolver Brief never reads blank', () => {
  it('shows the comment, state and commit of a thread that is not on the selected source', async () => {
    listBranchCommits.mockResolvedValue([
      {
        sha: SHA,
        shortSha: 'c81e5aa',
        subject: 'Cap the retry backoff',
        author: 'resolver',
        timestamp: 1,
        pushed: false,
        parentSha: null,
      },
    ]);
    const openReviewTarget = vi.fn<StoreState['openReviewTarget']>(async () => ({
      kind: 'opened' as const,
    }));
    useAppStore.setState({ openReviewTarget });
    restore = { openReviewTarget: useAppStore.getState().openReviewTarget };

    await mount({
      prepare: () => {
        reshape({ stage: 'approved', commitShas: [SHA], prNumber: 777 });
        useAppStore.setState({
          sessionGithub: {},
          sessionResolveSourceSnapshots: { [SESSION.id]: { [EXPANDED_THREAD_ID]: SNAPSHOT } },
        });
      },
    });

    expect(screen.getByText(/Cap the retry backoff at 30 seconds/)).toBeDefined();
    expect(screen.getByText('maya')).toBeDefined();
    expect(screen.getByText('Ready to push')).toBeDefined();
    expect(await screen.findByText('Cap the retry backoff')).toBeDefined();
    expect(screen.getByText('c81e5aa')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Push now/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open in Review' }));
    await waitFor(() => expect(openReviewTarget).toHaveBeenCalledOnce());
  });

  it('says so in one line when the thread is gone and still offers Open in Review', async () => {
    await mount({
      prepare: () => {
        const items = useAppStore.getState().sessionResolveQueueItems[SESSION.id] ?? [];
        const own = items.find((entry) => entry.thread.threadId === EXPANDED_THREAD_ID);
        if (own === undefined) {
          throw new Error('no seeded thread');
        }
        useAppStore.setState({
          sessionResolveQueueItems: { [SESSION.id]: [] },
          sessionResolveThreads: { [SESSION.id]: [{ ...own.thread, commitShas: [SHA] }] },
        });
      },
    });

    expect(screen.getByText('This comment is no longer in Review.')).toBeDefined();
    expect(screen.getByText('c81e5aa')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open in Review' })).toBeDefined();
  });

  it('shows a loading line, not nothing, while the resolve session loads', async () => {
    await mount({
      prepare: () => {
        const { [SESSION.id]: _dropped, ...rest } = useAppStore.getState().sessionResolveQueueItems;
        useAppStore.setState({ sessionResolveQueueItems: rest });
      },
    });

    expect(screen.getByRole('status').textContent).toBe('Loading the comment');
  });

  it('reads a pushed comment as Pushed with its commit and a way to Review', async () => {
    await mount({
      prepare: () => reshape({ stage: 'resolved', commitShas: [SHA], deliveredAt: 5 }),
    });

    expect(screen.getByText('Pushed')).toBeDefined();
    expect(screen.getByText('c81e5aa')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open in Review' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Push now/ })).toBeNull();
  });

  it('offers Push now for a fix that waits for the push', async () => {
    await mount({
      prepare: () => reshape({ stage: 'approved', commitShas: [SHA] }),
    });

    expect(screen.getByText('Ready to push')).toBeDefined();
    expect(screen.getByRole('button', { name: /Push now/ })).toBeDefined();
  });
});
