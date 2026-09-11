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
  deleteAttachment: vi.fn(async () => undefined),
  invokeAgentList: vi.fn(async () => [] as ReadonlyArray<Agent>),
  updateSessionState: vi.fn(async () => undefined),
  listResolveAttempts: vi.fn(async () => [] as ReadonlyArray<ResolveAttempt>),
  abandonWorktreeWriter: vi.fn(async ({ path }: { path: string }) => ({
    path,
    holder: null,
    token: null,
    runId: null,
    isGranted: false,
    hasExited: false,
    waiting: [],
  })),
  execute: vi.fn(async () => undefined),
}));

vi.mock('../../../features/chat/turn', () => ({
  cancelTurn: hoisted.cancelTurn,
  deleteAttachment: hoisted.deleteAttachment,
}));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: hoisted.invokeAgentList,
}));
vi.mock('@goodboy/db', () => ({
  updateSessionState: hoisted.updateSessionState,
  listResolveAttempts: hoisted.listResolveAttempts,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: { execute: hoisted.execute } }));
vi.mock('../../../features/worktree/worktree', () => ({
  abandonWorktreeWriter: hoisted.abandonWorktreeWriter,
}));

import { deleteAgent } from './deleteAgent';

const SID = 'sess-1' as SessionId;
const DOOMED = 'resolver-1' as AgentId;
const RUN = 'run-1' as ProviderRunId;
const MOUNT_TWO = 'mount-two' as MountId;
const MOUNT_THREE = 'mount-three' as MountId;
const PATH_TWO = '/repo/two';
const PATH_THREE = '/repo/three';

const resolver = (over: Partial<Agent> & { id: AgentId }): Agent => ({
  sessionId: SID,
  ordinal: 0,
  name: 'resolve: reviewer on a.ts:1',
  status: 'pending',
  kind: 'resolver',
  ...over,
});

const attemptOn = ({ mountId, worktreePath }: { mountId: MountId; worktreePath: string }) =>
  ({
    id: 'attempt-1',
    sessionId: SID,
    agentId: DOOMED,
    prNumber: 12,
    threadIds: ['PRRT_1'],
    provider: 'anthropic',
    model: 'claude-opus-5',
    effort: null,
    instructions: 'fix one',
    phase: 'running',
    mountTarget: { mountId, mountRevision: 2, worktreePath },
    startedAt: 1,
    endedAt: null,
    error: null,
    createdAt: 1,
  }) satisfies ResolveAttempt;

const mount = ({ mountId, worktreePath }: { mountId: MountId; worktreePath: string }) => ({
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

const makeStore = ({ isMounted = true }: { readonly isMounted?: boolean } = {}) => {
  const state: Record<string, unknown> = {
    sessionPhaseRuns: { [SID]: [resolver({ id: DOOMED, status: 'running' })] },
    agentTurnState: {
      [DOOMED]: { kind: 'running', runId: RUN, startedAt: '2026-07-25T09:00:00.000Z' },
    },
    agentAttachments: {},
    agentDraft: {},
    agentQueue: {},
    agentRunHistory: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    agentKindOverride: {},
    agentTurnDestination: {
      [DOOMED]: { kind: 'scratch', path: '/goodboy/scratch/sess-1' },
    },
    selectedAgentId: {},
    transcripts: {},
    sessionWorktrees: {},
    sessionProjectMounts: isMounted
      ? {
          [SID]: [
            mount({ mountId: MOUNT_TWO, worktreePath: PATH_TWO }),
            mount({ mountId: MOUNT_THREE, worktreePath: PATH_THREE }),
          ],
        }
      : {},
    sessionActiveMount: isMounted ? { [SID]: MOUNT_THREE } : {},
    sessionActiveProject: isMounted ? { [SID]: 'project-1' } : {},
    sessions: [{ id: SID, activeProjectId: 'project-1', state: { kind: 'idle' } }],
  };
  const get = (() => state) as unknown as GetFn;
  const set = ((u: unknown) => {
    const patch =
      typeof u === 'function'
        ? (u as (s: Record<string, unknown>) => Record<string, unknown>)(state)
        : (u as Record<string, unknown>);
    Object.assign(state, patch);
  }) as unknown as SetFn;
  return { state, get, set };
};

afterEach(() => vi.clearAllMocks());

describe('deleteAgent', () => {
  it('gives back the worktree the agent was writing, not the selected one', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([
      attemptOn({ mountId: MOUNT_TWO, worktreePath: PATH_TWO }),
    ]);

    await deleteAgent(set, get)(SID, DOOMED);

    expect(hoisted.cancelTurn).toHaveBeenCalledWith(RUN);
    expect(hoisted.abandonWorktreeWriter).toHaveBeenCalledWith({ path: PATH_TWO, holder: DOOMED });
  });

  it('drops the deleted agent write-destination snapshot', async () => {
    const { get, set, state } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([
      attemptOn({ mountId: MOUNT_TWO, worktreePath: PATH_TWO }),
    ]);

    await deleteAgent(set, get)(SID, DOOMED);

    expect(state.agentTurnDestination).toEqual({});
  });

  it('keeps the lease the attempt saved when the session was never loaded', async () => {
    const { get, set } = makeStore({ isMounted: false });
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([
      attemptOn({ mountId: MOUNT_TWO, worktreePath: PATH_TWO }),
    ]);

    await deleteAgent(set, get)(SID, DOOMED);

    expect(hoisted.abandonWorktreeWriter).toHaveBeenCalledWith({ path: PATH_TWO, holder: DOOMED });
  });

  it('touches no worktree when the agent never named one', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([]);

    await deleteAgent(set, get)(SID, DOOMED);

    expect(hoisted.abandonWorktreeWriter).not.toHaveBeenCalled();
  });
});
