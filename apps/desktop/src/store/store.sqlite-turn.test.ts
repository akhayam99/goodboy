import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import type {
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';
import { summarizerQueues } from './slices/turn/turnHelpers';
import { openTurnStartWindow } from './slices/turn/turnStartWindow';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  injectDbFault,
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
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const AT = '2026-09-30T09:00:00.000Z' as IsoDateTime;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });

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

const text = ({ runId, delta }: { readonly runId: ProviderRunId; readonly delta: string }) =>
  ({ kind: 'assistant_text', runId, delta, at: AT }) satisfies TurnEvent;

const streamOf = ({
  events,
  hold,
}: {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly hold?: Promise<void>;
}) =>
  async function* stream(): AsyncIterable<TurnEvent> {
    for (const event of events) {
      yield event;
    }
    if (hold !== undefined) {
      await hold;
    }
  };

const failingStream = ({
  message,
  events = [],
}: {
  readonly message: string;
  readonly events?: ReadonlyArray<TurnEvent>;
}) =>
  async function* stream(): AsyncIterable<TurnEvent> {
    for (const event of events) {
      yield event;
    }
    throw new Error(message);
  };

const send = (content = 'Reconcile the Harborline ledger export') =>
  useAppStore.getState().sendTurn({ sessionId, agentId, content });

const TURN_RUN = "json_extract(status_payload, '$.routingDecision') IS NOT NULL";

const providerRuns = () =>
  rowsOf<{ id: string; status_kind: string; status_payload: string }>({
    sql: `SELECT id, status_kind, status_payload FROM provider_runs WHERE ${TURN_RUN} ORDER BY created_at, rowid`,
  });

const summarizerRuns = () =>
  rowsOf<{ id: string }>({
    sql: `SELECT id FROM provider_runs WHERE NOT (${TURN_RUN})`,
  });

const spans = () =>
  rowsOf<{ run_id: string; end_reason: string }>({
    sql: 'SELECT run_id, end_reason FROM agent_turn_spans ORDER BY started_at, rowid',
  });

const messages = () =>
  rowsOf<{ role: string; content: string }>({
    sql: 'SELECT role, content FROM messages WHERE agent_id = ? ORDER BY created_at, rowid',
    params: [agentId],
  });

const agentRows = () =>
  rowsOf<{ id: string; status: string }>({
    sql: 'SELECT id, status FROM agents WHERE session_id = ?',
    params: [sessionId],
  });

const sessionState = async () =>
  (
    await rowsOf<{ state_kind: string }>({
      sql: 'SELECT state_kind FROM sessions WHERE id = ?',
      params: [sessionId],
    })
  )[0]?.state_kind;

const openRuns = () =>
  rowsOf<{ id: string }>({
    sql: `SELECT id FROM provider_runs WHERE ${TURN_RUN} AND status_kind IN ('pending', 'streaming')`,
  });

const transcript = () => useAppStore.getState().transcripts[agentId] ?? [];

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
  (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preference',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.cancelTurn.mockResolvedValue(undefined);
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Reconcile the Harborline ledger export',
    firstAgentKind: 'generic',
  });
  sessionId = session.id as SessionId;
  const [agent] = useAppStore.getState().sessionPhaseRuns[sessionId] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
  }
  agentId = agent.id;
});

afterEach(async () => {
  await vi.waitFor(() => expect(summarizerQueues.size).toBe(0));
});

describe('sendTurn on sqlite: a turn that completes', () => {
  it('leaves one user and one assistant message, one succeeded run and one span', async () => {
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      streamOf({ events: [text({ runId, delta: 'Ledger reconciled.' })] })(),
    );

    await send();

    expect(await messages()).toEqual([
      { role: 'user', content: 'Reconcile the Harborline ledger export' },
      { role: 'assistant', content: 'Ledger reconciled.' },
    ]);
    const runs = await providerRuns();
    expect(runs.map((run) => run.status_kind)).toEqual(['succeeded']);
    expect(await spans()).toEqual([{ run_id: runs[0]?.id, end_reason: 'succeeded' }]);
    expect((await agentRows()).map((row) => row.status)).toEqual(['completed']);
    expect(await sessionState()).toBe('idle');
    await vi.waitFor(async () => expect(await summarizerRuns()).toHaveLength(1));
  });
});

describe('sendTurn on sqlite: cancel', () => {
  it('while streaming kills the run, closes it as cancelled and leaves the agent stopped', async () => {
    const hold = gate();
    storySpies.cancelTurn.mockImplementation(async () => {
      hold.open();
      return undefined;
    });
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      streamOf({ events: [text({ runId, delta: 'Reading the export' })], hold: hold.opened })(),
    );

    const pending = send();
    await vi.waitFor(() =>
      expect(transcript().some((event) => event.kind === 'assistant_text')).toBe(true),
    );
    await useAppStore.getState().cancelCurrentTurn(sessionId, agentId, 'user');
    await pending;

    const runs = await providerRuns();
    expect(storySpies.cancelTurn).toHaveBeenCalledExactlyOnceWith(runs[0]?.id);
    expect(runs.map((run) => run.status_kind)).toEqual(['failed']);
    expect(runs[0]?.status_payload).toContain('cancelled by user');
    expect(await spans()).toEqual([{ run_id: runs[0]?.id, end_reason: 'cancelled' }]);
    expect((await agentRows()).map((row) => row.status)).toEqual(['stopped']);
    expect(await sessionState()).toBe('idle');
    expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('idle');
    expect(summarizerQueues.size).toBe(0);
    expect(await summarizerRuns()).toEqual([]);
    expect(await openRuns()).toEqual([]);
  });

  it('before the child spawns closes the run as cancelled and never starts a provider', async () => {
    openTurnStartWindow({ agentId });
    await useAppStore.getState().cancelCurrentTurn(sessionId, agentId, 'user');

    await send();

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(storySpies.cancelTurn).not.toHaveBeenCalled();
    expect((await providerRuns()).map((run) => run.status_kind)).toEqual(['cancelled']);
    expect(await spans()).toEqual([]);
    expect((await agentRows()).map((row) => row.status)).toEqual(['pending']);
    expect(await openRuns()).toEqual([]);
  });

  it('after a tool call keeps the tool events, skips the summary and ends cancelled', async () => {
    const hold = gate();
    storySpies.cancelTurn.mockImplementation(async () => {
      hold.open();
      return undefined;
    });
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      streamOf({
        events: [
          text({ runId, delta: 'Editing the export' }),
          {
            kind: 'tool_call_start',
            runId,
            toolUseId: 'tool-1',
            toolName: 'Edit',
            input: { file_path: 'ledger/export.csv' },
            at: AT,
          },
          {
            kind: 'tool_call_end',
            runId,
            toolUseId: 'tool-1',
            output: 'ok',
            isError: false,
            at: AT,
          },
          { kind: 'file_edit', runId, path: 'ledger/export.csv', editType: 'modify', at: AT },
        ],
        hold: hold.opened,
      })(),
    );

    const pending = send();
    await vi.waitFor(() =>
      expect(transcript().some((event) => event.kind === 'file_edit')).toBe(true),
    );
    await useAppStore.getState().cancelCurrentTurn(sessionId, agentId, 'user');
    await pending;

    expect(transcript().map((event) => event.kind)).toEqual([
      'user_text',
      'assistant_text',
      'tool_call_start',
      'tool_call_end',
      'file_edit',
    ]);
    expect(await spans()).toEqual([
      { run_id: (await providerRuns())[0]?.id, end_reason: 'cancelled' },
    ]);
    expect((await messages()).map((row) => row.role)).toEqual(['user', 'assistant']);
    expect(summarizerQueues.size).toBe(0);
    expect(await summarizerRuns()).toEqual([]);
    expect(await openRuns()).toEqual([]);
  });

  it('when the killed child ends the stream with an error closes the run as cancelled', async () => {
    const hold = gate();
    storySpies.cancelTurn.mockImplementation(async () => {
      hold.open();
      return undefined;
    });
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      (async function* stream(): AsyncIterable<TurnEvent> {
        yield text({ runId, delta: 'Reading the export' });
        await hold.opened;
        throw new Error('the provider process was terminated');
      })(),
    );

    const pending = send();
    await vi.waitFor(() =>
      expect(transcript().some((event) => event.kind === 'assistant_text')).toBe(true),
    );
    await useAppStore.getState().cancelCurrentTurn(sessionId, agentId, 'user');
    await pending.catch(() => undefined);

    const runs = await providerRuns();
    expect(runs.map((run) => run.status_kind)).toEqual(['failed']);
    expect(await spans()).toEqual([{ run_id: runs[0]?.id, end_reason: 'cancelled' }]);
    expect((await agentRows()).map((row) => row.status)).toEqual(['stopped']);
    expect(storySpies.runTurn).toHaveBeenCalledOnce();
    expect(await openRuns()).toEqual([]);
  });

  it('keeps the queued message and starts nothing else after a stop from the user', async () => {
    const hold = gate();
    storySpies.cancelTurn.mockImplementation(async () => {
      hold.open();
      return undefined;
    });
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      streamOf({ events: [text({ runId, delta: 'Reading the export' })], hold: hold.opened })(),
    );
    await useAppStore.getState().enqueueAgentMessage({
      turn: {
        id: 'queued-1',
        agentId,
        content: 'Then compare it with Northwind',
        attachments: [],
        override: undefined,
      },
    });

    const pending = send();
    await vi.waitFor(() =>
      expect(transcript().some((event) => event.kind === 'assistant_text')).toBe(true),
    );
    await useAppStore.getState().cancelCurrentTurn(sessionId, agentId, 'user');
    await pending;

    expect(storySpies.runTurn).toHaveBeenCalledOnce();
    expect(useAppStore.getState().agentQueue[agentId]?.map((item) => item.id)).toEqual([
      'queued-1',
    ]);
  });
});

describe('sendTurn on sqlite: retry', () => {
  it('after a rate limit runs once more on the cheaper model without duplicating rows', async () => {
    storySpies.runTurn
      .mockImplementationOnce(failingStream({ message: 'rate limit exceeded for this account' }))
      .mockImplementationOnce(({ runId }: RunArgs) =>
        streamOf({ events: [text({ runId, delta: 'Ledger reconciled.' })] })(),
      );

    await send();

    expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
    const runs = await providerRuns();
    expect(runs.map((run) => run.status_kind)).toEqual(['failed', 'succeeded']);
    expect(runs[0]?.status_payload).toContain('rate limit');
    expect(await spans()).toEqual([
      { run_id: runs[0]?.id, end_reason: 'failed' },
      { run_id: runs[1]?.id, end_reason: 'succeeded' },
    ]);
    expect(await messages()).toEqual([
      { role: 'user', content: 'Reconcile the Harborline ledger export' },
      { role: 'assistant', content: 'Ledger reconciled.' },
    ]);
    expect((await agentRows()).map((row) => row.status)).toEqual(['completed']);
    expect(await sessionState()).toBe('idle');
    expect(await openRuns()).toEqual([]);
  });

  it('gives up after the fallback also fails and leaves both runs failed', async () => {
    storySpies.runTurn.mockImplementation(
      failingStream({ message: 'rate limit exceeded for this account' }),
    );

    await expect(send()).rejects.toThrow('rate limit');

    expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
    const runs = await providerRuns();
    expect(runs.map((run) => run.status_kind)).toEqual(['failed', 'failed']);
    expect((await spans()).map((row) => row.end_reason)).toEqual(['failed', 'failed']);
    expect((await messages()).map((row) => row.role)).toEqual(['user']);
    expect((await agentRows()).map((row) => row.status)).toEqual(['failed']);
    expect(await sessionState()).toBe('error');
    expect(await openRuns()).toEqual([]);
  });

  it('with a retry input reuses the agent and writes no second user message', async () => {
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      streamOf({ events: [text({ runId, delta: 'Ledger reconciled.' })] })(),
    );

    await useAppStore.getState().sendTurn({
      sessionId,
      agentId,
      content: 'Reconcile the Harborline ledger export',
      retry: { attempt: 0, provider: 'anthropic', model: 'claude-sonnet-4-5', attachmentRefs: [] },
    });

    expect((await messages()).map((row) => row.role)).toEqual(['assistant']);
    expect(transcript().filter((event) => event.kind === 'user_text')).toEqual([]);
    expect((await providerRuns()).map((run) => run.status_kind)).toEqual(['succeeded']);
    expect((await agentRows()).map((row) => row.id)).toEqual([agentId]);
  });

  it('sending again after a failure reuses the agent and leaves no run open', async () => {
    storySpies.runTurn
      .mockImplementationOnce(failingStream({ message: 'connection reset by peer' }))
      .mockImplementationOnce(({ runId }: RunArgs) =>
        streamOf({ events: [text({ runId, delta: 'Ledger reconciled.' })] })(),
      );

    await expect(send()).rejects.toThrow('connection reset by peer');
    expect((await agentRows()).map((row) => row.status)).toEqual(['failed']);
    expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('error');

    await send();

    expect((await providerRuns()).map((run) => run.status_kind)).toEqual(['failed', 'succeeded']);
    expect((await agentRows()).map((row) => [row.id, row.status])).toEqual([
      [agentId, 'completed'],
    ]);
    expect(useAppStore.getState().agentTurnState[agentId]?.kind).toBe('idle');
    expect(await sessionState()).toBe('idle');
    expect(await openRuns()).toEqual([]);
  });
});

describe('sendTurn on sqlite: cleanup after an error', () => {
  it('finalises the run, the span, the agent and the session and skips the summary', async () => {
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      failingStream({
        message: 'connection reset by peer',
        events: [text({ runId, delta: 'Half of the export' })],
      })(),
    );

    await expect(send()).rejects.toThrow('connection reset by peer');

    const runs = await providerRuns();
    expect(runs.map((run) => run.status_kind)).toEqual(['failed']);
    expect(runs[0]?.status_payload).toContain('connection reset by peer');
    expect(await spans()).toEqual([{ run_id: runs[0]?.id, end_reason: 'failed' }]);
    expect((await agentRows()).map((row) => row.status)).toEqual(['failed']);
    expect(await sessionState()).toBe('error');
    expect(await messages()).toEqual([
      { role: 'user', content: 'Reconcile the Harborline ledger export' },
      { role: 'assistant', content: 'Half of the export' },
    ]);
    expect(summarizerQueues.size).toBe(0);
    expect(await summarizerRuns()).toEqual([]);
    expect(storySpies.cancelTurn).not.toHaveBeenCalled();
    expect(await openRuns()).toEqual([]);
  });

  it('sends the next queued message once the failed turn has settled', async () => {
    storySpies.runTurn.mockImplementationOnce(
      failingStream({ message: 'connection reset by peer' }),
    );
    await useAppStore.getState().enqueueAgentMessage({
      turn: {
        id: 'queued-1',
        agentId,
        content: 'Then compare it with Northwind',
        attachments: [],
        override: undefined,
      },
    });

    await expect(send()).rejects.toThrow('connection reset by peer');
    await vi.waitFor(async () => expect(await providerRuns()).toHaveLength(2));
    await vi.waitFor(() => expect(useAppStore.getState().agentQueue[agentId] ?? []).toEqual([]));

    expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
    expect((await messages()).map((row) => row.content)).toEqual([
      'Reconcile the Harborline ledger export',
      'Then compare it with Northwind',
    ]);
  });

  it('writes no run and no agent change when the user message cannot be stored', async () => {
    injectDbFault({ match: /INSERT INTO messages/, message: 'disk full' });

    await expect(send()).rejects.toThrow('disk full');

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(await providerRuns()).toEqual([]);
    expect(await spans()).toEqual([]);
    expect(await messages()).toEqual([]);
    expect((await agentRows()).map((row) => row.status)).toEqual(['pending']);
  });

  it('closes the run as failed when the final status write fails once', async () => {
    storySpies.runTurn.mockImplementation(({ runId }: RunArgs) =>
      streamOf({ events: [text({ runId, delta: 'Ledger reconciled.' })] })(),
    );
    injectDbFault({ match: /UPDATE provider_runs SET status_kind/, message: 'disk full' });

    await expect(send()).rejects.toThrow('disk full');

    expect((await providerRuns()).map((run) => run.status_kind)).toEqual(['failed']);
    expect(await openRuns()).toEqual([]);
  });
});
