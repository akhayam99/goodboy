// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const { countUserTextEvents, listAgentQueuedMessages, replaceAgentQueuedMessages } = vi.hoisted(
  () => ({
    countUserTextEvents: vi.fn(async (_params: { readonly deliveryId?: string }) => 0),
    listAgentQueuedMessages: vi.fn(async () => [] as ReadonlyArray<unknown>),
    replaceAgentQueuedMessages: vi.fn(
      async (
        _database: unknown,
        _params: { readonly messages: ReadonlyArray<{ readonly id: string }> },
      ) => undefined,
    ),
  }),
);

vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    countUserTextEvents,
    listAgentQueuedMessages,
    replaceAgentQueuedMessages,
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

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
    agentTurnState: { [AGENT_ID]: { kind: 'idle' } },
    sessionPhaseRuns: {
      [SESSION_ID]: [
        { id: AGENT_ID, sessionId: SESSION_ID, ordinal: 0, name: 'Agent', status: 'pending' },
      ],
    },
    sendTurn,
    reportError,
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
