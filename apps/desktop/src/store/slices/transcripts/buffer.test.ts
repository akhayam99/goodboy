import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import type { SetFn } from './types';

vi.mock('@goodboy/db', () => ({
  insertTurnEventsBatch: vi.fn(async () => undefined),
}));

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentSetProviderSessionId: vi.fn(async () => undefined),
}));

const AGENT_ID = 'agent-1' as AgentId;
const OTHER_AGENT_ID = 'agent-2' as AgentId;
const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as ProviderRunId;
const NOW = '2026-08-04T00:00:00.000Z' as IsoDateTime;
const BURST_SIZE = 500;

type Harness = {
  readonly append: (agentId: AgentId, sessionId: SessionId, event: TurnEvent) => void;
  readonly transcriptOf: (agentId: AgentId) => ReadonlyArray<TurnEvent>;
  readonly setCalls: () => number;
};

const delta = (index: number): TurnEvent => ({
  kind: 'assistant_text',
  runId: RUN_ID,
  delta: `${index},`,
  at: NOW,
});

const createHarness = async (): Promise<Harness> => {
  const { appendTurnEvent } = await import('./appendTurnEvent');
  let state: { transcripts: Record<string, ReadonlyArray<TurnEvent>> } = { transcripts: {} };
  let setCalls = 0;
  const set = ((updater: unknown) => {
    setCalls += 1;
    const patch = typeof updater === 'function' ? updater(state) : updater;
    state = { ...state, ...(patch as Record<string, unknown>) };
  }) as unknown as SetFn;
  return {
    append: appendTurnEvent(set),
    transcriptOf: (agentId) => state.transcripts[agentId] ?? [],
    setCalls: () => setCalls,
  };
};

describe('turn event buffering', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces a burst of streaming deltas into a bounded number of store writes', async () => {
    const harness = await createHarness();

    for (let index = 0; index < BURST_SIZE; index += 1) {
      harness.append(AGENT_ID, SESSION_ID, delta(index));
    }
    vi.advanceTimersByTime(64);

    expect(harness.setCalls()).toBeLessThanOrEqual(4);
    expect(harness.transcriptOf(AGENT_ID)).toHaveLength(BURST_SIZE);
  });

  it('keeps every event, in arrival order, across the coalesced writes', async () => {
    const harness = await createHarness();

    for (let index = 0; index < BURST_SIZE; index += 1) {
      harness.append(AGENT_ID, SESSION_ID, delta(index));
    }
    vi.advanceTimersByTime(64);

    const text = harness
      .transcriptOf(AGENT_ID)
      .map((event) => (event.kind === 'assistant_text' ? event.delta : ''))
      .join('');
    const expected = Array.from({ length: BURST_SIZE }, (_, index) => `${index},`).join('');
    expect(text).toBe(expected);
  });

  it('leaves the transcript identity of untouched agents alone', async () => {
    const harness = await createHarness();

    harness.append(OTHER_AGENT_ID, SESSION_ID, delta(0));
    vi.advanceTimersByTime(64);
    const before = harness.transcriptOf(OTHER_AGENT_ID);
    harness.append(AGENT_ID, SESSION_ID, delta(1));
    vi.advanceTimersByTime(64);

    expect(harness.transcriptOf(OTHER_AGENT_ID)).toBe(before);
    expect(harness.transcriptOf(AGENT_ID)).toHaveLength(1);
  });
});
