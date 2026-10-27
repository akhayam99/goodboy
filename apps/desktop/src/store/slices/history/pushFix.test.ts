// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, MountId, SessionId } from '@goodboy/types';
import {
  aProject,
  aSession,
  nextProjectId,
  nextSessionId,
  nextWorkspaceId,
} from '@goodboy/types/testing';

const h = vi.hoisted(() => ({
  pushWithLease: vi.fn<() => Promise<unknown>>(async () => ({ kind: 'pushed' })),
}));

vi.mock('../../../features/history/historyEngine', () => ({
  pushWithLease: h.pushWithLease,
}));
vi.mock('../../../features/worktree/worktree', () => ({
  worktreeStatus: vi.fn(async () => ({ upstream: 'origin/fix/ledger-postings' })),
}));

import { pushBranch } from '../github/pushBranch';
import { resetWorktreeStatusCache } from '../../runtime/worktreeStatuses/cache';
import { useAppStore, type AppStore } from '../../store';
import { fixPushWithAgent } from './fixPushWithAgent';
import { settlePushFix } from './settlePushFix';
import type { HistoryRun } from './types';

const SESSION_ID = nextSessionId();
const PROJECT_ID = nextProjectId();
const WORKSPACE_ID = nextWorkspaceId();
const MOUNT_ID: MountId = JSON.parse(JSON.stringify('mount-push-fix'));
const AGENT_ID: AgentId = JSON.parse(JSON.stringify('agent-push-fixer'));
const HOOK_OUTPUT = 'pre-push hook declined\n$ pnpm lint\nseenEvents is assigned but never used';

type FailedRunParams = {
  readonly patch?: Partial<HistoryRun>;
};

const failedRun = ({ patch = {} }: FailedRunParams): HistoryRun => ({
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  origin: 'rebase',
  phase: 'stopped',
  planId: null,
  agentId: null,
  copyPath: null,
  stop: { reason: 'push-failed', message: HOOK_OUTPUT, files: [], sha: null },
  result: null,
  backupRef: null,
  remoteSha: 'remote-sha',
  holder: null,
  progress: null,
  applied: null,
  identity: null,
  movedHead: null,
  threadShas: [],
  commitCount: 7,
  updatedAt: 0,
  ...patch,
});

type SpawnOptions = {
  readonly kindOverride?: string;
  readonly mountId?: MountId;
  readonly initialPrompt?: string;
};

const spawnAgentMock = () =>
  vi.fn(async (_sessionId: SessionId, _options: SpawnOptions) => AGENT_ID);

type Harness = {
  readonly read: () => AppStore;
  readonly spawnAgent: ReturnType<typeof spawnAgentMock>;
  readonly sendTurn: ReturnType<typeof vi.fn>;
  readonly deleteAgent: ReturnType<typeof vi.fn>;
  readonly set: (patch: Partial<AppStore>) => void;
};

type HarnessParams = {
  readonly run: HistoryRun;
};

const harness = ({ run }: HarnessParams): Harness => {
  const spawnAgent = spawnAgentMock();
  const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
  const deleteAgent = vi.fn(async () => undefined);
  let state: AppStore = {
    ...useAppStore.getInitialState(),
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID, name: 'ledger-core' })],
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          mountId: MOUNT_ID,
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
          mountName: 'ledger-core',
          worktreePath: '/w/ledger',
          lastWorktreePath: null,
          repoRoot: '/repos/ledger-core',
          branch: 'fix/ledger-postings',
          baseBranch: null,
          parallelIndex: 0,
          isAttached: true,
          diskState: 'present',
          revision: 1,
        },
      ],
    },
    historyRuns: { [MOUNT_ID]: run },
    spawnAgent,
    sendTurn,
    deleteAgent,
    reportError: vi.fn(async () => undefined),
    recordSessionEvent: vi.fn(async () => undefined),
    refreshPrDescription: vi.fn(async () => false),
    refreshSessionPr: vi.fn(async () => undefined),
  };
  const set = (patch: Partial<AppStore> | ((current: AppStore) => Partial<AppStore>)) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  const get = () => state;
  state = {
    ...state,
    pushBranch: pushBranch({ set, get }),
    pushHistoryRewrite: async (input) => {
      const { pushHistoryRewrite } = await import('./applyHistoryRewrite');
      return pushHistoryRewrite(set, get)(input);
    },
  };
  const fix = fixPushWithAgent({ set, get });
  const settle = settlePushFix({ set, get });
  state = { ...state, fixPushWithAgent: fix, settlePushFix: settle };
  return { read: get, spawnAgent, sendTurn, deleteAgent, set };
};

beforeEach(() => {
  vi.clearAllMocks();
  resetWorktreeStatusCache();
  h.pushWithLease.mockResolvedValue({ kind: 'pushed' });
});

describe('fixPushWithAgent', () => {
  it('starts an implementer on the worktree with the push output as its brief', async () => {
    const { read, spawnAgent } = harness({ run: failedRun({}) });

    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(spawnAgent).toHaveBeenCalledTimes(1);
    const [, options] = spawnAgent.mock.calls[0] ?? [];
    expect(options?.kindOverride).toBe('implementer');
    expect(options?.mountId).toBe(MOUNT_ID);
    expect(options?.initialPrompt).toContain(
      "git push --force-with-lease='fix/ledger-postings:remote-sha' origin 'fix/ledger-postings'",
    );
    expect(options?.initialPrompt).toContain('seenEvents is assigned but never used');
    expect(read().historyRuns[MOUNT_ID]?.pushFix).toEqual({ agentId: AGENT_ID });
  });

  it('starts the turn only after the agent is bound to the run', async () => {
    const { read, spawnAgent, sendTurn } = harness({ run: failedRun({}) });

    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ shouldDeferKickoff: true });
    expect(sendTurn).toHaveBeenCalledTimes(1);
  });

  it('removes the agent and starts no turn when the run was dismissed during spawn', async () => {
    const { read, spawnAgent, sendTurn, deleteAgent, set } = harness({ run: failedRun({}) });
    spawnAgent.mockImplementationOnce(async () => {
      set({ historyRuns: {} });
      return AGENT_ID;
    });

    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(sendTurn).not.toHaveBeenCalled();
    expect(deleteAgent).toHaveBeenCalledWith(SESSION_ID, AGENT_ID);
    expect(read().historyRuns[MOUNT_ID]).toBeUndefined();
  });

  it('does nothing when the run did not stop on a failed push', async () => {
    const { read, spawnAgent } = harness({
      run: failedRun({ patch: { stop: { reason: 'failed', message: 'x', files: [], sha: null } } }),
    });

    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('does not start a second agent while one is fixing', async () => {
    const { read, spawnAgent } = harness({
      run: failedRun({ patch: { pushFix: { agentId: AGENT_ID } } }),
    });

    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID });

    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('starts one agent for two clicks before the first agent exists', async () => {
    const { read, spawnAgent } = harness({ run: failedRun({}) });

    await Promise.all([
      read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
      read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID }),
    ]);

    expect(spawnAgent).toHaveBeenCalledTimes(1);
  });

  it('frees the run and removes the agent when the budget declines the kickoff', async () => {
    const { read, spawnAgent, sendTurn, deleteAgent } = harness({ run: failedRun({}) });
    sendTurn.mockResolvedValueOnce({ blockedOverBudget: true });

    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID });
    await vi.waitFor(() => expect(deleteAgent).toHaveBeenCalledWith(SESSION_ID, AGENT_ID));

    expect(read().historyRuns[MOUNT_ID]?.pushFix).toBeUndefined();
    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID });
    expect(spawnAgent).toHaveBeenCalledTimes(2);
  });

  it('frees the run and removes the agent when the kickoff is rejected', async () => {
    const { read, spawnAgent, sendTurn, deleteAgent } = harness({ run: failedRun({}) });
    sendTurn.mockRejectedValueOnce(new Error('provider offline'));

    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID });
    await vi.waitFor(() => expect(deleteAgent).toHaveBeenCalledWith(SESSION_ID, AGENT_ID));

    expect(read().historyRuns[MOUNT_ID]?.pushFix).toBeUndefined();
    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID });
    expect(spawnAgent).toHaveBeenCalledTimes(2);
  });
});

describe('fixPushWithAgent hint', () => {
  it('adds no operator notes without a hint and never reports acceptance', async () => {
    const { read, spawnAgent } = harness({ run: failedRun({}) });
    const onAccepted = vi.fn();

    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID, onAccepted });

    expect(spawnAgent.mock.calls[0]?.[1].initialPrompt).not.toContain('Operator notes');
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('puts the hint verbatim after the brief and reports acceptance when the turn starts', async () => {
    const { read, spawnAgent, sendTurn } = harness({ run: failedRun({}) });
    sendTurn.mockImplementationOnce(async (turn: { readonly onStarted?: () => void }) => {
      turn.onStarted?.();
      return { blockedOverBudget: false };
    });
    const onAccepted = vi.fn();
    const hint = 'Operator notes\n```\nKeep the lint rule.';

    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID, hint, onAccepted });
    await vi.waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));

    const prompt = spawnAgent.mock.calls[0]?.[1].initialPrompt ?? '';
    expect(prompt.endsWith(`## Operator notes\n${hint}`)).toBe(true);
    expect(prompt.indexOf('End with one line saying what you changed.')).toBeLessThan(
      prompt.indexOf('Operator notes are optional guidance'),
    );
    expect(sendTurn.mock.calls[0]?.[0].content).toBe(prompt);
  });

  it('reports no acceptance when the budget declines the kickoff and keeps the hint for a retry', async () => {
    const { read, spawnAgent, sendTurn, deleteAgent } = harness({ run: failedRun({}) });
    sendTurn.mockResolvedValueOnce({ blockedOverBudget: true });
    const onAccepted = vi.fn();
    const hint = 'Keep the lint rule.';

    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID, hint, onAccepted });
    await vi.waitFor(() => expect(deleteAgent).toHaveBeenCalledWith(SESSION_ID, AGENT_ID));

    expect(onAccepted).not.toHaveBeenCalled();
    await read().fixPushWithAgent({ sessionId: SESSION_ID, mountId: MOUNT_ID, hint, onAccepted });
    expect(spawnAgent.mock.calls[1]?.[1].initialPrompt).toContain(`## Operator notes\n${hint}`);
  });

  it('reports acceptance for a turn that waits in the lane', async () => {
    const { read, sendTurn } = harness({ run: failedRun({}) });
    sendTurn.mockResolvedValueOnce({ blockedOverBudget: false, isLaneQueued: true });
    const onAccepted = vi.fn();

    await read().fixPushWithAgent({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      hint: 'Keep it small.',
      onAccepted,
    });

    await vi.waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));
  });
});

describe('settlePushFix', () => {
  it('pushes again with the same lease when the agent finishes and clears the failure', async () => {
    const { read } = harness({ run: failedRun({ patch: { pushFix: { agentId: AGENT_ID } } }) });

    await read().settlePushFix({ sessionId: SESSION_ID, agentId: AGENT_ID, hasFailed: false });

    expect(h.pushWithLease).toHaveBeenCalledWith(
      expect.objectContaining({ branch: 'fix/ledger-postings', expectedRemoteSha: 'remote-sha' }),
    );
    const run = read().historyRuns[MOUNT_ID];
    expect(run?.phase).toBe('pushed');
    expect(run?.stop).toBeNull();
    expect(run?.pushFix).toBeUndefined();
  });

  it('keeps the failure and never pushes when the agent failed', async () => {
    const { read } = harness({ run: failedRun({ patch: { pushFix: { agentId: AGENT_ID } } }) });

    await read().settlePushFix({ sessionId: SESSION_ID, agentId: AGENT_ID, hasFailed: true });

    expect(h.pushWithLease).not.toHaveBeenCalled();
    const run = read().historyRuns[MOUNT_ID];
    expect(run?.stop?.reason).toBe('push-failed');
    expect(run?.pushFix).toBeUndefined();
  });

  it('stops on the lease when the online copy moved meanwhile', async () => {
    h.pushWithLease.mockResolvedValue({ kind: 'stale' });
    const { read } = harness({ run: failedRun({ patch: { pushFix: { agentId: AGENT_ID } } }) });

    await read().settlePushFix({ sessionId: SESSION_ID, agentId: AGENT_ID, hasFailed: false });

    expect(read().historyRuns[MOUNT_ID]?.stop?.reason).toBe('origin-moved');
  });

  it('ignores an agent that is not fixing a push', async () => {
    const { read } = harness({ run: failedRun({}) });

    await read().settlePushFix({ sessionId: SESSION_ID, agentId: AGENT_ID, hasFailed: false });

    expect(h.pushWithLease).not.toHaveBeenCalled();
  });
});
