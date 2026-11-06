import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import { aWorkflowRun, nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import {
  brandId,
  type AgentId,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
} from '@goodboy/types';
import { cancelledRunIds } from '../../slices/sessions/sessionMutators';
import { summarizerQueues } from '../../slices/turn/turnHelpers';
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
} from '../../storyHarness';
import { stopWork } from './stopWork';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
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
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);

const workspace = buildStoryWorkspace({
  id: nextWorkspaceId(),
  name: 'Harborline',
  slug: 'harborline',
});

let useAppStore: StoryStore;
let sessionId: SessionId;
let agentId: AgentId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type GateHandle = Readonly<{
  opened: Promise<void>;
  open: () => void;
}>;

const gate = (): GateHandle => {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
};

type StreamParams = Readonly<{
  runId: ProviderRunId;
  hold: Promise<void>;
}>;

const heldStream = ({ runId, hold }: StreamParams) =>
  (async function* stream(): AsyncIterable<TurnEvent> {
    yield { kind: 'assistant_text', runId, delta: 'Reading the ledger-core export', at: TEST_NOW };
    await hold;
  })();

const agentStatus = async (): Promise<string | undefined> =>
  (
    await rowsOf<{ status: string }>({
      sql: 'SELECT status FROM agents WHERE id = ?',
      params: [agentId],
    })
  )[0]?.status;

const errorTitles = async (): Promise<ReadonlyArray<string>> =>
  (
    await rowsOf<{ title: string }>({ sql: "SELECT title FROM notifications WHERE kind = 'error'" })
  ).map((row) => row.title);

const runningRunId = (): ProviderRunId => {
  const turn = useAppStore.getState().agentTurnState[agentId];
  if (turn?.kind !== 'running') {
    throw new Error('the agent is not running');
  }
  return turn.runId;
};

type RunArgs = Readonly<{
  runId: ProviderRunId;
}>;

type StartParams = Readonly<{
  hold: Promise<void>;
}>;

type Streaming = Readonly<{
  pending: Promise<unknown>;
}>;

const startStreaming = async ({ hold }: StartParams): Promise<Streaming> => {
  storySpies.runTurn.mockImplementation(({ runId }: RunArgs) => heldStream({ runId, hold }));
  const pending = useAppStore.getState().sendTurn({
    sessionId,
    agentId,
    content: 'Reconcile the Harborline ledger export',
  });
  await vi.waitFor(() =>
    expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('running'),
  );
  return { pending };
};

const stopSession = () =>
  stopWork({
    getState: useAppStore.getState,
    scope: { kind: 'session', sessionId },
    reason: 'user',
  });

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
  const routingMod = await import('../../../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.listLiveRunIds.mockResolvedValue(new Set<string>());
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal: 'Reconcile the Harborline ledger export',
    firstAgentKind: 'generic',
  });
  sessionId = session.id;
  const [agent] = useAppStore.getState().sessionPhaseRuns[sessionId] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
  }
  agentId = agent.id;
});

afterEach(async () => {
  vi.useRealTimers();
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

describe('stopWork', () => {
  it('stops a running turn, waits for the process, and counts it', async () => {
    const hold = gate();
    const live = new Set<string>();
    storySpies.listLiveRunIds.mockImplementation(async () => live);
    storySpies.cancelTurn.mockImplementation(async () => {
      live.clear();
      hold.open();
    });
    const { pending } = await startStreaming({ hold: hold.opened });
    live.add(runningRunId());

    const result = await stopSession();

    expect(result).toEqual({ stopped: 1, stillRunning: 0 });
    expect(await agentStatus()).toBe('stopped');
    expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('idle');
    await pending;
  });

  it('stops a permission wait: the agent reads stopped and idle, and the count holds it', async () => {
    useAppStore.setState({
      agentTurnState: {
        [agentId]: {
          kind: 'blocked',
          runId: brandId<ProviderRunId>({ value: 'run-permission' }),
          blockedAt: TEST_NOW,
        },
      },
    });

    const result = await stopSession();

    expect(storySpies.cancelTurn).toHaveBeenCalledWith('run-permission');
    expect(result).toEqual({ stopped: 1, stillRunning: 0 });
    expect(await agentStatus()).toBe('stopped');
    expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('idle');
  });

  it('keeps a failed cancel running, reports it, and never counts it as stopped', async () => {
    const hold = gate();
    const live = new Set<string>();
    storySpies.listLiveRunIds.mockImplementation(async () => live);
    storySpies.cancelTurn.mockRejectedValue(new Error('kill refused'));
    const { pending } = await startStreaming({ hold: hold.opened });
    const runId = runningRunId();
    live.add(runId);

    const result = await stopSession();

    expect(result).toEqual({ stopped: 0, stillRunning: 1 });
    expect(useAppStore.getState().agentTurnState[agentId]).toEqual(
      expect.objectContaining({ kind: 'running', runId }),
    );
    expect(await agentStatus()).toBe('running');
    expect(await errorTitles()).toEqual(["Couldn't stop the agent"]);
    hold.open();
    await pending;
  });

  it('counts a process that outlives the wait as still running', async () => {
    const hold = gate();
    const { pending } = await startStreaming({ hold: hold.opened });
    const runId = runningRunId();
    storySpies.listLiveRunIds.mockResolvedValue(new Set([runId]));
    vi.useFakeTimers({ toFake: ['setTimeout'] });

    const stopping = stopSession();
    await vi.advanceTimersByTimeAsync(5000);
    const result = await stopping;
    vi.useRealTimers();

    expect(result).toEqual({ stopped: 0, stillRunning: 1 });
    expect(useAppStore.getState().agentTurnState[agentId]).toEqual(
      expect.objectContaining({ kind: 'running', runId }),
    );
    hold.open();
    await pending;
  });

  it('leaving a workspace mid reply reads Stopped by you, never Done, and adds no provider error', async () => {
    const hold = gate();
    const live = new Set<string>();
    storySpies.listLiveRunIds.mockImplementation(async () => live);
    storySpies.cancelTurn.mockImplementation(async () => {
      live.clear();
      hold.open();
    });
    storySpies.runTurn.mockImplementation(() =>
      (async function* silent(): AsyncIterable<TurnEvent> {
        await hold.opened;
      })(),
    );
    const append = vi.spyOn(useAppStore.getState(), 'appendTurnEvent');
    const pending = useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'Reconcile the Harborline ledger export',
    });
    await vi.waitFor(() =>
      expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('running'),
    );
    live.add(runningRunId());

    const result = await stopWork({
      getState: useAppStore.getState,
      scope: { kind: 'all' },
      reason: 'leave',
    });
    await pending;

    expect(result).toEqual({ stopped: 1, stillRunning: 0 });
    expect(await agentStatus()).toBe('stopped');
    const stoppedBy = await rowsOf<{ stopped_by: string | null }>({
      sql: 'SELECT stopped_by FROM agents WHERE id = ?',
      params: [agentId],
    });
    expect(stoppedBy[0]?.stopped_by).toBe('you');
    const errors = append.mock.calls.filter(([, , event]) => event.kind === 'error');
    expect(errors).toEqual([]);
  });

  describe('a permission wait on leaving', () => {
    const waitingRun = brandId<ProviderRunId>({ value: 'run-permission' });

    const seedWaiting = () => {
      cancelledRunIds.delete(waitingRun);
      useAppStore.setState((state) => ({
        agentTurnState: {
          [agentId]: { kind: 'blocked', runId: waitingRun, blockedAt: TEST_NOW },
        },
        sessions: state.sessions.map((session) => ({
          ...session,
          state: { kind: 'running', runId: waitingRun, startedAt: TEST_NOW },
        })),
      }));
    };

    const stoppedBy = async (): Promise<string | null | undefined> =>
      (
        await rowsOf<{ stopped_by: string | null }>({
          sql: 'SELECT stopped_by FROM agents WHERE id = ?',
          params: [agentId],
        })
      )[0]?.stopped_by;

    it('keeps the ask of a run that ended, so it is still there on return', async () => {
      seedWaiting();
      const statusBefore = await agentStatus();

      const result = await stopWork({
        getState: useAppStore.getState,
        scope: { kind: 'all' },
        reason: 'leave',
      });

      expect(result).toEqual({ stopped: 0, stillRunning: 0 });
      expect(storySpies.cancelTurn).not.toHaveBeenCalled();
      expect(cancelledRunIds.has(waitingRun)).toBe(false);
      expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('blocked');
      expect(await agentStatus()).toBe(statusBefore);
      expect(await stoppedBy()).toBeNull();
    });

    it('stops the ask when the live list cannot be read, so Stop never leaves a live agent', async () => {
      seedWaiting();
      storySpies.listLiveRunIds.mockRejectedValueOnce(new Error('the app is busy'));

      const result = await stopWork({
        getState: useAppStore.getState,
        scope: { kind: 'all' },
        reason: 'leave',
      });

      expect(result).toEqual({ stopped: 1, stillRunning: 0 });
      expect(storySpies.cancelTurn).toHaveBeenCalledWith(waitingRun);
      expect(await stoppedBy()).toBe('you');
    });

    it('stops a wait whose process is still alive', async () => {
      seedWaiting();
      const live = new Set<string>([waitingRun]);
      storySpies.listLiveRunIds.mockImplementation(async () => live);
      storySpies.cancelTurn.mockImplementation(async () => {
        live.clear();
      });

      const result = await stopWork({
        getState: useAppStore.getState,
        scope: { kind: 'all' },
        reason: 'leave',
      });

      expect(result).toEqual({ stopped: 1, stillRunning: 0 });
      expect(storySpies.cancelTurn).toHaveBeenCalledWith(waitingRun);
      expect(await stoppedBy()).toBe('you');
    });

    it('stops a running agent and keeps the ended ask of another one', async () => {
      const other = await useAppStore.getState().createSession({
        workspaceId: workspace.id,
        goal: 'Retry the notify-relay webhook',
        firstAgentKind: 'generic',
      });
      const [otherAgent] = useAppStore.getState().sessionPhaseRuns[other.session.id] ?? [];
      if (otherAgent === undefined) {
        throw new Error('createSession left no agent');
      }
      const hold = gate();
      const live = new Set<string>();
      storySpies.listLiveRunIds.mockImplementation(async () => live);
      storySpies.cancelTurn.mockImplementation(async () => {
        live.clear();
        hold.open();
      });
      const { pending } = await startStreaming({ hold: hold.opened });
      const runId = runningRunId();
      live.add(runId);
      useAppStore.setState((state) => ({
        agentTurnState: {
          ...state.agentTurnState,
          [otherAgent.id]: { kind: 'blocked', runId: waitingRun, blockedAt: TEST_NOW },
        },
      }));

      const result = await stopWork({
        getState: useAppStore.getState,
        scope: { kind: 'all' },
        reason: 'leave',
      });
      await pending;

      expect(result).toEqual({ stopped: 1, stillRunning: 0 });
      expect(storySpies.cancelTurn.mock.calls).toEqual([[runId]]);
      expect(useAppStore.getState().agentTurnState[otherAgent.id]?.kind).toBe('blocked');
    });

    it('still stops an ended ask when one session is archived', async () => {
      seedWaiting();

      const result = await stopWork({
        getState: useAppStore.getState,
        scope: { kind: 'session', sessionId },
        reason: 'leave',
      });

      expect(result).toEqual({ stopped: 1, stillRunning: 0 });
      expect(await agentStatus()).toBe('stopped');
      expect(await stoppedBy()).toBe('you');
      expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('idle');
    });
  });

  it('counts a deciding run that did not stop as still running', async () => {
    const run = aWorkflowRun();
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId ? { ...session, workflowRuns: [run] } : session,
      ),
      orchestratingWorkflowRuns: { [run.id]: true },
      stopWorkflowRunNow: vi.fn(async () => 'still_running' as const),
    }));

    const result = await stopSession();

    expect(result.stillRunning).toBe(1);
  });

  it('leaves another session alone when the scope is one session', async () => {
    const other = await useAppStore.getState().createSession({
      workspaceId: workspace.id,
      goal: 'Retry the notify-relay webhook',
      firstAgentKind: 'generic',
    });
    const [otherAgent] = useAppStore.getState().sessionPhaseRuns[other.session.id] ?? [];
    if (otherAgent === undefined) {
      throw new Error('createSession left no agent');
    }
    useAppStore.setState({
      agentTurnState: {
        [otherAgent.id]: {
          kind: 'blocked',
          runId: brandId<ProviderRunId>({ value: 'run-elsewhere' }),
          blockedAt: TEST_NOW,
        },
      },
    });

    const result = await stopSession();

    expect(result).toEqual({ stopped: 0, stillRunning: 0 });
    expect(storySpies.cancelTurn).not.toHaveBeenCalled();
    expect(useAppStore.getState().agentTurnState[otherAgent.id]?.kind).toBe('blocked');
  });
});
