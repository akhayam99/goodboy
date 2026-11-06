// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type AgentStatus,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
  type TurnState,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

const {
  countUserTextEvents,
  findUndecidedPermissionAsk,
  listAgentQueuedMessages,
  listAgentsForSessions,
  listTurnEventEntriesForAgent,
  replaceAgentQueuedMessages,
} = vi.hoisted(() => ({
  countUserTextEvents: vi.fn(async (_params: { readonly deliveryId?: string }) => 0),
  findUndecidedPermissionAsk: vi.fn(
    async (): Promise<{
      readonly runId: string;
      readonly toolUseId: string;
      readonly at: string;
    } | null> => null,
  ),
  listAgentsForSessions: vi.fn(
    async (): Promise<ReadonlyMap<string, ReadonlyArray<unknown>>> => new Map(),
  ),
  listTurnEventEntriesForAgent: vi.fn(
    async (): Promise<ReadonlyArray<{ readonly id: string; readonly event: unknown }>> => [],
  ),
  listAgentQueuedMessages: vi.fn(async (): Promise<ReadonlyArray<unknown>> => []),
  replaceAgentQueuedMessages: vi.fn(
    async (
      _database: unknown,
      _params: { readonly messages: ReadonlyArray<{ readonly id: string }> },
    ) => undefined,
  ),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    countUserTextEvents,
    findUndecidedPermissionAsk,
    listAgentQueuedMessages,
    listAgentsForSessions,
    listTurnEventEntriesForAgent,
    replaceAgentQueuedMessages,
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-1' });
const IDLE_SINCE = brandId<IsoDateTime>({ value: '2026-11-02T14:00:00.000Z' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-1' });

const SAVED_MESSAGE = {
  id: 'q1',
  agentId: AGENT_ID,
  content: 'Run the migration check on notify-relay',
  attachments: [],
  override: null,
  createdAt: '2026-11-02T14:02:00.000Z',
};

type SendParams = {
  readonly deliveryId?: string;
  readonly onStarted?: () => void;
};

let store: StoryStore;
const sendTurn = vi.fn(async (params: SendParams) => {
  params.onStarted?.();
  return { blockedOverBudget: false };
});
const reportError = vi.fn(async () => undefined);

const savedIds = (): ReadonlyArray<ReadonlyArray<string>> =>
  replaceAgentQueuedMessages.mock.calls.map(([, params]) =>
    params.messages.map((message) => message.id),
  );

const queuedIds = (): ReadonlyArray<string> =>
  (store.getState().agentQueue[AGENT_ID] ?? []).map((item) => item.id);

const restartWithSavedMessage = async (): Promise<void> => {
  listAgentQueuedMessages.mockResolvedValueOnce([SAVED_MESSAGE]);
  await store.getState().loadAgentQueues(SESSION_ID);
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  countUserTextEvents.mockReset();
  countUserTextEvents.mockResolvedValue(0);
  listAgentQueuedMessages.mockReset();
  listAgentQueuedMessages.mockResolvedValue([]);
  replaceAgentQueuedMessages.mockClear();
  sendTurn.mockClear();
  reportError.mockClear();
  store.setState({
    agentQueue: {},
    agentTurnState: { [AGENT_ID]: { kind: 'idle', lastActivityAt: IDLE_SINCE } },
    sessionPhaseRuns: {
      [SESSION_ID]: [anAgent({ id: AGENT_ID, sessionId: SESSION_ID, status: 'pending' })],
    },
    sendTurn,
    reportError,
  });
});

describe('drainAgentQueue while a permission ask is open', () => {
  const askEvent: TurnEvent = {
    kind: 'permission_request',
    runId: RUN_ID,
    toolUseId: 'tool-1',
    toolName: 'Bash',
    input: { command: 'pnpm db:migrate' },
    at: IDLE_SINCE,
  };
  const decision: TurnEvent = {
    kind: 'permission_decision',
    runId: RUN_ID,
    toolUseId: 'tool-1',
    decision: 'allow',
    ruleId: null,
    decidedBy: 'user',
    at: IDLE_SINCE,
  };
  const hold = (events: ReadonlyArray<TurnEvent>): void => {
    store.setState({
      transcripts: { [AGENT_ID]: events },
      agentTurnState: { [AGENT_ID]: { kind: 'blocked', runId: RUN_ID, blockedAt: IDLE_SINCE } },
    });
  };
  const drain = () =>
    store.getState().drainAgentQueue({ sessionId: SESSION_ID, agentId: AGENT_ID });
  const persisted = ({ status }: { readonly status: AgentStatus }): void => {
    listAgentsForSessions.mockResolvedValue(
      new Map([
        [SESSION_ID, [anAgent({ id: AGENT_ID, sessionId: SESSION_ID, status, runId: RUN_ID })]],
      ]),
    );
  };
  const askStandsInTheDatabase = (): void => {
    persisted({ status: 'running' });
    findUndecidedPermissionAsk.mockResolvedValue({
      runId: RUN_ID,
      toolUseId: 'tool-1',
      at: IDLE_SINCE,
    });
  };

  beforeEach(() => {
    askStandsInTheDatabase();
    listTurnEventEntriesForAgent.mockReset();
    listTurnEventEntriesForAgent.mockResolvedValue([]);
    stubStoryInvoke({ turn_list_live: () => [] });
  });

  it('keeps the queued message in the tray, not sending it over the ask', async () => {
    await restartWithSavedMessage();
    hold([askEvent]);

    await drain();

    expect(sendTurn).not.toHaveBeenCalled();
    expect(store.getState().agentQueue[AGENT_ID]?.[0]).toMatchObject({
      id: 'q1',
      status: 'queued',
    });
    expect(store.getState().agentQueue[AGENT_ID]?.[0]?.hold).toBeUndefined();
  });

  it('goes on once the ask is answered', async () => {
    await restartWithSavedMessage();
    hold([askEvent]);
    await drain();

    hold([askEvent, decision]);
    await drain();

    expect(sendTurn).toHaveBeenCalledTimes(1);
  });

  it('goes on when the agent stopped and the ask lapsed', async () => {
    await restartWithSavedMessage();
    hold([askEvent]);
    await drain();

    store.setState({
      agentTurnState: { [AGENT_ID]: { kind: 'idle', lastActivityAt: IDLE_SINCE } },
    });
    await drain();

    expect(sendTurn).toHaveBeenCalledTimes(1);
  });

  it('lets the queue go when another window answered and the agent finished', async () => {
    await restartWithSavedMessage();
    hold([askEvent]);
    findUndecidedPermissionAsk.mockResolvedValue(null);
    persisted({ status: 'completed' });
    listTurnEventEntriesForAgent.mockResolvedValue([
      { id: 'saved-ask', event: askEvent },
      { id: 'saved-decision', event: decision },
    ]);

    await drain();

    expect(store.getState().agentTurnState[AGENT_ID]?.kind).toBe('idle');
    expect(store.getState().transcripts[AGENT_ID]).toEqual([askEvent, decision]);
    expect(store.getState().sessionPhaseRuns[SESSION_ID]?.[0]?.status).toBe('completed');
    expect(sendTurn).toHaveBeenCalledTimes(1);
  });

  it('lapses the ask of an agent stopped in another window, and the queue stays parked', async () => {
    await restartWithSavedMessage();
    hold([askEvent]);
    persisted({ status: 'stopped' });

    await drain();

    expect(store.getState().agentTurnState[AGENT_ID]?.kind).toBe('idle');
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('waits while the answer in another window runs its turn', async () => {
    await restartWithSavedMessage();
    hold([askEvent]);
    findUndecidedPermissionAsk.mockResolvedValue(null);
    stubStoryInvoke({ turn_list_live: () => [RUN_ID] });

    await drain();

    expect(store.getState().agentTurnState[AGENT_ID]).toMatchObject({
      kind: 'running',
      runId: RUN_ID,
    });
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('keeps the ask and the message when the saved state cannot be read', async () => {
    await restartWithSavedMessage();
    hold([askEvent]);
    findUndecidedPermissionAsk.mockRejectedValueOnce(new Error('the database is busy'));

    await drain();

    expect(reportError).toHaveBeenCalledOnce();
    expect(store.getState().agentTurnState[AGENT_ID]?.kind).toBe('blocked');
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('drops the read when a message started here while it was on its way', async () => {
    await restartWithSavedMessage();
    hold([askEvent]);
    findUndecidedPermissionAsk.mockResolvedValue(null);
    persisted({ status: 'completed' });
    const startedHere: TurnState = { kind: 'starting', startedAt: IDLE_SINCE };
    listAgentsForSessions.mockImplementationOnce(async () => {
      store.setState({ agentTurnState: { [AGENT_ID]: startedHere } });
      return new Map();
    });

    await store.getState().refreshAgentAsks({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(store.getState().agentTurnState[AGENT_ID]).toEqual(startedHere);
    expect(store.getState().transcripts[AGENT_ID]).toEqual([askEvent]);
  });

  it('reads the transcript of a reloaded agent before it decides', async () => {
    await restartWithSavedMessage();
    const loadAgentTranscript = vi.fn(async () => {
      store.setState({ transcripts: { [AGENT_ID]: [askEvent] } });
    });
    store.setState({
      loadAgentTranscript,
      transcripts: {},
      agentTurnState: { [AGENT_ID]: { kind: 'blocked', runId: RUN_ID, blockedAt: IDLE_SINCE } },
    });

    await drain();

    expect(loadAgentTranscript).toHaveBeenCalledWith(SESSION_ID, AGENT_ID, { isSelecting: false });
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('keeps the message when the transcript cannot be read', async () => {
    await restartWithSavedMessage();
    store.setState({
      loadAgentTranscript: vi.fn(async () => {
        throw new Error('the database is busy');
      }),
      transcripts: {},
      agentTurnState: { [AGENT_ID]: { kind: 'blocked', runId: RUN_ID, blockedAt: IDLE_SINCE } },
    });

    await drain();

    expect(sendTurn).not.toHaveBeenCalled();
  });
});

describe('drainAgentQueue after a crash', () => {
  it('does not send a message whose turn was recorded before the crash', async () => {
    countUserTextEvents.mockImplementation(async ({ deliveryId }) =>
      deliveryId === 'queue:q1' ? 1 : 0,
    );
    await restartWithSavedMessage();

    await store.getState().drainAgentQueue({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(countUserTextEvents).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: AGENT_ID, deliveryId: 'queue:q1' }),
    );
    expect(sendTurn).not.toHaveBeenCalled();
    expect(queuedIds()).toEqual([]);
    expect(savedIds()).toEqual([[]]);
  });

  it('sends a message that was never delivered once, under its queue id', async () => {
    await restartWithSavedMessage();

    await store.getState().drainAgentQueue({ sessionId: SESSION_ID, agentId: AGENT_ID });
    await store.getState().drainAgentQueue({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(sendTurn.mock.calls[0]?.[0].deliveryId).toBe('queue:q1');
    expect(queuedIds()).toEqual([]);
  });

  it('keeps the message and shows the error when the delivery check fails', async () => {
    countUserTextEvents.mockRejectedValue(new Error('database is locked'));
    await restartWithSavedMessage();

    await store.getState().drainAgentQueue({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(sendTurn).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(queuedIds()).toEqual(['q1']);
    expect(store.getState().agentQueue[AGENT_ID]?.[0]?.status).toBe('queued');
  });
});
