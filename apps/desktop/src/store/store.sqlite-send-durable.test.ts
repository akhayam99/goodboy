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
import { summarizerQueues } from './slices/turn/turnHelpers';
import { cancelTurnStartWindow, ensureTurnStartWindow } from './slices/turn/turnStartWindow';
import { handDelivery } from './slices/turn/handDelivery';
import { markTurnSettled } from './slices/turn/turnSettled';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
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
});
