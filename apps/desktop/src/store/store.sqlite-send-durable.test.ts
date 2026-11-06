import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertAgent,
  insertWorkspace,
  listAgentsForSessions,
  recordAgentStatus,
  replaceAgentQueuedMessages,
} from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type StepId,
  type TurnEvent,
  type Workflow,
  type WorkflowId,
  type WorkspaceId,
} from '@goodboy/types';
import type { AgentInsertArgs } from '../features/workflows/workflows';
import { CommandError } from '../shared/lib/invokeCommand';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { cancelTurnStartWindow, ensureTurnStartWindow } from './slices/turn/turnStartWindow';
import { handDelivery } from './slices/turn/handDelivery';
import { markTurnSettled } from './slices/turn/turnSettled';
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
  STORY_NOW,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => {
  const actual =
    await vi.importActual<typeof import('../features/chat/turn')>('../features/chat/turn');
  return {
    ...(await import('./storyHarness')).turnModuleMock(),
    encodeAuthRequiredMessage: actual.encodeAuthRequiredMessage,
    decodeAuthRequiredMessage: actual.decodeAuthRequiredMessage,
    decodeCliTooOldMessage: actual.decodeCliTooOldMessage,
  };
});
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
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const isSessionId = (value: unknown): value is SessionId => typeof value === 'string';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline-send' });
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-durable-send' });
const AT = brandId<IsoDateTime>({ value: '2026-11-06T09:30:00.000Z' });
const TEXT = 'Also cover the 402 path in payments-api, then run the replay again.';
const LIMIT = 'Every provider is over its limit. Change a limit or wait for the next period.';
const WRITTEN_COUNT_NOT_SAVED = "The message couldn't be saved, so it was not sent.";

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline-send',
});

const template: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Replay one webhook event',
  description: '',
  steps: [
    {
      id: brandId<StepId>({ value: 'step-send-0' }),
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Tester',
      role: 'tester',
      promptPrefix: 'Replay one event three times against notify-relay',
    },
  ],
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
};

let useAppStore: StoryStore;
let sessionId: SessionId;
let agentId: AgentId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type RunArgs = { readonly runId: ProviderRunId };

const routeTo = async ({ reason }: { readonly reason: 'preferred' | 'all-exceeded' }) => {
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason,
    fallbackUsed: false,
  });
};

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [WORKFLOW_ID, WORKSPACE_ID, template.name],
  );
  for (const step of template.steps) {
    await db.execute(
      'INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix) VALUES (?, ?, ?, ?, ?)',
      [step.id, WORKFLOW_ID, step.ordinal, step.name, step.promptPrefix],
    );
  }
  useAppStore.setState({
    workspaces: [harborline],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [],
    sessions: [],
    archivedSessions: {},
    phaseTemplates: { [WORKSPACE_ID]: [template] },
    ...connectedAnthropicState(),
  });
  await routeTo({ reason: 'preferred' });
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({
    workspaces_with_unread: [],
    gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 },
  });
  storySpies.invokeAgentInsert.mockImplementation((run: AgentInsertArgs) =>
    insertAgent(storySqlite(), run),
  );
  storySpies.invokeAgentList.mockImplementation(async (id: unknown) => {
    if (!isSessionId(id)) {
      return [];
    }
    return [...((await listAgentsForSessions(storySqlite(), [id])).get(id) ?? [])];
  });
  storySpies.invokeAgentUpdateStatus.mockImplementation((id: AgentId, fields) =>
    recordAgentStatus(storySqlite(), id, fields),
  );
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Replay one webhook event',
  });
  sessionId = session.id;
  await useAppStore
    .getState()
    .attachWorkflowToSession(sessionId, WORKFLOW_ID, { autoRun: false, triggerMode: 'manual' });
  const tester = (useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.name === 'Tester',
  );
  if (tester === undefined) {
    throw new Error('the workflow left no Tester agent');
  }
  agentId = tester.id;
  storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
    (async function* stream(): AsyncIterable<TurnEvent> {
      yield { kind: 'assistant_text', runId, delta: 'Replayed three times.', at: AT };
    })(),
  );
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

const send = (id: string) =>
  useAppStore.getState().sendAgentMessage({
    sessionId,
    turn: { id, agentId, content: TEXT, attachments: [], override: undefined },
  });

const savedQueue = async () =>
  (
    await rowsOf<{ id: string }>({
      sql: 'SELECT id FROM agent_queued_messages WHERE agent_id = ?',
      params: [agentId],
    })
  ).map((row) => row.id);

const rows = () =>
  (useAppStore.getState().agentQueue[agentId] ?? []).map((item) => ({
    id: item.id,
    status: item.status,
    reason: item.hold?.reason ?? null,
  }));

const forgetMemory = () => useAppStore.setState({ agentQueue: {} });

const userTexts = async () =>
  (
    await rowsOf<{ count: number }>({
      sql: "SELECT COUNT(*) AS count FROM turn_events WHERE agent_id = ? AND json_extract(payload, '$.kind') = 'user_text'",
      params: [agentId],
    })
  )[0]?.count ?? 0;

const resetDelivery = () => {
  handDelivery.release({ deliveryId: 'queue:send-13' });
  markTurnSettled({ agentId });
};

const stopAgent = () =>
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
        agent.id === agentId ? { ...agent, status: 'stopped' } : agent,
      ),
    },
  }));

type HeldHeadParams = {
  readonly head: string;
  readonly behind: string;
};

describe('Send writes the row, then delivers', () => {
  it('delivers a message to an idle agent once and leaves no row', async () => {
    const delivery = await send('send-1');

    expect(delivery).toEqual({ isDelivered: true, failure: null });
    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(rows()).toEqual([]);
    expect(await savedQueue()).toEqual([]);
  });

  it('keeps a refused message as a saved row with the limit as its reason', async () => {
    await routeTo({ reason: 'all-exceeded' });

    const delivery = await send('send-2');

    expect(delivery).toEqual({ isDelivered: false, failure: null });
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(rows()).toEqual([{ id: 'send-2', status: 'queued', reason: LIMIT }]);
    expect(await savedQueue()).toEqual(['send-2']);
  });

  it('delivers a refused message once on Retry, after the limit is lifted', async () => {
    await routeTo({ reason: 'all-exceeded' });
    await send('send-3');
    await routeTo({ reason: 'preferred' });

    const retried = await useAppStore
      .getState()
      .retryQueuedMessage({ sessionId, agentId, itemId: 'send-3' });
    const again = await useAppStore
      .getState()
      .retryQueuedMessage({ sessionId, agentId, itemId: 'send-3' });

    expect(retried.isDelivered).toBe(true);
    expect(again.isDelivered).toBe(false);
    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(await savedQueue()).toEqual([]);
  });

  it('forces the held message through routing on Send anyway', async () => {
    await routeTo({ reason: 'all-exceeded' });
    await send('send-9');
    await routeTo({ reason: 'preferred' });
    const routingMod = await import('../features/providers/routing');

    await useAppStore
      .getState()
      .retryQueuedMessage({ sessionId, agentId, itemId: 'send-9', isForced: true });

    expect(vi.mocked(routingMod.resolveProviderForTurn)).toHaveBeenLastCalledWith(
      expect.objectContaining({ force: true }),
    );
    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
  });

  it('keeps a cancelled start as a row that says it did not start', async () => {
    ensureTurnStartWindow({ agentId });
    cancelTurnStartWindow({ agentId });

    await send('send-4');

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(rows()).toEqual([
      {
        id: 'send-4',
        status: 'queued',
        reason: 'The agent did not start. Your message is safe here.',
      },
    ]);
  });

  it('delivers to a stopped agent at once, since Send is direct', async () => {
    stopAgent();

    await send('send-5');

    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(rows()).toEqual([]);
  });

  it('keeps a held row held across a reload and sends it once on Retry', async () => {
    await routeTo({ reason: 'all-exceeded' });
    await send('send-6');
    forgetMemory();
    await routeTo({ reason: 'preferred' });

    await useAppStore.getState().loadAgentQueues(sessionId);
    expect(rows()).toEqual([{ id: 'send-6', status: 'queued', reason: LIMIT }]);
    await Promise.all([
      useAppStore.getState().drainSessionQueues({ sessionId }),
      useAppStore.getState().drainSessionQueues({ sessionId }),
    ]);
    expect(storySpies.runTurn).not.toHaveBeenCalled();

    await useAppStore.getState().retryQueuedMessage({ sessionId, agentId, itemId: 'send-6' });

    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(rows()).toEqual([]);
    expect(await savedQueue()).toEqual([]);
  });

  it('sends a saved row that was never held once after the load', async () => {
    await replaceAgentQueuedMessages(storySqlite(), {
      agentId,
      messages: [
        { id: 'send-10', agentId, content: TEXT, attachments: [], override: null, createdAt: AT },
      ],
    });

    await useAppStore.getState().loadAgentQueues(sessionId);
    await Promise.all([
      useAppStore.getState().drainSessionQueues({ sessionId }),
      useAppStore.getState().drainSessionQueues({ sessionId }),
    ]);

    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(rows()).toEqual([]);
    expect(await savedQueue()).toEqual([]);
  });

  it('never restarts a step the run cut as skipped', async () => {
    await replaceAgentQueuedMessages(storySqlite(), {
      agentId,
      messages: [
        { id: 'send-15', agentId, content: TEXT, attachments: [], override: null, createdAt: AT },
      ],
    });
    useAppStore.setState((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
          agent.id === agentId ? { ...agent, status: 'skipped' } : agent,
        ),
      },
    }));

    await useAppStore.getState().loadAgentQueues(sessionId);
    await useAppStore.getState().drainSessionQueues({ sessionId });

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(await savedQueue()).toEqual(['send-15']);
  });

  it('never drops a message on Retry after a cancelled start', async () => {
    ensureTurnStartWindow({ agentId });
    cancelTurnStartWindow({ agentId });
    await send('send-11');

    const retried = await useAppStore
      .getState()
      .retryQueuedMessage({ sessionId, agentId, itemId: 'send-11' });

    expect(retried.isDelivered).toBe(true);
    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(await savedQueue()).toEqual([]);
  });

  it('never drops a message whose turn failed after its text was written', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    storySpies.invokeAgentUpdateStatus.mockRejectedValueOnce(new Error('database is locked'));
    await send('send-12');
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(await savedQueue()).toEqual(['send-12']);
    forgetMemory();

    await useAppStore.getState().loadAgentQueues(sessionId);
    expect(rows().map((row) => row.status)).toEqual(['queued']);
    expect(rows()[0]?.reason).not.toBeNull();
    await useAppStore.getState().retryQueuedMessage({ sessionId, agentId, itemId: 'send-12' });

    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(await savedQueue()).toEqual([]);
    expect(logged).toHaveBeenCalledWith('resolvePhaseAgent failed', expect.any(Error));
    logged.mockRestore();
  });

  it('sends again after a reload while the turn was still being built', async () => {
    storySpies.invokeAgentUpdateStatus.mockImplementationOnce(() => new Promise(() => undefined));
    void send('send-13');
    await vi.waitFor(async () => expect(await userTexts()).toBe(1));
    expect(useAppStore.getState().agentQueue[agentId]?.[0]?.isTextShown).toBe(true);
    forgetMemory();
    resetDelivery();

    await useAppStore.getState().loadAgentQueues(sessionId);
    await useAppStore.getState().drainSessionQueues({ sessionId });

    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(await savedQueue()).toEqual([]);
  });

  it('does not leave the agent starting after a cancelled start', async () => {
    ensureTurnStartWindow({ agentId });
    cancelTurnStartWindow({ agentId });
    useAppStore.setState((state) => ({
      agentTurnState: {
        ...state.agentTurnState,
        [agentId]: { kind: 'starting', startedAt: AT },
      },
    }));

    await send('send-14');

    expect(useAppStore.getState().agentTurnState[agentId]?.kind).not.toBe('starting');
  });

  it('never sends twice when a delivered row comes back after a crash', async () => {
    await send('send-7');
    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    await replaceAgentQueuedMessages(storySqlite(), {
      agentId,
      messages: [
        {
          id: 'send-7',
          agentId,
          content: TEXT,
          attachments: [],
          override: null,
          createdAt: AT,
        },
      ],
    });
    forgetMemory();

    await useAppStore.getState().loadAgentQueues(sessionId);
    await useAppStore.getState().drainSessionQueues({ sessionId });

    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(rows()).toEqual([]);
    expect(await savedQueue()).toEqual([]);
  });

  it('leaves the queue of a stopped agent for Continue after a load', async () => {
    await routeTo({ reason: 'all-exceeded' });
    await send('send-8');
    forgetMemory();
    await routeTo({ reason: 'preferred' });
    stopAgent();

    await useAppStore.getState().loadAgentQueues(sessionId);
    await useAppStore.getState().drainSessionQueues({ sessionId });

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(rows()).toEqual([{ id: 'send-8', status: 'queued', reason: LIMIT }]);
  });

  it('writes no text and keeps the row when its count could not be saved', async () => {
    await storySqlite().execute(
      `CREATE TRIGGER refuse_written_count BEFORE INSERT ON agent_queued_messages
       WHEN json_extract(NEW.override_json, '$.queueState.writtenTexts') > 0
       BEGIN SELECT RAISE(ABORT, 'disk is full'); END`,
    );

    const delivery = await send('send-20');

    expect(delivery.isDelivered).toBe(false);
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(await userTexts()).toBe(0);
    expect(await savedQueue()).toEqual(['send-20']);
    expect(rows()[0]?.reason).toBe(WRITTEN_COUNT_NOT_SAVED);
    await storySqlite().execute('DROP TRIGGER refuse_written_count');
  });

  const holdHeadWithRowBehind = async ({ head, behind }: HeldHeadParams) => {
    await routeTo({ reason: 'all-exceeded' });
    await send(head);
    await routeTo({ reason: 'preferred' });
    await useAppStore.getState().enqueueAgentMessage({
      turn: { id: behind, agentId, content: TEXT, attachments: [], override: undefined },
    });
    expect(rows().map((row) => row.id)).toEqual([head, behind]);
    expect(storySpies.runTurn).not.toHaveBeenCalled();
  };

  it('sends the row behind a held head once the held row is deleted', async () => {
    await holdHeadWithRowBehind({ head: 'send-16', behind: 'send-17' });

    await useAppStore.getState().removeQueuedMessage({ sessionId, agentId, itemId: 'send-16' });

    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledTimes(1));
    await vi.waitFor(async () => expect(await savedQueue()).toEqual([]));
    expect(rows()).toEqual([]);
  });

  it('sends the row behind a held head once the held row is taken to edit', async () => {
    await holdHeadWithRowBehind({ head: 'send-18', behind: 'send-19' });

    const taken = useAppStore
      .getState()
      .takeQueuedMessage({ sessionId, agentId, itemId: 'send-18' });

    expect(taken?.id).toBe('send-18');
    await vi.waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledTimes(1));
    await vi.waitFor(async () => expect(await savedQueue()).toEqual([]));
    expect(rows()).toEqual([]);
  });
});

const DID_NOT_START = 'The agent did not start. Your message is safe here.';

const retry = (itemId: string) =>
  useAppStore.getState().retryQueuedMessage({ sessionId, agentId, itemId });

const stopTheAgent = () =>
  useAppStore.getState().cancelTurnConfirmed({ sessionId, agentId, reason: 'user' });

const agentRow = async () =>
  (
    await rowsOf<{ status: string; started_at: number | null }>({
      sql: 'SELECT status, started_at FROM agents WHERE id = ?',
      params: [agentId],
    })
  )[0];

const runStatuses = async () =>
  (
    await rowsOf<{ status_kind: string }>({
      sql: 'SELECT status_kind FROM provider_runs WHERE session_id = ?',
      params: [sessionId],
    })
  ).map((row) => row.status_kind);

const sessionKind = async () =>
  (
    await rowsOf<{ state_kind: string }>({
      sql: 'SELECT state_kind FROM sessions WHERE id = ?',
      params: [sessionId],
    })
  )[0]?.state_kind;

const sendCounting = () => {
  const onStarted = vi.fn();
  const sending = useAppStore.getState().sendTurn({
    sessionId,
    agentId,
    content: TEXT,
    origin: 'operator',
    onStarted,
  });
  return { onStarted, sending };
};

describe('Started means the process runs', () => {
  it('keeps the row when the process fails to start, and Retry delivers it once', async () => {
    storySpies.turnSpawn.mockRejectedValue(new Error('claude: command not found'));

    const delivery = await send('send-21');

    expect(delivery.isDelivered).toBe(false);
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(await savedQueue()).toEqual(['send-21']);
    expect(rows()).toEqual([
      { id: 'send-21', status: 'queued', reason: 'claude: command not found' },
    ]);
    expect(
      (useAppStore.getState().transcripts[agentId] ?? []).find((event) => event.kind === 'error'),
    ).toMatchObject({ retryable: false });

    storySpies.turnSpawn.mockResolvedValue('started');
    const retried = await retry('send-21');

    expect(retried.isDelivered).toBe(true);
    expect(storySpies.runTurn).toHaveBeenCalledTimes(1);
    expect(await savedQueue()).toEqual([]);
  });

  it('never fires the start when the process fails to start', async () => {
    storySpies.turnSpawn.mockRejectedValue(new Error('claude: command not found'));

    const { onStarted, sending } = sendCounting();

    await expect(sending).rejects.toThrow('claude: command not found');
    expect(onStarted).not.toHaveBeenCalled();
  });

  it('drops the row when another run already holds its delivery id', async () => {
    storySpies.turnSpawn.mockRejectedValueOnce(
      new CommandError({ kind: 'delivery_duplicate', message: 'already sent' }),
    );

    const delivery = await send('send-22');

    expect(delivery).toEqual({ isDelivered: true, failure: null });
    expect(await savedQueue()).toEqual([]);
  });

  it('fires the start once on the fallback when the first spawn failed', async () => {
    storySpies.turnSpawn.mockRejectedValueOnce(new Error('429 rate limit exceeded'));

    const { onStarted, sending } = sendCounting();
    await sending;

    expect(storySpies.turnSpawn).toHaveBeenCalledTimes(2);
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it('fires the start once when a started turn fails and falls back', async () => {
    storySpies.runTurn.mockImplementationOnce(() =>
      (async function* stream(): AsyncIterable<TurnEvent> {
        yield* [];
        throw new Error('429 rate limit exceeded');
      })(),
    );

    const { onStarted, sending } = sendCounting();
    await sending;

    expect(storySpies.turnSpawn).toHaveBeenCalledTimes(2);
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it('spawns nothing and holds the row when Stop lands while the prompt builds', async () => {
    const load = useAppStore.getState().loadGoalAttachments;
    useAppStore.setState({
      loadGoalAttachments: async (params) => {
        await stopTheAgent();
        return load(params);
      },
    });

    const delivery = await send('send-23');

    expect(delivery.isDelivered).toBe(false);
    expect(storySpies.turnSpawn).not.toHaveBeenCalled();
    expect(rows()).toEqual([{ id: 'send-23', status: 'queued', reason: DID_NOT_START }]);
    expect((await agentRow())?.status).toBe('stopped');
    expect(await runStatuses()).not.toContain('streaming');
    useAppStore.setState({ loadGoalAttachments: load });

    const retried = await retry('send-23');

    expect(retried.isDelivered).toBe(true);
    expect(storySpies.turnSpawn).toHaveBeenCalledTimes(1);
  });

  it('kills the process and holds the row when Stop lands during the spawn', async () => {
    storySpies.runTurn.mockImplementation(() => emptyTurnStream());
    storySpies.turnSpawn.mockImplementationOnce(async () => {
      await stopTheAgent();
      return 'started';
    });

    const delivery = await send('send-24');

    expect(delivery.isDelivered).toBe(false);
    expect(storySpies.cancelTurn).toHaveBeenCalledTimes(2);
    expect(rows()).toEqual([{ id: 'send-24', status: 'queued', reason: DID_NOT_START }]);
  });

  it('writes the agent, the run and the session back when the build fails', async () => {
    const load = useAppStore.getState().loadGoalAttachments;
    const startedBefore = (await agentRow())?.started_at;
    const recordAgentHandoff = vi.fn(async () => undefined);
    useAppStore.setState({
      recordAgentHandoff,
      loadGoalAttachments: async () => {
        throw new Error('the goal attachments could not be read');
      },
    });

    const delivery = await send('send-25');

    expect(delivery.isDelivered).toBe(false);
    expect(await agentRow()).toEqual({ status: 'pending', started_at: startedBefore });
    expect(await runStatuses()).toEqual(['failed']);
    expect(await sessionKind()).toBe('idle');
    expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('idle');
    expect(useAppStore.getState().agentRunHistory[agentId] ?? []).toEqual([]);
    expect(
      (useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find(
        (agent) => agent.id === agentId,
      )?.status,
    ).toBe('pending');
    useAppStore.setState({ loadGoalAttachments: load });

    const retried = await retry('send-25');

    expect(retried.isDelivered).toBe(true);
    expect(recordAgentHandoff).toHaveBeenCalledTimes(1);
  });

  it('leaves the stop in place when the build fails after a Stop', async () => {
    const load = useAppStore.getState().loadGoalAttachments;
    useAppStore.setState({
      loadGoalAttachments: async () => {
        await stopTheAgent();
        throw new Error('the goal attachments could not be read');
      },
    });

    await send('send-26');

    expect((await agentRow())?.status).toBe('stopped');
    expect(await runStatuses()).toEqual(['cancelled']);
    useAppStore.setState({ loadGoalAttachments: load });
  });
});
