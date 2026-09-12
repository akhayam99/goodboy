import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  MountId,
  ProviderRunId,
  ResolveAttempt,
  SessionId,
} from '@goodboy/types';
import type { GetFn, SetFn } from './types';

const hoisted = vi.hoisted(() => ({
  cancelTurn: vi.fn(async () => undefined),
  invokeAgentUpdateStatus: vi.fn(async () => undefined),
  invokeAgentList: vi.fn(async () => [] as ReadonlyArray<Agent>),
  updateSessionState: vi.fn(async () => undefined),
  listResolveAttempts: vi.fn(async () => [] as ReadonlyArray<ResolveAttempt>),
  abandonWorktreeWriter: vi.fn(async ({ path }: { readonly path: string }) => ({
    path,
    holder: null,
    token: null,
    runId: null,
    isGranted: false,
    hasExited: false,
    waiting: [],
  })),
}));

vi.mock('../../../features/chat/turn', () => ({ cancelTurn: hoisted.cancelTurn }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentUpdateStatus: hoisted.invokeAgentUpdateStatus,
  invokeAgentList: hoisted.invokeAgentList,
}));
vi.mock('@goodboy/db', () => ({
  updateSessionState: hoisted.updateSessionState,
  listResolveAttempts: hoisted.listResolveAttempts,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/worktree', () => ({
  abandonWorktreeWriter: hoisted.abandonWorktreeWriter,
}));

import { forceCloseResolver } from './forceCloseResolver';

const SID = 'sess-1' as SessionId;
const STUCK = 'resolver-1' as AgentId;
const NEXT = 'resolver-2' as AgentId;
const RUN = 'run-1' as ProviderRunId;
const MOUNT_TWO = 'mount-two' as MountId;
const MOUNT_THREE = 'mount-three' as MountId;
const PATH_TWO = '/repo/two';
const PATH_THREE = '/repo/three';

const heldAttempt = {
  id: 'attempt-1',
  sessionId: SID,
  agentId: STUCK,
  prNumber: 12,
  threadIds: ['PRRT_1'],
  provider: 'anthropic',
  model: 'claude-opus-5',
  effort: null,
  instructions: 'fix one',
  phase: 'running',
  mountTarget: { mountId: MOUNT_TWO, mountRevision: 2, worktreePath: PATH_TWO },
  startedAt: 1,
  endedAt: null,
  error: null,
  createdAt: 1,
} satisfies ResolveAttempt;

const mountRow = ({ mountId, worktreePath }: { mountId: MountId; worktreePath: string }) => ({
  mountId,
  sessionId: SID,
  projectId: 'project-1',
  mountName: 'repo',
  worktreePath,
  lastWorktreePath: null,
  repoRoot: '/repo',
  branch: 'ak/one',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 2,
});

const resolver = (over: Partial<Agent> & { id: AgentId }): Agent => ({
  sessionId: SID,
  ordinal: 0,
  name: 'resolve: reviewer on a.ts:1',
  status: 'pending',
  kind: 'resolver',
  ...over,
});

const makeStore = () => {
  const sendTurn = vi.fn(async () => undefined);
  const selectAgent = vi.fn(async () => undefined);
  const state: Record<string, unknown> = {
    recordResolvePhase: vi.fn(async () => undefined),
    sessionPhaseRuns: {
      [SID]: [
        resolver({ id: STUCK, status: 'running', ordinal: 0 }),
        resolver({ id: NEXT, status: 'pending', ordinal: 1 }),
      ],
    },
    agentTurnState: {
      [STUCK]: { kind: 'running', runId: RUN, startedAt: '2026-07-25T09:00:00.000Z' },
    },
    agentKindOverride: {},
    drainResolveQueue: vi.fn(async () => undefined),
    sessionProjectMounts: {
      [SID]: [
        mountRow({ mountId: MOUNT_TWO, worktreePath: PATH_TWO }),
        mountRow({ mountId: MOUNT_THREE, worktreePath: PATH_THREE }),
      ],
    },
    sessionActiveMount: { [SID]: MOUNT_THREE },
    sessionActiveProject: { [SID]: 'project-1' },
    sessions: [
      {
        id: SID,
        activeProjectId: 'project-1',
        state: { kind: 'idle', lastActivityAt: '2026-07-25T09:00:00.000Z' },
      },
    ],
    sendTurn,
    selectAgent,
  };
  const get = (() => state) as unknown as GetFn;
  const set = ((u: unknown) => {
    const patch =
      typeof u === 'function'
        ? (u as (s: Record<string, unknown>) => Record<string, unknown>)(state)
        : (u as Record<string, unknown>);
    Object.assign(state, patch);
  }) as unknown as SetFn;
  return { state, get, set, sendTurn, selectAgent };
};

afterEach(() => vi.clearAllMocks());

describe('forceCloseResolver', () => {
  it('cancels the live run of the stuck resolver', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([
      resolver({ id: STUCK, status: 'skipped', ordinal: 0 }),
      resolver({ id: NEXT, status: 'pending', ordinal: 1 }),
    ]);

    await forceCloseResolver(set, get)(SID, STUCK);

    expect(hoisted.cancelTurn).toHaveBeenCalledWith(RUN);
    expect(hoisted.invokeAgentUpdateStatus).toHaveBeenCalledWith(
      STUCK,
      expect.objectContaining({ status: 'skipped' }),
    );
  });

  it('leaves the stopped resolver turn idle', async () => {
    const { state, get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([
      resolver({ id: STUCK, status: 'skipped', ordinal: 0 }),
    ]);

    await forceCloseResolver(set, get)(SID, STUCK);

    expect((state.agentTurnState as Record<string, { kind: string }>)[STUCK]?.kind).toBe('idle');
  });

  it('frees the lease of the mount the resolver held, not the selected one', async () => {
    const { state, get, set } = makeStore();
    hoisted.listResolveAttempts.mockResolvedValue([heldAttempt]);
    hoisted.invokeAgentList.mockResolvedValue([
      resolver({ id: STUCK, status: 'skipped', ordinal: 0 }),
      resolver({ id: NEXT, status: 'pending', ordinal: 1 }),
    ]);

    await forceCloseResolver(set, get)(SID, STUCK);

    expect(hoisted.abandonWorktreeWriter).toHaveBeenCalledWith({
      path: PATH_TWO,
      holder: STUCK,
    });
    expect(state.drainResolveQueue).toHaveBeenCalledWith({ sessionId: SID });
  });

  it('frees every worktree the resolver still holds', async () => {
    const { get, set } = makeStore();
    hoisted.listResolveAttempts.mockResolvedValue([
      heldAttempt,
      {
        ...heldAttempt,
        id: 'attempt-2',
        phase: 'queued',
        createdAt: 2,
        mountTarget: { mountId: MOUNT_THREE, mountRevision: 2, worktreePath: PATH_THREE },
      },
    ]);
    hoisted.invokeAgentList.mockResolvedValue([
      resolver({ id: STUCK, status: 'skipped', ordinal: 0 }),
    ]);

    await forceCloseResolver(set, get)(SID, STUCK);

    expect(hoisted.abandonWorktreeWriter.mock.calls.map(([args]) => args.path).sort()).toEqual([
      PATH_THREE,
      PATH_TWO,
    ]);
  });

  it('frees nothing when the resolver never named a worktree', async () => {
    const { get, set } = makeStore();
    hoisted.listResolveAttempts.mockResolvedValue([]);
    hoisted.invokeAgentList.mockResolvedValue([
      resolver({ id: STUCK, status: 'skipped', ordinal: 0 }),
    ]);

    await forceCloseResolver(set, get)(SID, STUCK);

    expect(hoisted.abandonWorktreeWriter).not.toHaveBeenCalled();
  });
});
