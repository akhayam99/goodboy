import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import { aProject, nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import type {
  AgentId,
  MountId,
  ProviderRunId,
  SessionId,
  SessionProjectMount,
  TurnEvent,
} from '@goodboy/types';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { writerWaiters } from './slices/turn/writerWaiters';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const workspace = buildStoryWorkspace({
  id: nextWorkspaceId(),
  name: 'Harborline',
  slug: 'harborline',
});
const SCRATCH = '/tmp/goodboy-root/scratch/harborline';

let useAppStore: StoryStore;
let first: { readonly sessionId: SessionId; readonly agentId: AgentId };

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type RunArgs = { readonly runId: ProviderRunId };

const gate = () => {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
};

const heldStream = ({
  runId,
  hold,
}: {
  readonly runId: ProviderRunId;
  readonly hold: Promise<void>;
}) =>
  (async function* stream(): AsyncIterable<TurnEvent> {
    yield { kind: 'assistant_text', runId, delta: 'Reading the export', at: TEST_NOW };
    await hold;
  })();

const startAgent = async (kind: 'generic' | 'scout') => {
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal: 'Reconcile the Harborline ledger export',
    firstAgentKind: kind,
  });
  const [agent] = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
  }
  await vi.waitFor(() =>
    expect(['running', 'starting']).not.toContain(
      useAppStore.getState().agentTurnState[agent.id]?.kind,
    ),
  );
  return { sessionId: session.id, agentId: agent.id };
};

const send = ({
  sessionId,
  agentId,
  confinedRole = 'implementer',
}: {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly confinedRole?: string;
}) =>
  useAppStore.getState().sendTurn({
    sessionId,
    agentId,
    content: 'Reconcile the Harborline ledger',
    confinedRole,
  });

const sendOutsideAuto = ({
  sessionId,
  agentId,
}: {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
}) =>
  useAppStore
    .getState()
    .sendTurn({ sessionId, agentId, content: 'Reconcile the Harborline ledger' });

const isMountId = (value: string): value is MountId => value.length > 0;

const repoMount = ({
  sessionId,
  name,
}: {
  readonly sessionId: SessionId;
  readonly name: string;
}): SessionProjectMount => {
  const mountId = `mount-${name}`;
  if (!isMountId(mountId)) {
    throw new Error('the mount id is empty');
  }
  return {
    mountId,
    sessionId,
    projectId: aProject().id,
    mountName: name,
    worktreePath: `/repo/api/.goodboy/worktrees/${name}`,
    lastWorktreePath: null,
    repoRoot: '/repo/api',
    branch: `goodboy/${name}`,
    baseBranch: null,
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 0,
  };
};

const waitOf = (agentId: AgentId) => useAppStore.getState().agentWriterWait[agentId];

const deniedBy = (holder: string) => ({
  isGranted: false,
  entries: [],
  blockedPath: SCRATCH,
  blockedBy: holder,
});

const turnRuns = () =>
  rowsOf<{ id: string }>({
    sql: "SELECT id FROM provider_runs WHERE json_extract(status_payload, '$.routingDecision') IS NOT NULL",
  });

const fakeRegistry = () => {
  const holders = new Map<string, string>();
  storySpies.acquireWriteSet.mockImplementation(async ({ paths, holder }) => {
    const blockedPath = paths.find((path) => {
      const current = holders.get(path);
      return current !== undefined && current !== holder;
    });
    if (blockedPath !== undefined) {
      return { ...deniedBy(holders.get(blockedPath) ?? ''), blockedPath };
    }
    for (const path of paths) {
      holders.set(path, holder);
    }
    return {
      isGranted: true,
      entries: paths.map((path) => ({ path, token: `token:${holder}` })),
      blockedPath: null,
      blockedBy: null,
    };
  });
  storySpies.releaseWriteSet.mockImplementation(async ({ entries, holder }) => {
    const released: Array<string> = [];
    for (const entry of entries) {
      if (holders.get(entry.path) === holder) {
        holders.delete(entry.path);
        released.push(entry.path);
      }
    }
    return released;
  });
  return holders;
};

beforeEach(async () => {
  await resetStoryStore();
  await insertWorkspace({ db: await openStorySqlite(), workspace });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    projects: [],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue(SCRATCH);
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.listLiveRunIds.mockResolvedValue(new Set<string>());
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  first = await startAgent('generic');
});

afterEach(async () => {
  vi.useRealTimers();
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

describe('inside an Auto tree a second writer on the same folder waits for the first', () => {
  it('shows the wait, starts only after the first turn ends, and never holds both', async () => {
    const holders = fakeRegistry();
    const second = await startAgent('generic');
    const hold = gate();
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      heldStream({ runId, hold: hold.opened }),
    );
    const firstTurn = send(first);
    await vi.waitFor(() => expect(holders.get(SCRATCH)).toBe(first.agentId));
    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledOnce());

    const secondTurn = send(second);
    await vi.waitFor(() => expect(waitOf(second.agentId)).toBeDefined());

    expect(waitOf(second.agentId)).toEqual(
      expect.objectContaining({ blockedPath: SCRATCH, blockedBy: first.agentId }),
    );
    expect(useAppStore.getState().agentTurnState[second.agentId]?.kind).toBe('starting');
    expect(storySpies.runTurn).toHaveBeenCalledOnce();
    expect(holders.get(SCRATCH)).toBe(first.agentId);

    hold.open();
    await firstTurn;
    await secondTurn;

    expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
    expect(waitOf(second.agentId)).toBeUndefined();
    expect(holders.size).toBe(0);
    expect(useAppStore.getState().agentTurnState[second.agentId]?.kind).toBe('idle');
  });

  it('hands the lease to the Rust spawn: the same folders go to the CLI and to the lease', async () => {
    fakeRegistry();

    await send(first);

    const spawn = storySpies.runTurn.mock.calls[0]?.[0];
    expect(spawn?.writeSetLease?.holder).toBe(first.agentId);
    expect(spawn?.writeSetLease?.entries.map((entry: { path: string }) => entry.path)).toEqual([
      spawn?.workingDir,
      ...(spawn?.writableRoots ?? []),
    ]);
    expect(storySpies.acquireWriteSet).toHaveBeenCalledWith({
      paths: [spawn?.workingDir, ...(spawn?.writableRoots ?? [])],
      holder: first.agentId,
    });
  });

  it('releases the folders when the turn fails', async () => {
    const holders = fakeRegistry();
    storySpies.runTurn.mockImplementation(() =>
      (async function* stream(): AsyncIterable<TurnEvent> {
        yield* [];
        throw new Error('the provider process was terminated');
      })(),
    );

    await send(first).catch(() => undefined);

    expect(holders.size).toBe(0);
    expect(storySpies.releaseWriteSet).toHaveBeenCalledOnce();
  });

  it('Stop cancels the wait: nothing starts, nothing is recorded, the agent is idle', async () => {
    storySpies.acquireWriteSet.mockResolvedValue(deniedBy('agent-elsewhere'));
    const turn = send(first);
    await vi.waitFor(() => expect(waitOf(first.agentId)).toBeDefined());

    await useAppStore.getState().cancelCurrentTurn(first.sessionId, first.agentId, 'user');
    writerWaiters.wake();
    const result = await turn;

    expect(result.blockedOverBudget).toBe(false);
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(await turnRuns()).toEqual([]);
    expect(waitOf(first.agentId)).toBeUndefined();
    expect(useAppStore.getState().agentTurnState[first.agentId]?.kind).toBe('draft');
    expect(storySpies.releaseWriteSet).not.toHaveBeenCalled();
  });

  it('gives up after the wait limit and answers that the writer lease was denied', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00.000Z'));
    storySpies.acquireWriteSet.mockResolvedValue(deniedBy('agent-elsewhere'));
    const turn = send(first);
    await vi.waitFor(() => expect(waitOf(first.agentId)).toBeDefined());

    vi.setSystemTime(new Date('2026-10-14T10:31:00.000Z'));
    writerWaiters.wake();
    const result = await turn;

    expect(result).toEqual({ blockedOverBudget: false, isWriterLeaseDenied: true });
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(waitOf(first.agentId)).toBeUndefined();
    expect(useAppStore.getState().agentTurnState[first.agentId]?.kind).toBe('draft');
  });

  it('shows the error and leaves the agent idle when the lease call fails', async () => {
    storySpies.acquireWriteSet.mockRejectedValue(new Error('registry unavailable'));

    await expect(send(first)).rejects.toThrow('registry unavailable');

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(waitOf(first.agentId)).toBeUndefined();
  });

  it('does not lease for a confined role that only reads', async () => {
    const scout = await startAgent('generic');

    await send({ ...scout, confinedRole: 'reviewer' });

    expect(storySpies.acquireWriteSet).not.toHaveBeenCalled();
    expect(storySpies.runTurn).toHaveBeenCalledOnce();
    expect(storySpies.runTurn.mock.calls[0]?.[0]?.confinedRole).toBe('reviewer');
  });

  it('leases the common git directory of the repo with the working folder', async () => {
    const holders = fakeRegistry();
    storySpies.gitCommonDirectory.mockResolvedValue('/repo/api/.git');
    let scratchCount = 0;
    storySpies.scratchDirPrepare.mockImplementation(async () => {
      scratchCount += 1;
      return `/tmp/goodboy-root/scratch/${scratchCount}`;
    });
    const other = await startAgent('generic');
    useAppStore.setState({
      sessionProjectMounts: {
        [first.sessionId]: [repoMount({ sessionId: first.sessionId, name: 'first' })],
        [other.sessionId]: [repoMount({ sessionId: other.sessionId, name: 'second' })],
      },
    });
    const hold = gate();
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      heldStream({ runId, hold: hold.opened }),
    );

    const firstTurn = send(first);
    await vi.waitFor(() => expect(holders.get('/repo/api/.git')).toBe(first.agentId));
    const secondTurn = send(other);
    await vi.waitFor(() => expect(waitOf(other.agentId)).toBeDefined());

    expect(waitOf(other.agentId)?.blockedPath).toBe('/repo/api/.git');
    expect(storySpies.runTurn).toHaveBeenCalledOnce();
    hold.open();
    await firstTurn;
    await secondTurn;
    expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
  });
});

describe('outside an Auto tree writers are leased exactly as before', () => {
  it('takes no write set lease for a generalist turn and never waits', async () => {
    await sendOutsideAuto(first);

    expect(storySpies.acquireWriteSet).not.toHaveBeenCalled();
    expect(storySpies.releaseWriteSet).not.toHaveBeenCalled();
    expect(storySpies.runTurn.mock.calls[0]?.[0]?.writeSetLease).toBeUndefined();
    expect(storySpies.runTurn.mock.calls[0]?.[0]?.confinedRole).toBeUndefined();
    expect(waitOf(first.agentId)).toBeUndefined();
  });

  it('starts two generalists at once in two worktrees of one repo', async () => {
    storySpies.gitCommonDirectory.mockResolvedValue('/repo/api/.git');
    const other = await startAgent('generic');
    useAppStore.setState({
      sessionProjectMounts: {
        [first.sessionId]: [repoMount({ sessionId: first.sessionId, name: 'first' })],
        [other.sessionId]: [repoMount({ sessionId: other.sessionId, name: 'second' })],
      },
    });
    const hold = gate();
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      heldStream({ runId, hold: hold.opened }),
    );

    const firstTurn = sendOutsideAuto(first);
    const secondTurn = sendOutsideAuto(other);
    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledTimes(2));

    expect(storySpies.acquireWriteSet).not.toHaveBeenCalled();
    hold.open();
    await firstTurn;
    await secondTurn;
  });

  it('hands the CLI the sibling worktrees and the git directory, exactly as before', async () => {
    storySpies.gitCommonDirectory.mockResolvedValue('/repo/api/.git');
    useAppStore.setState({
      sessionProjectMounts: {
        [first.sessionId]: [
          repoMount({ sessionId: first.sessionId, name: 'first' }),
          repoMount({ sessionId: first.sessionId, name: 'second' }),
        ],
      },
    });

    await sendOutsideAuto(first);

    const spawn = storySpies.runTurn.mock.calls[0]?.[0];
    expect(spawn?.writableRoots).toEqual(['/repo/api/.goodboy/worktrees/second', '/repo/api/.git']);
    expect(spawn?.workingDir).toBe('/repo/api/.goodboy/worktrees/first');
  });

  it('also hands the CLI the git directory of each linked worktree it writes', async () => {
    storySpies.gitCommonDirectory.mockResolvedValue('/repo/api/.git');
    storySpies.worktreeGitDirectory.mockImplementation(async ({ worktreePath }) => {
      const name = worktreePath.split('/').pop();
      return `/repo/api/.git/worktrees/${name}`;
    });
    useAppStore.setState({
      sessionProjectMounts: {
        [first.sessionId]: [
          repoMount({ sessionId: first.sessionId, name: 'first' }),
          repoMount({ sessionId: first.sessionId, name: 'second' }),
        ],
      },
    });

    await sendOutsideAuto(first);

    const spawn = storySpies.runTurn.mock.calls[0]?.[0];
    expect(spawn?.writableRoots).toEqual([
      '/repo/api/.goodboy/worktrees/second',
      '/repo/api/.git',
      '/repo/api/.git/worktrees/first',
      '/repo/api/.git/worktrees/second',
    ]);
    expect(storySpies.worktreeGitDirectory).toHaveBeenCalledWith({
      worktreePath: '/repo/api/.goodboy/worktrees/first',
    });
  });
});
