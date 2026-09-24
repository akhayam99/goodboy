import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@goodboy/db';
import type {
  AgentId,
  CheckoutCleanliness,
  CheckoutPreparation,
  ClusterExecutionGraph,
  MountId,
  Project,
  ProjectSetupCommand,
  SessionMountView,
  SessionProjectMount,
} from '@goodboy/types';

const h = vi.hoisted(() => ({
  db: null as unknown as {
    exec: (sql: string) => Promise<void>;
    execute: (sql: string, params?: ReadonlyArray<unknown>) => Promise<{ rowsAffected: number }>;
    select: <T>(sql: string, params?: ReadonlyArray<unknown>) => Promise<ReadonlyArray<T>>;
  },
  cleanliness: vi.fn(),
  prepareCheckout: vi.fn(),
  acquireApplication: vi.fn(),
}));

vi.mock('@goodboy/ui', () => ({ formatError: (error: unknown) => String(error) }));

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: {
    exec: (sql: string) => h.db.exec(sql),
    execute: (sql: string, params?: ReadonlyArray<unknown>) => h.db.execute(sql, params),
    select: <T>(sql: string, params?: ReadonlyArray<unknown>) => h.db.select<T>(sql, params),
  },
}));

vi.mock('../../../features/worktree/worktree', () => ({
  readCheckoutCleanliness: h.cleanliness,
  prepareCheckout: h.prepareCheckout,
}));

vi.mock('../../../features/worktree/writerLease', () => ({
  acquireApplicationWriterLease: h.acquireApplication,
  worktreeWriterResource: ({
    repoRoot,
    worktreePath,
  }: {
    readonly repoRoot: string;
    readonly worktreePath: string;
  }) => `tree:${repoRoot}|${worktreePath}`,
}));

import { getClusterAttempt, recordClusterExecutionGraph } from '@goodboy/db';
import {
  createMountRecoveryDatabase,
  RECOVERY_PROJECT_ID,
  RECOVERY_SESSION_ID,
  RECOVERY_WORKSPACE_ID,
} from '../../../__tests__/helpers/mountRecoveryDatabase';
import { createClusterAttemptsSlice } from './index';
import { attemptTurnTarget } from './attemptTurnTarget';
import { loadClusterAttemptLedgers } from './loadClusterAttemptLedgers';
import { resolveClusterSessionTarget } from './resolveClusterSessionTarget';

const CONTAINER = 'container-1' as AgentId;
const HEAD = 'a'.repeat(40);
const TARGET_MOUNT = 'mount-target' as MountId;
const SETUP: ProjectSetupCommand = {
  kind: 'command',
  command: 'CI=1 pnpm install --frozen-lockfile --ignore-scripts',
  revision: 2,
  updatedAt: '2026-09-23T00:00:00.000Z' as ProjectSetupCommand['updatedAt'],
};

const graphNodes = [
  {
    id: 'impl-a',
    ordinal: 0,
    title: 'Rewrite resolver',
    instructions: 'do it',
    role: 'implementer' as const,
    dependsOn: [],
    expectedOutput: null,
    writeScope: { version: 1, files: ['src/resolver.ts'], directories: [] },
  },
  {
    id: 'impl-b',
    ordinal: 1,
    title: 'Rewrite docs',
    instructions: 'do it',
    role: 'docs' as const,
    dependsOn: [],
    expectedOutput: null,
    writeScope: { version: 1, files: [], directories: ['docs'] },
  },
  {
    id: 'review',
    ordinal: 2,
    title: 'Review',
    instructions: 'audit',
    role: 'reviewer' as const,
    dependsOn: ['impl-a', 'impl-b'],
    expectedOutput: null,
  },
];

const targetMount: SessionProjectMount = {
  mountId: TARGET_MOUNT,
  sessionId: RECOVERY_SESSION_ID,
  projectId: RECOVERY_PROJECT_ID,
  mountName: 'API',
  worktreePath: '/repo/api/.goodboy/worktrees/session',
  lastWorktreePath: null,
  repoRoot: '/repo/api',
  branch: 'ak/session',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 3,
};

type State = Record<string, unknown> & {
  clusterAttempts: Record<string, ReadonlyArray<Record<string, unknown>>>;
  clusterExecutionEligibility: Record<string, ReadonlyArray<Record<string, unknown>>>;
  sessionProjectMounts: Record<string, ReadonlyArray<SessionProjectMount>>;
  sessionActiveMount: Record<string, MountId | null>;
  projects: ReadonlyArray<Project>;
};

let db: Database;
let execution: ClusterExecutionGraph;
let forkCount = 0;

const project = ({ setup }: { readonly setup?: ProjectSetupCommand }): Project => ({
  id: RECOVERY_PROJECT_ID,
  workspaceId: RECOVERY_WORKSPACE_ID,
  name: 'API',
  rootPath: '/repo/api',
  kind: 'repo',
  baseBranch: 'main',
  overrides: {} as Project['overrides'],
  createdAt: SETUP.updatedAt,
  updatedAt: SETUP.updatedAt,
  ...(setup !== undefined && { setup }),
});

const forkMount = vi.fn(
  async (input: { readonly requestId: string; readonly exactBaseSha?: string }) => {
    forkCount += 1;
    const view: SessionMountView = {
      id: `mount-${input.requestId}` as MountId,
      sessionId: RECOVERY_SESSION_ID,
      projectId: RECOVERY_PROJECT_ID,
      worktreePath: `/repo/api/.goodboy/worktrees/${input.requestId.replace(':', '-')}`,
      lastWorktreePath: null,
      branch: `ak/attempt-${forkCount}`,
      baseBranch: 'main',
      parallelIndex: forkCount,
      mountName: 'API',
      repoSlug: null,
      isAttached: true,
      diskState: 'present',
      revision: 0,
      createdAt: SETUP.updatedAt,
      updatedAt: SETUP.updatedAt,
      repoRoot: '/repo/api',
    };
    return view;
  },
);

const makeStore = ({ setup = SETUP }: { readonly setup?: ProjectSetupCommand | null } = {}) => {
  const state: State = {
    sessions: [{ id: RECOVERY_SESSION_ID, workspaceId: RECOVERY_WORKSPACE_ID }],
    projects: [project(setup === null ? {} : { setup })],
    sessionMounts: {},
    sessionProjectMounts: { [RECOVERY_SESSION_ID]: [targetMount] },
    sessionActiveMount: { [RECOVERY_SESSION_ID]: TARGET_MOUNT },
    sessionActiveProject: {},
    clusterExecutionGraphs: { [RECOVERY_SESSION_ID]: [execution] },
    clusterAttempts: {},
    clusterExecutionEligibility: {},
    forkMount,
  };
  const set = vi.fn((updater: Partial<State> | ((current: State) => Partial<State>)) => {
    const patch = typeof updater === 'function' ? updater(state) : updater;
    Object.assign(state, patch);
  });
  const get = () => state;
  Object.assign(state, createClusterAttemptsSlice(set as never, get as never));
  return state as State & ReturnType<typeof createClusterAttemptsSlice>;
};

const preparedCheckout = (): CheckoutPreparation => ({
  outcome: 'succeeded',
  exitCode: 0,
  output: 'Done in 4s',
  baseline: { headSha: HEAD, treeSha: 't'.repeat(40), statusDigest: 'digest' },
  reason: null,
});

beforeEach(async () => {
  vi.clearAllMocks();
  forkCount = 0;
  db = await createMountRecoveryDatabase();
  h.db = db as never;
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('container-1', ?, 0, 'Clusters', 'running')",
    [RECOVERY_SESSION_ID],
  );
  execution = await recordClusterExecutionGraph({
    db,
    snapshot: {
      containerAgentId: CONTAINER,
      sessionId: RECOVERY_SESSION_ID,
      workflowRunId: null,
      planId: null,
      goalTitle: 'Routing rewrite',
      graph: { executionVersion: 2, nodes: graphNodes },
      nodes: graphNodes.map((node) => ({
        nodeId: node.id,
        agentId: null,
        ordinal: node.ordinal,
        role: node.role,
      })),
    },
  });
  h.cleanliness.mockResolvedValue({ kind: 'clean', headSha: HEAD } satisfies CheckoutCleanliness);
  h.prepareCheckout.mockResolvedValue(preparedCheckout());
  let leaseSequence = 0;
  const leases = new Map<string, string>();
  h.acquireApplication.mockImplementation(async ({ holder }: { readonly holder: string }) => {
    const existing = leases.get(holder);
    if (existing !== undefined) {
      return { outcome: 'granted', leaseId: existing, token: `token-${existing}` };
    }
    leaseSequence += 1;
    const leaseId = `lease-${leaseSequence}`;
    leases.set(holder, leaseId);
    return { outcome: 'granted', leaseId, token: `token-${leaseId}` };
  });
});

const prepareA = (store: ReturnType<typeof makeStore>, requestId = 'request-a') =>
  store.prepareClusterAttempt({
    sessionId: RECOVERY_SESSION_ID,
    containerAgentId: CONTAINER,
    nodeId: 'impl-a',
    requestId,
  });

describe('prepareClusterAttempt', () => {
  it('prepares a private mount pinned to the clean local head with durable ownership', async () => {
    const store = makeStore();

    const result = await prepareA(store);

    expect(result.kind).toBe('prepared');
    const attempt = result.attempt!;
    expect(forkMount).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: `cluster-attempt:${attempt.id}`,
        exactBaseSha: HEAD,
        ownedReservations: [],
      }),
    );
    expect(h.acquireApplication).toHaveBeenCalledWith({
      holder: `cluster-attempt:${attempt.id}`,
      resources: [`tree:/repo/api|${attempt.target?.worktreePath}`],
    });
    expect(h.prepareCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        command: SETUP.command,
        expectedHeadSha: HEAD,
        repoRoot: '/repo/api',
      }),
    );
    const stored = await getClusterAttempt({ db, id: attempt.id });
    expect(stored).toMatchObject({
      state: 'prepared',
      baseSha: HEAD,
      graphRevision: 1,
      scopeRevision: 1,
      leaseId: 'lease-1',
      setup: { revision: 2, command: SETUP.command, result: 'succeeded', exitCode: 0 },
      baseline: { headSha: HEAD },
      writeScope: { version: 1, files: ['src/resolver.ts'], directories: [] },
    });
    expect(store.clusterAttempts[RECOVERY_SESSION_ID]).toEqual([stored]);
  });

  it('returns the same prepared attempt for a duplicated request', async () => {
    const store = makeStore();

    const first = await prepareA(store);
    const again = await prepareA(store);

    expect(again.kind).toBe('prepared');
    expect(again.attempt?.id).toBe(first.attempt?.id);
    expect(forkMount).toHaveBeenCalledTimes(1);
    expect(h.prepareCheckout).toHaveBeenCalledTimes(1);
  });

  it('refuses a second live attempt for the same node', async () => {
    const store = makeStore();
    await prepareA(store);

    const second = await prepareA(store, 'request-other');

    expect(second.kind).toBe('busy');
    expect(forkMount).toHaveBeenCalledTimes(1);
  });

  it('resumes after a crash between allocation and ownership without allocating twice', async () => {
    const crashed = makeStore();
    h.acquireApplication.mockRejectedValueOnce(new Error('the app quit'));

    await expect(prepareA(crashed)).rejects.toThrow('the app quit');
    const reloaded = makeStore();
    Object.assign(reloaded, await loadClusterAttemptLedgers({ sessionIds: [RECOVERY_SESSION_ID] }));
    h.cleanliness.mockResolvedValue({ kind: 'clean', headSha: 'b'.repeat(40) });
    const resumed = await prepareA(reloaded);

    expect(resumed.kind).toBe('prepared');
    expect(resumed.attempt?.baseSha).toBe(HEAD);
    expect(forkMount).toHaveBeenCalledTimes(1);
    expect(h.prepareCheckout).toHaveBeenCalledTimes(1);
  });

  it('keeps the whole execution sequential when the target has tracked changes', async () => {
    const store = makeStore();
    h.cleanliness.mockResolvedValue({
      kind: 'dirty',
      headSha: HEAD,
      staged: 0,
      unstaged: 2,
      unmerged: 0,
      untracked: 0,
    });

    const result = await prepareA(store);

    expect(result).toMatchObject({ kind: 'ineligible', attempt: null });
    expect(result.kind === 'ineligible' && result.reason).toContain('2 unstaged');
    expect(forkMount).not.toHaveBeenCalled();
    expect(store.clusterExecutionEligibility[RECOVERY_SESSION_ID]).toEqual([
      expect.objectContaining({ state: 'sequential', containerAgentId: CONTAINER }),
    ]);
  });

  it('keeps the whole execution sequential when the target has untracked files', async () => {
    const store = makeStore();
    h.cleanliness.mockResolvedValue({
      kind: 'dirty',
      headSha: HEAD,
      staged: 0,
      unstaged: 0,
      unmerged: 0,
      untracked: 1,
    });

    const result = await prepareA(store);

    expect(result.kind === 'ineligible' && result.reason).toContain('1 untracked');
    expect(forkMount).not.toHaveBeenCalled();
  });

  it('never treats an unset setup command as success', async () => {
    const store = makeStore({ setup: null });

    const result = await prepareA(store);

    expect(result.kind === 'ineligible' && result.reason).toContain('no setup command');
    expect(forkMount).not.toHaveBeenCalled();
  });

  it('runs an explicit no-op setup without a command', async () => {
    const store = makeStore({
      setup: { kind: 'none', revision: 5, updatedAt: SETUP.updatedAt },
    });

    const result = await prepareA(store);

    expect(result.kind).toBe('prepared');
    expect(h.prepareCheckout).toHaveBeenCalledWith(expect.objectContaining({ command: null }));
    expect(result.attempt?.setup.revision).toBe(5);
  });

  it.each([
    ['failed', 'setup exited with status 1'],
    ['source-changed', 'setup modified tracked files: pnpm-lock.yaml'],
  ] as const)(
    'marks a %s setup ineligible and the execution sequential',
    async (outcome, reason) => {
      const store = makeStore();
      h.prepareCheckout.mockResolvedValue({
        outcome,
        exitCode: outcome === 'failed' ? 1 : 0,
        output: 'ERR_PNPM_OUTDATED_LOCKFILE',
        baseline: null,
        reason,
      } satisfies CheckoutPreparation);

      const result = await prepareA(store);

      expect(result).toMatchObject({ kind: 'ineligible', reason });
      expect(result.attempt).toMatchObject({
        state: 'ineligible',
        reason,
        setup: { result: outcome, output: 'ERR_PNPM_OUTDATED_LOCKFILE' },
      });
      expect(store.clusterExecutionEligibility[RECOVERY_SESSION_ID]).toEqual([
        expect.objectContaining({ state: 'sequential', reason }),
      ]);
    },
  );

  it('presents the owned reservations of sibling attempts when allocating another mount', async () => {
    const store = makeStore();
    const first = await prepareA(store);

    await store.prepareClusterAttempt({
      sessionId: RECOVERY_SESSION_ID,
      containerAgentId: CONTAINER,
      nodeId: 'impl-b',
      requestId: 'request-b',
    });

    expect(forkMount).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ownedReservations: [
          { leaseId: first.attempt?.leaseId, token: `token-${first.attempt?.leaseId}` },
        ],
      }),
    );
  });

  it('refuses a node that declares no write scope', async () => {
    const store = makeStore();

    const result = await store.prepareClusterAttempt({
      sessionId: RECOVERY_SESSION_ID,
      containerAgentId: CONTAINER,
      nodeId: 'review',
      requestId: 'request-review',
    });

    expect(result).toMatchObject({ kind: 'ineligible', attempt: null });
    expect(h.cleanliness).not.toHaveBeenCalled();
  });

  it('keeps the persisted target when the selected mount changes in the interface', async () => {
    const store = makeStore();
    const prepared = await prepareA(store);
    const attempt = prepared.attempt!;
    const pinned = attemptTurnTarget({ attempt });

    store.sessionProjectMounts = {
      [RECOVERY_SESSION_ID]: [
        targetMount,
        {
          ...targetMount,
          mountId: attempt.target!.mountId,
          worktreePath: attempt.target!.worktreePath,
          parallelIndex: 1,
          revision: 9,
        },
      ],
    };
    store.sessionActiveMount = { [RECOVERY_SESSION_ID]: attempt.target!.mountId };

    expect(attemptTurnTarget({ attempt })).toEqual(pinned);
    expect(pinned).toEqual({
      mountId: attempt.target!.mountId,
      mountRevision: 0,
      worktreePath: attempt.target!.worktreePath,
    });
    expect(
      resolveClusterSessionTarget({ state: store as never, sessionId: RECOVERY_SESSION_ID })?.mount
        .mountId,
    ).toBe(TARGET_MOUNT);
    const replayed = await prepareA(store);
    expect(replayed.attempt?.target).toEqual(attempt.target);
    expect(forkMount).toHaveBeenCalledTimes(1);
  });
});
