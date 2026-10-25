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
  readOriginAhead: vi.fn<() => Promise<unknown>>(async () => ({
    knownRemoteSha: 'remote-sha',
    remoteSha: 'remote-sha',
    onlyOnline: [],
  })),
  gitPush: vi.fn<() => Promise<unknown>>(async () => ({ exitCode: 0, stderr: '' })),
}));

vi.mock('../../../features/history/historyEngine', () => ({
  pushWithLease: h.pushWithLease,
  readOriginAhead: h.readOriginAhead,
}));
vi.mock('../../../features/integrations/github/github', () => ({
  gitPush: h.gitPush,
}));
vi.mock('../../../features/worktree/worktree', () => ({
  worktreeStatus: vi.fn(async () => ({ upstream: 'origin/fix/ledger-postings' })),
}));

import { resetWorktreeStatusCache } from '../../runtime/worktreeStatuses/cache';
import { useAppStore, type AppStore } from '../../store';
import { fixBranchPushWithAgent } from './fixBranchPushWithAgent';
import { prefillBranchPushTerminal } from './prefillBranchPushTerminal';
import { settleBranchPushFix } from './settleBranchPushFix';

const SESSION_ID = nextSessionId();
const PROJECT_ID = nextProjectId();
const WORKSPACE_ID = nextWorkspaceId();
const MOUNT_ID: MountId = JSON.parse(JSON.stringify('mount-push-fix'));
const AGENT_ID: AgentId = JSON.parse(JSON.stringify('agent-push-fixer'));
const HOOK_OUTPUT = 'pre-push hook declined\n$ pnpm lint\nseenEvents is assigned but never used';

type SpawnOptions = {
  readonly kindOverride?: string;
  readonly mountId?: MountId;
  readonly initialPrompt?: string;
};

const spawnAgentMock = () =>
  vi.fn(async (_sessionId: SessionId, _options: SpawnOptions) => AGENT_ID);

type RenameBranchParams = {
  readonly branch: string;
};

type Harness = {
  readonly read: () => AppStore;
  readonly spawnAgent: ReturnType<typeof spawnAgentMock>;
  readonly sendTurn: ReturnType<typeof vi.fn>;
  readonly deleteAgent: ReturnType<typeof vi.fn>;
  readonly renameBranch: (params: RenameBranchParams) => void;
  readonly moveWorktree: (params: MoveWorktreeParams) => void;
};

type MoveWorktreeParams = {
  readonly worktreePath: string;
};

const harness = (): Harness => {
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
    fixBranchPushWithAgent: fixBranchPushWithAgent({ set, get }),
    settleBranchPushFix: settleBranchPushFix({ set, get }),
    prefillBranchPushTerminal: prefillBranchPushTerminal({ get }),
    pushBranch: async (params) => {
      const { pushBranch } = await import('../github/pushBranch');
      return pushBranch({ set, get })(params);
    },
  };
  const renameBranch = ({ branch }: RenameBranchParams) => {
    set((current) => ({
      sessionProjectMounts: {
        ...current.sessionProjectMounts,
        [SESSION_ID]: (current.sessionProjectMounts[SESSION_ID] ?? []).map((mount) => ({
          ...mount,
          branch,
        })),
      },
    }));
  };
  const moveWorktree = ({ worktreePath }: MoveWorktreeParams) => {
    set((current) => ({
      sessionProjectMounts: {
        ...current.sessionProjectMounts,
        [SESSION_ID]: (current.sessionProjectMounts[SESSION_ID] ?? []).map((mount) => ({
          ...mount,
          worktreePath,
        })),
      },
    }));
  };
  return { read: get, spawnAgent, sendTurn, deleteAgent, renameBranch, moveWorktree };
};

beforeEach(() => {
  vi.clearAllMocks();
  resetWorktreeStatusCache();
  h.pushWithLease.mockResolvedValue({ kind: 'pushed' });
  h.gitPush.mockResolvedValue({ exitCode: 0, stderr: '' });
  h.readOriginAhead.mockResolvedValue({
    knownRemoteSha: 'remote-sha',
    remoteSha: 'remote-sha',
    onlyOnline: [],
  });
});

type InputParams = {
  readonly isForce: boolean;
};

const input = ({ isForce }: InputParams) => ({
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  isForce,
  confirmedOnlyOnline: null,
  confirmedRemoteSha: null,
});

describe('fixBranchPushWithAgent', () => {
  it('briefs an implementer with the plain push command and its output', async () => {
    const { read, spawnAgent } = harness();

    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    const [, options] = spawnAgent.mock.calls[0] ?? [];
    expect(options?.kindOverride).toBe('implementer');
    expect(options?.mountId).toBe(MOUNT_ID);
    expect(options?.initialPrompt).toContain("Command: git push origin 'fix/ledger-postings'");
    expect(options?.initialPrompt).toContain('seenEvents is assigned but never used');
    expect(read().branchPushFixes[AGENT_ID]?.isForce).toBe(false);
  });

  it('briefs a force push with the lease on the known online commit', async () => {
    const { read, spawnAgent } = harness();

    await read().fixBranchPushWithAgent({ ...input({ isForce: true }), message: HOOK_OUTPUT });

    const [, options] = spawnAgent.mock.calls[0] ?? [];
    expect(options?.initialPrompt).toContain(
      "git push --force-with-lease='fix/ledger-postings:remote-sha' origin 'fix/ledger-postings'",
    );
  });

  it('starts the turn only after the agent is bound to the fix', async () => {
    const { read, spawnAgent, sendTurn } = harness();

    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ shouldDeferKickoff: true });
    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(read().branchPushFixes[AGENT_ID]).toBeDefined();
  });

  it('starts no agent when the mount switched branch during the lease read', async () => {
    const { read, spawnAgent, sendTurn, renameBranch } = harness();
    h.readOriginAhead.mockImplementationOnce(async () => {
      renameBranch({ branch: 'fix/other-branch' });
      return { knownRemoteSha: 'remote-sha', remoteSha: 'remote-sha', onlyOnline: [] };
    });

    await read().fixBranchPushWithAgent({ ...input({ isForce: true }), message: HOOK_OUTPUT });

    expect(spawnAgent).not.toHaveBeenCalled();
    expect(sendTurn).not.toHaveBeenCalled();
    expect(read().branchPushFixes).toEqual({});
  });

  it('removes the spawned agent and starts no turn when the mount switched during spawn', async () => {
    const { read, spawnAgent, sendTurn, deleteAgent, renameBranch } = harness();
    spawnAgent.mockImplementationOnce(async () => {
      renameBranch({ branch: 'fix/other-branch' });
      return AGENT_ID;
    });

    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    expect(sendTurn).not.toHaveBeenCalled();
    expect(deleteAgent).toHaveBeenCalledWith(SESSION_ID, AGENT_ID);
    expect(read().branchPushFixes).toEqual({});
  });

  it('does not start a second agent for the same branch', async () => {
    const { read, spawnAgent } = harness();

    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });
    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    expect(spawnAgent).toHaveBeenCalledTimes(1);
  });

  it('starts one agent for two clicks before the first agent exists', async () => {
    const { read, spawnAgent } = harness();

    await Promise.all([
      read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT }),
      read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT }),
    ]);

    expect(spawnAgent).toHaveBeenCalledTimes(1);
  });

  it('lets Retry start an agent again after the first spawn failed', async () => {
    const { read, spawnAgent } = harness();
    spawnAgent.mockRejectedValueOnce(new Error('offline'));

    await expect(
      read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT }),
    ).rejects.toThrow('offline');
    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    expect(spawnAgent).toHaveBeenCalledTimes(2);
  });

  it('frees the fix and removes the agent when the budget declines the kickoff', async () => {
    const { read, spawnAgent, sendTurn, deleteAgent } = harness();
    sendTurn.mockResolvedValueOnce({ blockedOverBudget: true });

    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });
    await vi.waitFor(() => expect(deleteAgent).toHaveBeenCalledWith(SESSION_ID, AGENT_ID));

    expect(read().branchPushFixes).toEqual({});
    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });
    expect(spawnAgent).toHaveBeenCalledTimes(2);
  });

  it('frees the fix and removes the agent when the kickoff is rejected', async () => {
    const { read, spawnAgent, sendTurn, deleteAgent } = harness();
    sendTurn.mockRejectedValueOnce(new Error('provider offline'));

    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });
    await vi.waitFor(() => expect(deleteAgent).toHaveBeenCalledWith(SESSION_ID, AGENT_ID));

    expect(read().branchPushFixes).toEqual({});
    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });
    expect(spawnAgent).toHaveBeenCalledTimes(2);
  });
});

describe('fixBranchPushWithAgent hint', () => {
  it('adds the hint verbatim after the brief and reports acceptance when the turn starts', async () => {
    const { read, spawnAgent, sendTurn } = harness();
    sendTurn.mockImplementationOnce(async (turn: { readonly onStarted?: () => void }) => {
      turn.onStarted?.();
      return { blockedOverBudget: false };
    });
    const onAccepted = vi.fn();
    const hint = 'Operator notes\n## Command\nKeep the hook.';

    await read().fixBranchPushWithAgent({
      ...input({ isForce: false }),
      message: HOOK_OUTPUT,
      hint,
      onAccepted,
    });
    await vi.waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));

    expect(
      spawnAgent.mock.calls[0]?.[1].initialPrompt?.endsWith(`## Operator notes\n${hint}`),
    ).toBe(true);
  });

  it('adds nothing without a hint', async () => {
    const { read, spawnAgent } = harness();

    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    expect(spawnAgent.mock.calls[0]?.[1].initialPrompt).not.toContain('Operator notes');
  });

  it('reports no acceptance when the kickoff is rejected', async () => {
    const { read, sendTurn, deleteAgent } = harness();
    sendTurn.mockRejectedValueOnce(new Error('provider offline'));
    const onAccepted = vi.fn();

    await read().fixBranchPushWithAgent({
      ...input({ isForce: false }),
      message: HOOK_OUTPUT,
      hint: 'Keep the hook.',
      onAccepted,
    });
    await vi.waitFor(() => expect(deleteAgent).toHaveBeenCalledWith(SESSION_ID, AGENT_ID));

    expect(onAccepted).not.toHaveBeenCalled();
  });
});

describe('settleBranchPushFix', () => {
  it('pushes the branch again when the agent finishes a plain push fix', async () => {
    const { read } = harness();
    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    await read().settleBranchPushFix({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      hasFailed: false,
    });

    expect(h.gitPush).toHaveBeenCalledTimes(1);
    expect(h.pushWithLease).not.toHaveBeenCalled();
    expect(read().branchPushFixes[AGENT_ID]).toBeUndefined();
  });

  it('pushes again with the same lease after a force push fix', async () => {
    const { read } = harness();
    await read().fixBranchPushWithAgent({ ...input({ isForce: true }), message: HOOK_OUTPUT });

    await read().settleBranchPushFix({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      hasFailed: false,
    });

    expect(h.pushWithLease).toHaveBeenCalledWith(
      expect.objectContaining({ branch: 'fix/ledger-postings', expectedRemoteSha: 'remote-sha' }),
    );
    expect(h.gitPush).not.toHaveBeenCalled();
  });

  it('refuses the automatic force push when the tracking ref advanced while the agent worked', async () => {
    const { read } = harness();
    await read().fixBranchPushWithAgent({
      ...input({ isForce: true }),
      confirmedRemoteSha: 'remote-sha',
      message: HOOK_OUTPUT,
    });
    h.readOriginAhead.mockResolvedValue({
      knownRemoteSha: 'newer-sha',
      remoteSha: 'newer-sha',
      onlyOnline: [],
    });

    await read().settleBranchPushFix({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      hasFailed: false,
    });

    expect(h.pushWithLease).not.toHaveBeenCalled();
    expect(read().reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't push the fix.",
        error: 'The online copy changed. Check again before force pushing.',
        recovery: { clause: 'work-kept' },
      }),
    );
    expect(read().settledBranchPushes[MOUNT_ID]).toBeUndefined();
  });

  it('leases the confirmed remote sha on the automatic force push', async () => {
    const { read } = harness();
    await read().fixBranchPushWithAgent({
      ...input({ isForce: true }),
      confirmedRemoteSha: 'remote-sha',
      message: HOOK_OUTPUT,
    });

    await read().settleBranchPushFix({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      hasFailed: false,
    });

    expect(h.pushWithLease).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRemoteSha: 'remote-sha' }),
    );
  });

  it('counts a successful retry so the header can drop the old failure', async () => {
    const { read } = harness();
    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    await read().settleBranchPushFix({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      hasFailed: false,
    });

    expect(read().settledBranchPushes[MOUNT_ID]).toBe(1);
  });

  it('keeps the failure when the retry fails again', async () => {
    h.gitPush.mockResolvedValue({ exitCode: 1, stderr: 'hook declined' });
    const { read } = harness();
    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    await read().settleBranchPushFix({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      hasFailed: false,
    });

    expect(read().settledBranchPushes[MOUNT_ID]).toBeUndefined();
  });

  it('reports a push that fails again and keeps no pending fix', async () => {
    h.gitPush.mockResolvedValue({ exitCode: 1, stderr: 'hook declined' });
    const { read } = harness();
    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    await read().settleBranchPushFix({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      hasFailed: false,
    });

    expect(read().reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't push the fix.",
        error: 'hook declined',
        sessionId: SESSION_ID,
        coalesceKey: `push-failed:${MOUNT_ID}`,
        recovery: {
          action: { kind: 'retry-push', sessionId: SESSION_ID, mountId: MOUNT_ID },
          clause: 'work-kept',
        },
      }),
    );
    expect(read().branchPushFixes[AGENT_ID]).toBeUndefined();
  });

  it('never pushes when the agent failed', async () => {
    const { read } = harness();
    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    await read().settleBranchPushFix({ sessionId: SESSION_ID, agentId: AGENT_ID, hasFailed: true });

    expect(h.gitPush).not.toHaveBeenCalled();
    expect(read().branchPushFixes[AGENT_ID]).toBeUndefined();
  });

  it('pushes nothing and reports when the mount switched branch while the agent worked', async () => {
    const { read, renameBranch } = harness();
    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });
    renameBranch({ branch: 'fix/other-branch' });

    await read().settleBranchPushFix({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      hasFailed: false,
    });

    expect(h.gitPush).not.toHaveBeenCalled();
    expect(h.pushWithLease).not.toHaveBeenCalled();
    expect(read().reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't push the fix.",
        recovery: { clause: 'work-kept' },
      }),
    );
    expect(read().settledBranchPushes[MOUNT_ID]).toBeUndefined();
    expect(read().branchPushFixes[AGENT_ID]).toBeUndefined();
  });

  it('pushes nothing when a force fix finds the mount in another worktree', async () => {
    const { read, moveWorktree } = harness();
    await read().fixBranchPushWithAgent({ ...input({ isForce: true }), message: HOOK_OUTPUT });
    moveWorktree({ worktreePath: '/w/elsewhere' });

    await read().settleBranchPushFix({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      hasFailed: false,
    });

    expect(h.pushWithLease).not.toHaveBeenCalled();
    expect(read().reportError).toHaveBeenCalledTimes(1);
  });

  it('pushes the original worktree path on the plain retry', async () => {
    const { read } = harness();
    await read().fixBranchPushWithAgent({ ...input({ isForce: false }), message: HOOK_OUTPUT });

    await read().settleBranchPushFix({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      hasFailed: false,
    });

    expect(h.gitPush).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/w/ledger' }));
  });

  it('ignores an agent that is not fixing a push', async () => {
    const { read } = harness();

    await read().settleBranchPushFix({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      hasFailed: false,
    });

    expect(h.gitPush).not.toHaveBeenCalled();
  });
});

describe('prefillBranchPushTerminal', () => {
  it('types the force push with its lease into the worktree terminal', async () => {
    const { read } = harness();
    const addTerminalTab = vi.fn(() => 'terminal-1');
    const setTerminalPrefill = vi.fn();
    const openDrawer = vi.fn();
    Object.assign(read(), { addTerminalTab, setTerminalPrefill, openDrawer });

    await read().prefillBranchPushTerminal(input({ isForce: true }));

    expect(addTerminalTab).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/w/ledger' }));
    expect(setTerminalPrefill).toHaveBeenCalledWith(
      expect.objectContaining({
        prefill:
          "git push --force-with-lease='fix/ledger-postings:remote-sha' origin 'fix/ledger-postings'",
      }),
    );
  });

  it('opens no terminal when the mount switched branch during the lease read', async () => {
    const { read, renameBranch } = harness();
    const addTerminalTab = vi.fn(() => 'terminal-1');
    Object.assign(read(), { addTerminalTab, setTerminalPrefill: vi.fn(), openDrawer: vi.fn() });
    h.readOriginAhead.mockImplementationOnce(async () => {
      renameBranch({ branch: 'fix/other-branch' });
      return { knownRemoteSha: 'remote-sha', remoteSha: 'remote-sha', onlyOnline: [] };
    });

    await read().prefillBranchPushTerminal(input({ isForce: true }));

    expect(addTerminalTab).not.toHaveBeenCalled();
  });

  it('leases the confirmed remote sha, not a fresh read', async () => {
    const { read } = harness();
    const addTerminalTab = vi.fn(() => 'terminal-1');
    const setTerminalPrefill = vi.fn();
    const openDrawer = vi.fn();
    Object.assign(read(), { addTerminalTab, setTerminalPrefill, openDrawer });

    await read().prefillBranchPushTerminal({
      ...input({ isForce: true }),
      confirmedRemoteSha: 'remote-sha',
    });

    expect(setTerminalPrefill).toHaveBeenCalledWith(
      expect.objectContaining({
        prefill:
          "git push --force-with-lease='fix/ledger-postings:remote-sha' origin 'fix/ledger-postings'",
      }),
    );
  });

  it('refuses to prefill a force command when the remote moved since the confirmation', async () => {
    const { read } = harness();
    const addTerminalTab = vi.fn(() => 'terminal-1');
    Object.assign(read(), { addTerminalTab, setTerminalPrefill: vi.fn(), openDrawer: vi.fn() });
    h.readOriginAhead.mockResolvedValue({
      knownRemoteSha: 'newer-sha',
      remoteSha: 'newer-sha',
      onlyOnline: [],
    });

    await expect(
      read().prefillBranchPushTerminal({
        ...input({ isForce: true }),
        confirmedRemoteSha: 'remote-sha',
      }),
    ).rejects.toThrow('The online copy changed. Check again before force pushing.');
    expect(addTerminalTab).not.toHaveBeenCalled();
  });

  it('refuses to prefill a force command over online commits the user never confirmed', async () => {
    const { read } = harness();
    const addTerminalTab = vi.fn(() => 'terminal-1');
    Object.assign(read(), { addTerminalTab, setTerminalPrefill: vi.fn(), openDrawer: vi.fn() });
    h.readOriginAhead.mockResolvedValue({
      knownRemoteSha: 'remote-sha',
      remoteSha: 'remote-sha',
      onlyOnline: [{ sha: 'late-commit', subject: 'Late fix' }],
    });

    await expect(
      read().prefillBranchPushTerminal({
        ...input({ isForce: true }),
        confirmedOnlyOnline: ['early-commit'],
        confirmedRemoteSha: 'remote-sha',
      }),
    ).rejects.toThrow('The online copy changed. Check again before force pushing.');
    expect(addTerminalTab).not.toHaveBeenCalled();
  });
});
