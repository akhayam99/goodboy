// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import type { SetFn } from './types';

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    insertTurnEventsBatch: vi.fn(async () => undefined),
  }),
);

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

type HarnessParams = {
  readonly seededRows?: number;
};

const createHarness = async ({ seededRows = 0 }: HarnessParams = {}): Promise<Harness> => {
  const { appendTurnEvent } = await import('./appendTurnEvent');
  let state: { transcripts: Record<string, ReadonlyArray<TurnEvent>> } = {
    transcripts: { [AGENT_ID]: Array.from({ length: seededRows }, (_, index) => delta(index)) },
  };
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

  it.each([
    [0, 16],
    [1000, 16],
    [3000, 58],
    [5000, 100],
    [90000, 100],
  ])(
    'waits as long as the window for a transcript of %i rows: %ims',
    async (seededRows, windowMs) => {
      const harness = await createHarness({ seededRows });

      harness.append(AGENT_ID, SESSION_ID, delta(0));
      harness.append(AGENT_ID, SESSION_ID, delta(1));
      expect(harness.setCalls()).toBe(1);

      vi.advanceTimersByTime(windowMs - 1);
      expect(harness.setCalls()).toBe(1);

      vi.advanceTimersByTime(1);
      expect(harness.setCalls()).toBe(2);
    },
  );

  it('writes a long transcript less often than a short one and keeps every event', async () => {
    const writesFor = async (seededRows: number): Promise<number> => {
      vi.resetModules();
      const harness = await createHarness({ seededRows });
      for (let index = 0; index < 10; index += 1) {
        harness.append(AGENT_ID, SESSION_ID, delta(index));
        vi.advanceTimersByTime(20);
      }
      vi.advanceTimersByTime(200);
      expect(harness.transcriptOf(AGENT_ID)).toHaveLength(seededRows + 10);
      return harness.setCalls();
    };

    const shortWrites = await writesFor(0);
    const longWrites = await writesFor(3000);

    expect(shortWrites).toBeGreaterThanOrEqual(10);
    expect(longWrites).toBeLessThanOrEqual(5);
  });
});
