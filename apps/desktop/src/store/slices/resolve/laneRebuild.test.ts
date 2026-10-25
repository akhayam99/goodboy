import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type ProjectId } from '@goodboy/types';
import { aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storyResolveQueries,
  type StoryStore,
} from '../../storyHarness';
import { syncSourceThreads } from '../review-source/syncSourceThreads';
import { createResolveThread } from './createResolveThread';
import { newQueueItem } from './newQueueItem';

const startResolve = vi.hoisted(() => vi.fn());

vi.mock('../../../features/resolve/startResolve', () => ({ startResolve }));
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    setResolveThreadSourceSnapshot: vi.fn(async () => true),
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/onboarding/onboardingSettings', async () =>
  (await import('../../storyHarness')).onboardingStoreModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../shared/lib/editor', async () =>
  (await import('../../storyHarness')).editorModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);
vi.mock('../../../features/integrations/linear/client', async () =>
  (await import('../../storyHarness')).linearClientModuleMock(),
);
vi.mock('../../../features/integrations/github/github', async () =>
  (await import('../../storyHarness')).githubModuleMock(),
);
vi.mock('@goodboy/core', async (importOriginal) =>
  (await import('../../storyHarness')).coreModuleMock(importOriginal),
);
vi.mock('../../../features/scripts/scripts', async () =>
  (await import('../../storyHarness')).scriptsModuleMock(),
);
vi.mock('../../../features/terminal/terminal', async () =>
  (await import('../../storyHarness')).terminalModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

let store: StoryStore;

const SESSION = aSession({
  workspaceId: aWorkspace({ name: 'Harborline', slug: 'harborline' }).id,
});
const PR_NUMBER = 7;
const LEDGER_MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const NOTIFY_MOUNT = brandId<MountId>({ value: 'mount-notify-relay' });
const LEDGER_TARGET = {
  mountId: LEDGER_MOUNT,
  mountRevision: 1,
  worktreePath: '/repo/ledger-core',
};
const queueItems = storyResolveQueries.listResolveQueueItems;
const candidatesRead = storyResolveQueries.listResolveCandidates;

type Items = Awaited<ReturnType<typeof queueItems>>;
type Candidates = Awaited<ReturnType<typeof candidatesRead>>;

type CommentParams = { readonly body: string };

const fetchedComment = ({ body }: CommentParams) => ({
  id: 'c-T2',
  author: 'kenji-w',
  authorAvatarUrl: null,
  body,
  createdAt: TEST_NOW,
  url: '',
  source: 'review' as const,
  threadId: 'T2',
  resolved: false,
});

type CandidateParams = { readonly id: string; readonly revision: number };

const readyCandidate = ({ id, revision }: CandidateParams): Candidates[number] => ({
  id,
  sessionId: SESSION.id,
  revision,
  baseSha: 'root',
  candidateSha: `sha-${id}`,
  worktreePath: '/repo/ledger-core',
  mountTarget: LEDGER_TARGET,
  state: 'ready',
  integratedSha: null,
  createdAt: revision,
  updatedAt: revision,
});

const LANE_THREAD = createResolveThread({
  sessionId: SESSION.id,
  threadId: 'T2',
  prNumber: PR_NUMBER,
  sourceKind: 'github',
});

type World = { readonly states: Map<string, Candidates[number]['state']> };

const worldOf = (): World => {
  const states = new Map<string, Candidates[number]['state']>([
    ['one', 'ready'],
    ['beside', 'ready'],
  ]);
  const revisions = new Map([
    ['one', 1],
    ['beside', 2],
  ]);
  const items: Items = [
    {
      item: {
        ...newQueueItem({ sessionId: SESSION.id, threadId: 'T2', candidateRevision: 0 }),
        id: 'item-T2',
      },
      thread: LANE_THREAD,
    },
  ];
  candidatesRead.mockImplementation(async () =>
    [...states.entries()].map(([id, state]) => ({
      ...readyCandidate({ id, revision: revisions.get(id) ?? 0 }),
      state,
    })),
  );
  storyResolveQueries.listResolveCandidateItems.mockImplementation(async () => [
    { candidateId: 'beside', queueItemId: 'item-T2', itemRevision: 0 },
  ]);
  queueItems.mockImplementation(async () => items);
  storyResolveQueries.setResolveCandidateState.mockImplementation(
    async ({ candidateId, state }) => {
      states.set(candidateId, state);
      return true;
    },
  );
  return { states };
};

type SyncParams = {
  readonly comments: ReadonlyArray<ReturnType<typeof fetchedComment>>;
  readonly mountId?: MountId;
};

const sync = ({ comments, mountId = LEDGER_MOUNT }: SyncParams): Promise<void> =>
  syncSourceThreads({
    get: store.getState,
    sessionId: SESSION.id,
    mountId,
    kind: 'github',
    prNumber: PR_NUMBER,
    projectId: null,
    comments,
    isCurrent: () => true,
  });

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  startResolve.mockReset();
  startResolve.mockImplementation(async () => ({ launchId: 'launch-1', agentId: 'agent-1' }));
  storyResolveQueries.listResolveThreads.mockReset();
  storyResolveQueries.listResolveThreads.mockImplementation(async () => []);
  queueItems.mockReset();
  queueItems.mockImplementation(async () => []);
  candidatesRead.mockReset();
  candidatesRead.mockImplementation(async () => []);
  storyResolveQueries.listResolveAttempts.mockReset();
  storyResolveQueries.listResolveAttempts.mockImplementation(async () => []);
  storyResolveQueries.setResolveCandidateState.mockClear();
  store.setState({
    githubStatus: { mode: 'gh-cli', available: true, user: 'nadia' },
    sessionResolveQueueItems: {},
    sessionResolveThreads: {},
    sessionResolveCandidates: {},
    sessionResolveSourceSnapshots: {},
  });
});

const bodiesOfLastStart = (): ReadonlyArray<string> => {
  const params = startResolve.mock.calls.at(-1)?.[0];
  return (params?.threads ?? []).map(
    (thread: { readonly head: { readonly body: string } }) => thread.head.body,
  );
};

describe('a lane rebuild reads the comments the refresh fetched', () => {
  it('rebuilds a comment with the body the refresh just fetched, with an empty cache', async () => {
    worldOf();

    await sync({ comments: [fetchedComment({ body: 'Rename the helper to settle' })] });

    expect(startResolve).toHaveBeenCalledTimes(1);
    expect(bodiesOfLastStart()).toEqual(['Rename the helper to settle']);
  });

  it('keeps a candidate recoverable when the rebuild finds no comment, and rebuilds it on the next sync', async () => {
    const world = worldOf();

    await sync({ comments: [] });

    expect(startResolve).not.toHaveBeenCalled();
    expect(world.states.get('beside')).toBe('ready');

    await sync({ comments: [fetchedComment({ body: 'Rename the helper to settle' })] });

    expect(startResolve).toHaveBeenCalledTimes(1);
    expect(bodiesOfLastStart()).toEqual(['Rename the helper to settle']);
    expect(world.states.get('beside')).toBe('discarded');
  });

  it('does not launch a candidate of another mount when that mount refreshes', async () => {
    const world = worldOf();

    await sync({
      comments: [fetchedComment({ body: 'Rename the helper to settle' })],
      mountId: NOTIFY_MOUNT,
    });

    expect(startResolve).not.toHaveBeenCalled();
    expect(world.states.get('beside')).toBe('ready');
  });

  it('spawns the rebuild on the candidate mount, not the active one', async () => {
    worldOf();

    await sync({ comments: [fetchedComment({ body: 'Rename the helper to settle' })] });

    expect(startResolve).toHaveBeenCalledWith(expect.objectContaining({ mountId: LEDGER_MOUNT }));
  });
});

describe('a failed lane rebuild is terminal until the user retries', () => {
  it('stops after one failed rebuild, shows it, and does not launch again on the next sync', async () => {
    const world = worldOf();
    startResolve.mockRejectedValue(new Error('spawn failed'));
    const comments = [fetchedComment({ body: 'Rename the helper to settle' })];

    await sync({ comments });
    await sync({ comments });
    await sync({ comments });

    expect(startResolve).toHaveBeenCalledTimes(1);
    expect(world.states.get('beside')).toBe('discarded');
    expect(store.getState().sessionLaneRebuildFailures[SESSION.id]).toEqual([
      expect.objectContaining({ candidateIds: ['beside'], message: 'spawn failed' }),
    ]);
  });

  it('puts the candidates back to ready on an explicit retry and rebuilds them once', async () => {
    const world = worldOf();
    startResolve.mockRejectedValueOnce(new Error('spawn failed'));
    const comments = [fetchedComment({ body: 'Rename the helper to settle' })];
    await sync({ comments });

    await store.getState().retryLaneRebuild({
      sessionId: SESSION.id,
      worktreePath: '/repo/ledger-core',
      mountId: LEDGER_MOUNT,
      comments,
    });

    expect(startResolve).toHaveBeenCalledTimes(2);
    expect(world.states.get('beside')).toBe('discarded');
    expect(store.getState().sessionLaneRebuildFailures[SESSION.id] ?? []).toEqual([]);
  });

  it('retries a missing comment once per fresh fetch and not on a reconcile without a source', async () => {
    const world = worldOf();

    await sync({ comments: [] });
    await sync({ comments: [] });
    await store.getState().reconcileResolveLane({ sessionId: SESSION.id });

    expect(startResolve).not.toHaveBeenCalled();
    expect(world.states.get('beside')).toBe('ready');
    expect(store.getState().sessionLaneRebuildFailures[SESSION.id] ?? []).toEqual([]);
  });
});

type LedgerMountParams = { readonly revision: number };

const ledgerMount = ({ revision }: LedgerMountParams) => ({
  mountId: LEDGER_MOUNT,
  sessionId: SESSION.id,
  projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
  mountName: 'ledger-core',
  worktreePath: '/repo/ledger-core',
  lastWorktreePath: null,
  repoRoot: '/repo/ledger-core',
  branch: 'feature/settle',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present' as const,
  revision,
});

type ThreadOfParams = { readonly threadId: string; readonly prNumber: number };

describe('a lane rebuild touches only the candidates of the refreshed pull request', () => {
  it('keeps the broken candidate of another pull request on the same mount recoverable', async () => {
    const states = new Map<string, Candidates[number]['state']>([
      ['chain', 'ready'],
      ['pr7', 'ready'],
      ['pr8', 'ready'],
    ]);
    const revisions = new Map([
      ['chain', 1],
      ['pr7', 2],
      ['pr8', 3],
    ]);
    const memberOf = new Map([
      ['pr7', 'item-T7'],
      ['pr8', 'item-T8'],
    ]);
    const threadOf = ({ threadId, prNumber }: ThreadOfParams) =>
      createResolveThread({
        sessionId: SESSION.id,
        threadId,
        prNumber,
        sourceKind: 'github',
      });
    const items: Items = [
      {
        item: {
          ...newQueueItem({ sessionId: SESSION.id, threadId: 'T7', candidateRevision: 0 }),
          id: 'item-T7',
        },
        thread: threadOf({ threadId: 'T7', prNumber: 7 }),
      },
      {
        item: {
          ...newQueueItem({ sessionId: SESSION.id, threadId: 'T8', candidateRevision: 0 }),
          id: 'item-T8',
        },
        thread: threadOf({ threadId: 'T8', prNumber: 8 }),
      },
    ];
    candidatesRead.mockImplementation(async () =>
      [...states.entries()].map(([id, state]) => ({
        ...readyCandidate({ id, revision: revisions.get(id) ?? 0 }),
        state,
      })),
    );
    storyResolveQueries.listResolveCandidateItems.mockImplementation(async ({ candidateId }) => {
      const queueItemId = memberOf.get(candidateId);
      return queueItemId === undefined ? [] : [{ candidateId, queueItemId, itemRevision: 0 }];
    });
    queueItems.mockImplementation(async () => items);
    storyResolveQueries.setResolveCandidateState.mockImplementation(
      async ({ candidateId, state }) => {
        states.set(candidateId, state);
        return true;
      },
    );

    await syncSourceThreads({
      get: store.getState,
      sessionId: SESSION.id,
      mountId: LEDGER_MOUNT,
      kind: 'github',
      prNumber: 8,
      projectId: null,
      comments: [{ ...fetchedComment({ body: 'Rename the helper to settle' }), threadId: 'T8' }],
      isCurrent: () => true,
    });

    expect(startResolve).toHaveBeenCalledTimes(1);
    expect(states.get('pr8')).toBe('discarded');
    expect(states.get('pr7')).toBe('ready');
  });
});

describe('a lane rebuild refuses a mount that changed branch meanwhile', () => {
  it('hands the mount revision of the decision to the spawn', async () => {
    worldOf();
    store.setState({
      sessions: [SESSION],
      sessionProjectMounts: { [SESSION.id]: [ledgerMount({ revision: 4 })] },
    });

    await sync({ comments: [fetchedComment({ body: 'Rename the helper to settle' })] });

    expect(startResolve).toHaveBeenCalledWith(
      expect.objectContaining({ expectedMountRevision: 4 }),
    );
  });

  it('starts no agent when the branch switches during batch creation and leaves the candidate ready', async () => {
    const world = worldOf();
    store.setState({
      sessions: [SESSION],
      sessionProjectMounts: { [SESSION.id]: [ledgerMount({ revision: 1 })] },
    });
    const refusals: Array<unknown> = [];
    startResolve.mockImplementation(async (params) => {
      store.setState({
        sessionProjectMounts: { [SESSION.id]: [ledgerMount({ revision: 2 })] },
      });
      try {
        return await params.spawnAgent(SESSION.id, {
          name: 'Resolve',
          mountId: params.mountId,
          expectedMountRevision: params.expectedMountRevision,
          initialPrompt: 'x',
          kindOverride: 'resolver',
        });
      } catch (error) {
        refusals.push(error);
        throw error;
      }
    });

    await sync({ comments: [fetchedComment({ body: 'Rename the helper to settle' })] });

    expect(refusals).toEqual([expect.objectContaining({ name: 'StaleMountError' })]);
    expect(Object.keys(store.getState().transcripts)).toEqual([]);
    expect(world.states.get('beside')).toBe('ready');
    expect(store.getState().sessionLaneRebuildFailures[SESSION.id] ?? []).toEqual([]);
  });
});
