import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  MountId,
  ProviderRunId,
  ResolveAttempt,
  SessionId,
  WorkspaceId,
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
  purgeAgentForDelete: vi.fn(async () => [] as ReadonlyArray<string>),
  removeQuestionsFromSlot: vi.fn(async () => false),
  listLiveRunIds: vi.fn(async () => new Set<string>()),
  emitNotification: vi.fn(async () => undefined),
  loadSessionOpenQuestions: vi.fn(async () => undefined),
  loadSessionSlots: vi.fn(async () => undefined),
}));

vi.mock('../../../features/chat/turn', () => ({
  cancelTurn: hoisted.cancelTurn,
  deleteAttachment: hoisted.deleteAttachment,
  listLiveRunIds: hoisted.listLiveRunIds,
}));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: hoisted.invokeAgentList,
}));
vi.mock('@goodboy/db', () => ({
  updateSessionState: hoisted.updateSessionState,
  listResolveAttempts: hoisted.listResolveAttempts,
  purgeAgentForDelete: hoisted.purgeAgentForDelete,
}));
vi.mock('@goodboy/core', () => ({
  removeQuestionsFromSlot: hoisted.removeQuestionsFromSlot,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: { execute: hoisted.execute } }));
vi.mock('../../../features/worktree/worktree', () => ({
  abandonWorktreeWriter: hoisted.abandonWorktreeWriter,
}));

import { deleteAgent } from './deleteAgent';
import { purgedAgentIds } from '../../session-mutators';

const SID = 'sess-1' as SessionId;
const DOOMED = 'resolver-1' as AgentId;
const RUN = 'run-1' as ProviderRunId;
const WID = 'ws-1' as WorkspaceId;
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

const attemptOn = ({
  mountId,
  worktreePath,
  id = 'attempt-1',
  phase = 'running',
  createdAt = 1,
}: {
  mountId: MountId;
  worktreePath: string;
  id?: string;
  phase?: ResolveAttempt['phase'];
  createdAt?: number;
}) =>
  ({
    id,
    sessionId: SID,
    agentId: DOOMED,
    prNumber: 12,
    threadIds: ['PRRT_1'],
    provider: 'anthropic',
    model: 'claude-opus-5',
    effort: null,
    instructions: 'fix one',
    phase,
    mountTarget: { mountId, mountRevision: 2, worktreePath },
    startedAt: 1,
    endedAt: null,
    error: null,
    createdAt,
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
    sessions: [
      { id: SID, workspaceId: WID, activeProjectId: 'project-1', state: { kind: 'idle' } },
    ],
    emitNotification: hoisted.emitNotification,
    loadSessionOpenQuestions: hoisted.loadSessionOpenQuestions,
    loadSessionSlots: hoisted.loadSessionSlots,
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

beforeEach(() => {
  hoisted.listLiveRunIds.mockReset();
  hoisted.listLiveRunIds.mockResolvedValue(new Set<string>());
  hoisted.purgeAgentForDelete.mockReset();
  hoisted.purgeAgentForDelete.mockResolvedValue([]);
  hoisted.removeQuestionsFromSlot.mockReset();
  hoisted.removeQuestionsFromSlot.mockResolvedValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
  purgedAgentIds.clear();
});

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

  it('gives back every worktree the agent still holds', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([
      attemptOn({ mountId: MOUNT_TWO, worktreePath: PATH_TWO, id: 'older', phase: 'waiting' }),
      attemptOn({
        mountId: MOUNT_THREE,
        worktreePath: PATH_THREE,
        id: 'newer',
        phase: 'queued',
        createdAt: 2,
      }),
    ]);

    await deleteAgent(set, get)(SID, DOOMED);

    expect(hoisted.abandonWorktreeWriter.mock.calls.map(([args]) => args.path).sort()).toEqual([
      PATH_THREE,
      PATH_TWO,
    ]);
  });

  it('touches no worktree when the agent never named one', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([]);

    await deleteAgent(set, get)(SID, DOOMED);

    expect(hoisted.abandonWorktreeWriter).not.toHaveBeenCalled();
  });

  it('purges the agent instead of deleting its row', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([]);

    await deleteAgent(set, get)(SID, DOOMED);

    expect(hoisted.purgeAgentForDelete).toHaveBeenCalledWith({
      db: expect.anything(),
      id: DOOMED,
    });
    expect(hoisted.execute).not.toHaveBeenCalled();
  });
  it('reloads the session questions so the dead agent question leaves the screen', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([]);
    hoisted.purgeAgentForDelete.mockResolvedValue(['renew the expired key?']);
    hoisted.removeQuestionsFromSlot.mockResolvedValue(true);

    await deleteAgent(set, get)(SID, DOOMED);

    expect(hoisted.removeQuestionsFromSlot).toHaveBeenCalledWith(expect.anything(), SID, [
      'renew the expired key?',
    ]);
    expect(hoisted.loadSessionSlots).toHaveBeenCalledWith(SID);
    expect(hoisted.loadSessionOpenQuestions).toHaveBeenCalledWith(SID);
  });

  it('leaves the context slot alone when the agent held no open question', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([]);

    await deleteAgent(set, get)(SID, DOOMED);

    expect(hoisted.removeQuestionsFromSlot).not.toHaveBeenCalled();
    expect(hoisted.loadSessionOpenQuestions).toHaveBeenCalledWith(SID);
  });

  it('waits for the run to stop before it purges the transcript', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([]);
    const order: string[] = [];
    let polls = 0;
    hoisted.listLiveRunIds.mockImplementation(async () => {
      polls += 1;
      order.push(`poll-${polls}`);
      return polls < 3 ? new Set<string>([RUN]) : new Set<string>();
    });
    hoisted.purgeAgentForDelete.mockImplementation(async () => {
      order.push('purge');
      return [];
    });

    await deleteAgent(set, get)(SID, DOOMED);

    expect(order).toEqual(['poll-1', 'poll-2', 'poll-3', 'purge']);
    expect(hoisted.emitNotification).not.toHaveBeenCalled();
  });

  it('purges anyway and tells the user when the run refuses to stop', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([]);
    hoisted.listLiveRunIds.mockResolvedValue(new Set<string>([RUN]));

    vi.useFakeTimers();
    try {
      const pending = deleteAgent(set, get)(SID, DOOMED);
      await vi.advanceTimersByTimeAsync(10_000);
      await pending;
    } finally {
      vi.useRealTimers();
    }

    expect(hoisted.purgeAgentForDelete).toHaveBeenCalledWith({
      db: expect.anything(),
      id: DOOMED,
    });
    expect(hoisted.emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'Deleted agent is still running',
      expect.stringContaining('discarded'),
      { sessionId: SID, workspaceId: WID },
    );
  });

  it('gags the agent before the purge so a late write cannot repopulate it', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([]);
    let gaggedDuringPurge = false;
    hoisted.purgeAgentForDelete.mockImplementation(async () => {
      gaggedDuringPurge = purgedAgentIds.has(DOOMED);
      return [];
    });

    await deleteAgent(set, get)(SID, DOOMED);

    expect(gaggedDuringPurge).toBe(true);
    expect(purgedAgentIds.has(DOOMED)).toBe(true);
  });

  it('lets the agent write again when the purge itself fails', async () => {
    const { get, set } = makeStore();
    hoisted.invokeAgentList.mockResolvedValue([]);
    hoisted.listResolveAttempts.mockResolvedValue([]);
    hoisted.purgeAgentForDelete.mockRejectedValue(new Error('database is locked'));

    await expect(deleteAgent(set, get)(SID, DOOMED)).rejects.toThrow('database is locked');

    expect(purgedAgentIds.has(DOOMED)).toBe(false);
  });
});
