import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';

const { listAgentQueuedMessages, replaceAgentQueuedMessages } = vi.hoisted(() => ({
  listAgentQueuedMessages: vi.fn(async () => [] as ReadonlyArray<unknown>),
  replaceAgentQueuedMessages: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({ listAgentQueuedMessages, replaceAgentQueuedMessages }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import type { AgentQueuedTurn, AgentQueuedTurnInput, GetFn, SetFn } from './types';

type QueueModule = typeof import('./index');
type SettledModule = typeof import('../turn/turnSettled');

let createAgentQueueSlice: QueueModule['createAgentQueueSlice'];
let markTurnActive: SettledModule['markTurnActive'];
let markTurnSettled: SettledModule['markTurnSettled'];

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

type SentTurn = { readonly content: string; readonly sentVia?: string };

type Harness = {
  readonly state: Record<string, unknown>;
  readonly slice: ReturnType<QueueModule['createAgentQueueSlice']>;
  readonly sent: Array<SentTurn>;
  readonly cancelCurrentTurn: ReturnType<typeof vi.fn>;
  readonly queue: () => ReadonlyArray<AgentQueuedTurn>;
};

const input = (id: string): AgentQueuedTurnInput => ({
  id,
  agentId: AGENT_ID,
  content: `message ${id}`,
  attachments: [],
  override: undefined,
});

const harness = ({ running = true }: { readonly running?: boolean } = {}): Harness => {
  const sent: Array<SentTurn> = [];
  const state: Record<string, unknown> = {
    agentQueue: {},
    agentTurnState: { [AGENT_ID]: { kind: running ? 'running' : 'idle' } },
    sessionPhaseRuns: { [SESSION_ID]: [{ id: AGENT_ID, status: running ? 'running' : 'pending' }] },
  };
  const set = ((update: unknown) => {
    const patch =
      typeof update === 'function' ? (update as (s: typeof state) => typeof state)(state) : update;
    Object.assign(state, patch);
  }) as SetFn;
  const get = (() => state) as unknown as GetFn;
  const slice = createAgentQueueSlice(set, get);
  const cancelCurrentTurn = vi.fn(async () => {
    state.agentTurnState = { [AGENT_ID]: { kind: 'idle' } };
  });
  Object.assign(state, slice, {
    cancelCurrentTurn,
    reportError: vi.fn(async () => undefined),
    sendTurn: vi.fn(async (params: SentTurn) => {
      sent.push({ content: params.content, sentVia: params.sentVia });
      return { blockedOverBudget: false };
    }),
  });
  return {
    state,
    slice,
    sent,
    cancelCurrentTurn,
    queue: () =>
      (state.agentQueue as Record<string, ReadonlyArray<AgentQueuedTurn>>)[AGENT_ID] ?? [],
  };
};

describe('agent queue', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ createAgentQueueSlice } = await import('./index'));
    ({ markTurnActive, markTurnSettled } = await import('../turn/turnSettled'));
  });

  it('queues in order and persists every change', async () => {
    const { slice, queue } = harness();

    await slice.enqueueAgentMessage({ turn: input('a') });
    await slice.enqueueAgentMessage({ turn: input('b') });

    expect(queue().map((item) => [item.id, item.status])).toEqual([
      ['a', 'queued'],
      ['b', 'queued'],
    ]);
    expect(replaceAgentQueuedMessages).toHaveBeenLastCalledWith(
      {},
      expect.objectContaining({
        agentId: AGENT_ID,
        messages: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })],
      }),
    );
  });

  it('does not drain while the turn runs', async () => {
    const { slice, sent } = harness();
    await slice.enqueueAgentMessage({ turn: input('a') });

    await slice.drainAgentQueue({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(sent).toEqual([]);
  });

  it('delivers one queued message per turn end, in order', async () => {
    const { state, slice, sent, queue } = harness();
    await slice.enqueueAgentMessage({ turn: input('a') });
    await slice.enqueueAgentMessage({ turn: input('b') });
    state.agentTurnState = { [AGENT_ID]: { kind: 'idle' } };

    await slice.drainAgentQueue({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(sent).toEqual([{ content: 'message a', sentVia: 'queued' }]);
    expect(queue().map((item) => item.id)).toEqual(['b']);
  });

  it('keeps the queue for an agent you stopped', async () => {
    const { state, slice, sent } = harness();
    await slice.enqueueAgentMessage({ turn: input('a') });
    state.agentTurnState = { [AGENT_ID]: { kind: 'idle' } };
    state.sessionPhaseRuns = { [SESSION_ID]: [{ id: AGENT_ID, status: 'stopped' }] };

    await slice.drainAgentQueue({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(sent).toEqual([]);
  });

  it('sends item two of three now, interrupting once and keeping the rest in order', async () => {
    const { slice, sent, queue, cancelCurrentTurn } = harness();
    await slice.enqueueAgentMessage({ turn: input('a') });
    await slice.enqueueAgentMessage({ turn: input('b') });
    await slice.enqueueAgentMessage({ turn: input('c') });

    await slice.sendQueuedNow({ sessionId: SESSION_ID, agentId: AGENT_ID, itemId: 'b' });

    expect(cancelCurrentTurn).toHaveBeenCalledOnce();
    expect(cancelCurrentTurn).toHaveBeenCalledWith(SESSION_ID, AGENT_ID, 'handoff');
    expect(sent).toEqual([{ content: 'message b', sentVia: 'interrupt' }]);
    expect(queue().map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('waits for the cancelled turn to settle and skips the drain it triggers', async () => {
    const { slice, sent, queue } = harness();
    await slice.enqueueAgentMessage({ turn: input('a') });
    await slice.enqueueAgentMessage({ turn: input('b') });
    markTurnActive({ agentId: AGENT_ID });

    const sending = slice.sendQueuedNow({ sessionId: SESSION_ID, agentId: AGENT_ID, itemId: 'b' });
    await Promise.resolve();
    expect(queue().find((item) => item.id === 'b')?.status).toBe('sending');
    await slice.drainAgentQueue({ sessionId: SESSION_ID, agentId: AGENT_ID });
    expect(sent).toEqual([]);

    markTurnSettled({ agentId: AGENT_ID });
    await sending;

    expect(sent).toEqual([{ content: 'message b', sentVia: 'interrupt' }]);
    expect(queue().map((item) => item.id)).toEqual(['a']);
  });

  it('ignores a second Send now while the first is still handing off', async () => {
    const { slice, sent, cancelCurrentTurn } = harness();
    await slice.enqueueAgentMessage({ turn: input('a') });
    await slice.enqueueAgentMessage({ turn: input('b') });
    markTurnActive({ agentId: AGENT_ID });

    const first = slice.sendQueuedNow({ sessionId: SESSION_ID, agentId: AGENT_ID, itemId: 'a' });
    await slice.sendQueuedNow({ sessionId: SESSION_ID, agentId: AGENT_ID, itemId: 'b' });
    markTurnSettled({ agentId: AGENT_ID });
    await first;

    expect(cancelCurrentTurn).toHaveBeenCalledOnce();
    expect(sent).toEqual([{ content: 'message a', sentVia: 'interrupt' }]);
  });

  it('does not deliver twice when the turn ends on its own during Send now', async () => {
    const { state, slice, sent, queue } = harness();
    await slice.enqueueAgentMessage({ turn: input('a') });
    state.agentTurnState = { [AGENT_ID]: { kind: 'idle' } };

    await slice.drainAgentQueue({ sessionId: SESSION_ID, agentId: AGENT_ID });
    await slice.sendQueuedNow({ sessionId: SESSION_ID, agentId: AGENT_ID, itemId: 'a' });

    expect(sent).toEqual([{ content: 'message a', sentVia: 'queued' }]);
    expect(queue()).toEqual([]);
  });

  it('puts a composer Send now first and sends it', async () => {
    const { slice, sent, queue } = harness();
    await slice.enqueueAgentMessage({ turn: input('a') });

    await slice.sendAgentMessageNow({ sessionId: SESSION_ID, turn: input('now') });

    expect(sent).toEqual([{ content: 'message now', sentVia: 'interrupt' }]);
    expect(queue().map((item) => item.id)).toEqual(['a']);
  });

  it('never removes or edits a message that is being sent', async () => {
    const { slice, queue } = harness();
    await slice.enqueueAgentMessage({ turn: input('a') });
    markTurnActive({ agentId: AGENT_ID });
    const sending = slice.sendQueuedNow({ sessionId: SESSION_ID, agentId: AGENT_ID, itemId: 'a' });
    await Promise.resolve();

    await slice.removeQueuedMessage({ agentId: AGENT_ID, itemId: 'a' });
    expect(slice.takeQueuedMessage({ agentId: AGENT_ID, itemId: 'a' })).toBeNull();
    expect(queue().map((item) => item.id)).toEqual(['a']);

    markTurnSettled({ agentId: AGENT_ID });
    await sending;
  });

  it('restores persisted queues after a restart', async () => {
    const { state, slice, queue } = harness({ running: false });
    listAgentQueuedMessages.mockResolvedValueOnce([
      {
        id: 'saved',
        agentId: AGENT_ID,
        content: 'saved message',
        attachments: [{ id: 'x', fileName: 'a.png', mimeType: 'image/png', dataUrl: 'data:' }],
        override: { providerId: 'codex', model: 'gpt-5.6-sol' },
        createdAt: '2026-09-25T10:00:00.000Z',
      },
    ]);

    await slice.loadAgentQueues(SESSION_ID);

    expect(state.agentQueue).toBeDefined();
    expect(queue()).toEqual([
      {
        id: 'saved',
        agentId: AGENT_ID,
        content: 'saved message',
        attachments: [
          { id: 'x', fileName: 'a.png', mimeType: 'image/png', dataUrl: 'data:', relPath: null },
        ],
        override: { providerId: 'codex', model: 'gpt-5.6-sol' },
        status: 'queued',
        createdAt: '2026-09-25T10:00:00.000Z',
      },
    ]);
  });
});
