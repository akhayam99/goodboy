import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertAgent, insertWorkspace } from '@goodboy/db';
import { nextAgentId, nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import type { AgentId, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { cancelledRunIds } from './slices/sessions/sessionMutators';
import { invokeAgentList } from '../features/workflows/workflows';
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
  storySqlite,
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
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
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
const WORKSPACE_ID = workspace.id;

let useAppStore: StoryStore;
let sessionId: SessionId;
let agentId: AgentId;

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

const send = (target: AgentId = agentId) =>
  useAppStore.getState().sendTurn({
    sessionId,
    agentId: target,
    content: 'Reconcile the Harborline ledger export',
  });

const agentStatus = async (target: AgentId = agentId) =>
  (
    await rowsOf<{ status: string }>({
      sql: 'SELECT status FROM agents WHERE id = ?',
      params: [target],
    })
  )[0]?.status;

const errorTitles = async () =>
  (
    await rowsOf<{ title: string }>({ sql: "SELECT title FROM notifications WHERE kind = 'error'" })
  ).map((row) => row.title);

const runningRunId = (target: AgentId = agentId): ProviderRunId => {
  const turn = useAppStore.getState().agentTurnState[target];
  if (turn?.kind !== 'running') {
    throw new Error('the agent is not running');
  }
  return turn.runId;
};

const startStreaming = async (hold: Promise<void>, target: AgentId = agentId) => {
  storySpies.runTurn.mockImplementation(({ runId }: RunArgs) => heldStream({ runId, hold }));
  const pending = send(target);
  await vi.waitFor(() =>
    expect(useAppStore.getState().agentTurnState[target]?.kind).toBe('running'),
  );
  await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledOnce());
  return { pending };
};

beforeEach(async () => {
  await resetStoryStore();
  await insertWorkspace({ db: await openStorySqlite(), workspace });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
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
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.listLiveRunIds.mockResolvedValue(new Set<string>());
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
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

describe('a real Stop on sqlite', () => {
  it('reports exited once the process is gone and leaves the agent stopped and idle', async () => {
    const hold = gate();
    const live = new Set<string>();
    storySpies.listLiveRunIds.mockImplementation(async () => live);
    storySpies.cancelTurn.mockImplementation(async () => {
      live.clear();
      hold.open();
    });
    const { pending } = await startStreaming(hold.opened);
    live.add(runningRunId());

    const result = await useAppStore
      .getState()
      .cancelTurnConfirmed({ sessionId, agentId, reason: 'user' });

    expect(result.outcome).toBe('exited');
    expect(result.exitedAt).not.toBeNull();
    expect(await agentStatus()).toBe('stopped');
    expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('idle');
    await pending;
  });

  it('stays running when the cancel fails and the process is alive, shows the error, and a second press stops it', async () => {
    const hold = gate();
    const live = new Set<string>();
    storySpies.listLiveRunIds.mockImplementation(async () => live);
    storySpies.cancelTurn.mockRejectedValueOnce(new Error('kill refused'));
    storySpies.cancelTurn.mockImplementation(async () => {
      live.clear();
      hold.open();
    });
    const { pending } = await startStreaming(hold.opened);
    const runId = runningRunId();
    live.add(runId);

    await useAppStore.getState().cancelCurrentTurn(sessionId, agentId, 'user');

    expect(useAppStore.getState().agentTurnState[agentId]).toEqual(
      expect.objectContaining({ kind: 'running', runId }),
    );
    expect(await agentStatus()).toBe('running');
    expect(await errorTitles()).toEqual(["Couldn't stop the agent"]);

    await useAppStore.getState().cancelCurrentTurn(sessionId, agentId, 'user');

    expect(storySpies.cancelTurn).toHaveBeenCalledTimes(2);
    expect(await agentStatus()).toBe('stopped');
    expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('idle');
    await pending;
  });

  it('keeps the turn in progress with a warning while the process outlives the wait', async () => {
    const hold = gate();
    const { pending } = await startStreaming(hold.opened);
    const runId = runningRunId();
    storySpies.listLiveRunIds.mockResolvedValue(new Set([runId]));
    vi.useFakeTimers({ toFake: ['setTimeout'] });

    const stopping = useAppStore
      .getState()
      .cancelTurnConfirmed({ sessionId, agentId, reason: 'user' });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await stopping;
    vi.useRealTimers();

    expect(result).toEqual({ outcome: 'still_running', exitedAt: null });
    expect(useAppStore.getState().agentTurnState[agentId]).toEqual(
      expect.objectContaining({ kind: 'running', runId }),
    );
    expect(await errorTitles()).toEqual(["The agent hasn't stopped yet"]);
    hold.open();
    await pending;
  });

  it('treats a refused cancel as exited when the process is already gone', async () => {
    const hold = gate();
    storySpies.cancelTurn.mockImplementation(async () => {
      hold.open();
      throw new Error('turn not found');
    });
    const { pending } = await startStreaming(hold.opened);

    const result = await useAppStore
      .getState()
      .cancelTurnConfirmed({ sessionId, agentId, reason: 'user' });

    expect(result.outcome).toBe('exited');
    expect(await errorTitles()).toEqual([]);
    await pending;
  });

  it('does nothing and reports exited when the agent has no turn running', async () => {
    const result = await useAppStore
      .getState()
      .cancelTurnConfirmed({ sessionId, agentId, reason: 'user' });

    expect(result.outcome).toBe('exited');
    expect(storySpies.cancelTurn).not.toHaveBeenCalled();
    expect(await agentStatus()).toBe('pending');
  });
});

const seedScoutTree = async () => {
  const db = storySqlite();
  const parent = nextAgentId();
  const stopped = nextAgentId();
  const sibling = nextAgentId();
  const base = { sessionId, kind: 'scout' as const, status: 'running' as const };
  await insertAgent(db, { ...base, id: parent, ordinal: 10, name: 'Harborline audit' });
  await insertAgent(db, {
    ...base,
    id: stopped,
    ordinal: 11,
    name: 'ledger-core',
    parentAgentId: parent,
  });
  await insertAgent(db, {
    ...base,
    id: sibling,
    ordinal: 12,
    name: 'payments-api',
    parentAgentId: parent,
  });
  const runs = await invokeAgentList(sessionId);
  useAppStore.setState((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: runs },
  }));
  return { parent, stopped, sibling };
};

const spyOnSynthesis = () => {
  const synthesis = vi.fn<ReturnType<StoryStore['getState']>['sendTurn']>(async () => ({
    blockedOverBudget: false,
  }));
  useAppStore.setState({ sendTurn: synthesis });
  return synthesis;
};

const settleSibling = (sibling: AgentId) =>
  useAppStore.getState().advanceScoutTree(sessionId, sibling, 'payments-api reads clean');

describe('a Stop inside a scout fan-out', () => {
  let realSendTurn: ReturnType<StoryStore['getState']>['sendTurn'];

  beforeEach(() => {
    realSendTurn = useAppStore.getState().sendTurn;
  });

  afterEach(() => {
    useAppStore.setState({ sendTurn: realSendTurn });
  });

  it('starts the parent synthesis only after the stopped child has exited', async () => {
    const hold = gate();
    const live = new Set<string>();
    storySpies.listLiveRunIds.mockImplementation(async () => live);
    const tree = await seedScoutTree();
    const { pending } = await startStreaming(hold.opened, tree.stopped);
    live.add(runningRunId(tree.stopped));
    const synthesis = spyOnSynthesis();

    const stopping = useAppStore
      .getState()
      .cancelTurnConfirmed({ sessionId, agentId: tree.stopped, reason: 'user' });
    await settleSibling(tree.sibling);

    expect(await agentStatus(tree.stopped)).toBe('running');
    expect(synthesis).not.toHaveBeenCalled();

    live.clear();
    hold.open();
    const result = await stopping;

    expect(result.outcome).toBe('exited');
    expect(await agentStatus(tree.stopped)).toBe('stopped');
    await vi.waitFor(() => expect(synthesis).toHaveBeenCalledTimes(1));
    expect(synthesis.mock.calls[0]?.[0]).toMatchObject({ agentId: tree.parent });
    expect(synthesis.mock.calls[0]?.[0].content).toContain('payments-api');
    await pending;
  });

  it('keeps the child running and the parent waiting when the cancel fails', async () => {
    const hold = gate();
    const live = new Set<string>();
    storySpies.listLiveRunIds.mockImplementation(async () => live);
    storySpies.cancelTurn.mockRejectedValue(new Error('kill refused'));
    const tree = await seedScoutTree();
    const { pending } = await startStreaming(hold.opened, tree.stopped);
    const runId = runningRunId(tree.stopped);
    live.add(runId);
    const synthesis = spyOnSynthesis();

    const result = await useAppStore
      .getState()
      .cancelTurnConfirmed({ sessionId, agentId: tree.stopped, reason: 'user' });
    await settleSibling(tree.sibling);

    expect(result.outcome).toBe('failed');
    expect(await agentStatus(tree.stopped)).toBe('running');
    expect(useAppStore.getState().agentTurnState[tree.stopped]).toEqual(
      expect.objectContaining({ kind: 'running', runId }),
    );
    expect(synthesis).not.toHaveBeenCalled();
    hold.open();
    await pending;
  });

  it('holds the join while a child that reads as ended still has a live run', async () => {
    const hold = gate();
    const tree = await seedScoutTree();
    const { pending } = await startStreaming(hold.opened, tree.stopped);
    await useAppStore
      .getState()
      .advanceScoutTree(sessionId, tree.stopped, 'ledger-core reads clean');
    const synthesis = spyOnSynthesis();

    await settleSibling(tree.sibling);

    expect(await agentStatus(tree.stopped)).toBe('completed');
    expect(synthesis).not.toHaveBeenCalled();
    hold.open();
    await pending;
  });
});

describe('a Stop that cannot confirm the exit', () => {
  it('fails, forgets the cancel and leaves the turn running when the live list throws', async () => {
    const hold = gate();
    storySpies.cancelTurn.mockRejectedValue(new Error('kill refused'));
    storySpies.listLiveRunIds.mockRejectedValue(new Error('process list unavailable'));
    const { pending } = await startStreaming(hold.opened);
    const runId = runningRunId();

    const result = await useAppStore
      .getState()
      .cancelTurnConfirmed({ sessionId, agentId, reason: 'user' });

    expect(result).toEqual({ outcome: 'failed', exitedAt: null });
    expect(cancelledRunIds.has(runId)).toBe(false);
    expect(await agentStatus()).toBe('running');
    expect(useAppStore.getState().agentTurnState[agentId]).toEqual(
      expect.objectContaining({ kind: 'running', runId }),
    );
    expect(await errorTitles()).toEqual(["Couldn't stop the agent"]);
    hold.open();
    await pending;
  });

  it('fails the same way when the wait for the exit cannot read the live list', async () => {
    const hold = gate();
    const { pending } = await startStreaming(hold.opened);
    const runId = runningRunId();
    storySpies.listLiveRunIds.mockRejectedValue(new Error('process list unavailable'));

    const result = await useAppStore
      .getState()
      .cancelTurnConfirmed({ sessionId, agentId, reason: 'user' });

    expect(result.outcome).toBe('failed');
    expect(cancelledRunIds.has(runId)).toBe(false);
    expect(await agentStatus()).toBe('running');
    hold.open();
    await pending;
  });

  it('keeps the queue draining after a failed stop once the turn ends', async () => {
    const hold = gate();
    storySpies.cancelTurn.mockRejectedValue(new Error('kill refused'));
    storySpies.listLiveRunIds.mockResolvedValue(new Set(['pinned']));
    const { pending } = await startStreaming(hold.opened);
    storySpies.listLiveRunIds.mockResolvedValue(new Set([runningRunId()]));
    await useAppStore.getState().enqueueAgentMessage({
      turn: {
        id: 'queued-1',
        agentId,
        content: 'Send the Northwind totals',
        attachments: [],
        override: undefined,
      },
    });

    await useAppStore.getState().cancelCurrentTurn(sessionId, agentId, 'user');
    expect(await agentStatus()).toBe('running');
    hold.open();
    await pending;

    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledTimes(2));
    expect(useAppStore.getState().agentQueue[agentId] ?? []).toEqual([]);
  });

  it('keeps the queue draining after a stop that outlived the wait once the turn ends', async () => {
    const hold = gate();
    const { pending } = await startStreaming(hold.opened);
    storySpies.listLiveRunIds.mockResolvedValue(new Set([runningRunId()]));
    await useAppStore.getState().enqueueAgentMessage({
      turn: {
        id: 'queued-1',
        agentId,
        content: 'Send the Northwind totals',
        attachments: [],
        override: undefined,
      },
    });
    vi.useFakeTimers({ toFake: ['setTimeout'] });

    const stopping = useAppStore
      .getState()
      .cancelTurnConfirmed({ sessionId, agentId, reason: 'user' });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await stopping;
    vi.useRealTimers();

    expect(result.outcome).toBe('still_running');
    expect(await agentStatus()).toBe('running');
    hold.open();
    await pending;

    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledTimes(2));
    expect(useAppStore.getState().agentQueue[agentId] ?? []).toEqual([]);
  });
});
