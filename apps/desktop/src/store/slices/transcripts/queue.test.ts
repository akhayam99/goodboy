// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingTurnEventInsert } from '@goodboy/db';
import type { AgentId, IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { nextAgentId, nextProviderRunId, nextSessionId } from '@goodboy/types/testing';

const insertTurnEventsBatch = vi.hoisted(() =>
  vi.fn(async (_db: unknown, _batch: ReadonlyArray<PendingTurnEventInsert>) => undefined),
);

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({ insertTurnEventsBatch }),
);

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

const isIsoDateTime = (value: string): value is IsoDateTime => !Number.isNaN(Date.parse(value));

const isoAt = ({ value }: { readonly value: string }): IsoDateTime => {
  if (!isIsoDateTime(value)) {
    throw new Error(`not a date: ${value}`);
  }
  return value;
};

const AGENT_ID = nextAgentId();
const OTHER_AGENT_ID = nextAgentId();
const SESSION_ID = nextSessionId();
const RUN_ID = nextProviderRunId();
const OTHER_RUN_ID = nextProviderRunId();
const NOW = isoAt({ value: '2026-08-04T00:00:00.000Z' });

const text = (delta: string, runId: ProviderRunId = RUN_ID): TurnEvent => ({
  kind: 'assistant_text',
  runId,
  delta,
  at: NOW,
});

const partial = (delta: string, runId: ProviderRunId = RUN_ID): TurnEvent => ({
  kind: 'assistant_text',
  runId,
  delta,
  at: NOW,
  isPartial: true,
});

const done: TurnEvent = { kind: 'done', runId: RUN_ID, at: NOW };

type Queue = typeof import('./queue');

const load = async (): Promise<Queue> => import('./queue');

const queue = (queued: Queue, event: TurnEvent, agentId: AgentId = AGENT_ID): void => {
  queued.queueTurnEventInsert({ id: crypto.randomUUID(), sessionId: SESSION_ID, agentId, event });
};

const stored = (): ReadonlyArray<TurnEvent> =>
  insertTurnEventsBatch.mock.calls.flatMap(([, batch]) => batch.map((insert) => insert.event));

describe('queueTurnEventInsert text merge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    insertTurnEventsBatch.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inserts text that is not partial at once, as before', async () => {
    const queued = await load();
    queue(queued, text('Whole block'));
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()).toEqual([text('Whole block')]);
  });

  it('stores a burst of partial text as one event without the flag', async () => {
    const queued = await load();
    queue(queued, partial('Hel'));
    queue(queued, partial('lo '));
    queue(queued, partial('world'));
    await vi.advanceTimersByTimeAsync(300);
    expect(stored()).toEqual([text('Hello world')]);
  });

  it('writes held text before the event that follows it, in order', async () => {
    const queued = await load();
    queue(queued, partial('Done.'));
    queue(queued, done);
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()).toEqual([text('Done.'), done]);
  });

  it('writes held text before a whole text block that follows it', async () => {
    const queued = await load();
    queue(queued, partial('streamed'));
    queue(queued, text('whole'));
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()).toEqual([text('streamed'), text('whole')]);
  });

  it('never merges text of two runs or two agents', async () => {
    const queued = await load();
    queue(queued, partial('one'));
    queue(queued, partial('two', OTHER_RUN_ID));
    queue(queued, partial('three'), OTHER_AGENT_ID);
    await vi.advanceTimersByTimeAsync(300);
    expect(stored()).toEqual([text('one'), text('two', OTHER_RUN_ID), text('three')]);
  });

  it('writes text that nothing follows once the hold window ends', async () => {
    const queued = await load();
    queue(queued, partial('last words'));
    await vi.advanceTimersByTimeAsync(100);
    expect(stored()).toEqual([]);
    await vi.advanceTimersByTimeAsync(200);
    expect(stored()).toEqual([text('last words')]);
  });

  it('keeps every character when the window closes in the middle of a stream', async () => {
    const queued = await load();
    queue(queued, partial('a'));
    await vi.advanceTimersByTimeAsync(260);
    queue(queued, partial('b'));
    queue(queued, done);
    await vi.advanceTimersByTimeAsync(300);
    const joined = stored()
      .map((event) => (event.kind === 'assistant_text' ? event.delta : ''))
      .join('');
    expect(joined).toBe('ab');
  });
});
