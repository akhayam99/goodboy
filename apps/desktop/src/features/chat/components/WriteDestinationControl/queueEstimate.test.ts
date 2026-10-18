// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { queueEstimate } from './queueEstimate';

const START = Date.parse('2026-10-17T10:00:00.000Z');
const MINUTE = 60_000;

const at = (offsetMs: number): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(START + offsetMs).toISOString() });

const turn = ({
  runId,
  fromMs,
  toMs,
}: {
  readonly runId: string;
  readonly fromMs: number;
  readonly toMs: number;
}): ReadonlyArray<TurnEvent> => [
  {
    kind: 'user_text',
    runId: brandId<ProviderRunId>({ value: runId }),
    text: 'Tighten the intro',
    at: at(fromMs),
  },
  {
    kind: 'assistant_text',
    runId: brandId<ProviderRunId>({ value: runId }),
    delta: 'Done',
    at: at(toMs),
  },
];

const RUNNING = brandId<ProviderRunId>({ value: 'run-now' });

describe('queueEstimate', () => {
  it('says how long is left from the writer typical turn and its elapsed time', () => {
    const events = [
      ...turn({ runId: 'run-a', fromMs: 0, toMs: 3 * MINUTE }),
      ...turn({ runId: 'run-b', fromMs: 10 * MINUTE, toMs: 14 * MINUTE }),
      ...turn({ runId: 'run-c', fromMs: 20 * MINUTE, toMs: 23 * MINUTE }),
    ];

    expect(
      queueEstimate({
        events,
        runningRunId: RUNNING,
        runningSinceMs: START + 30 * MINUTE,
        nowMs: START + 31 * MINUTE,
      }),
    ).toBe(2);
  });

  it('never counts the running turn as a finished one', () => {
    const events = [
      ...turn({ runId: 'run-a', fromMs: 0, toMs: 4 * MINUTE }),
      ...turn({ runId: RUNNING, fromMs: 10 * MINUTE, toMs: 40 * MINUTE }),
    ];

    expect(
      queueEstimate({
        events,
        runningRunId: RUNNING,
        runningSinceMs: START + 10 * MINUTE,
        nowMs: START + 11 * MINUTE,
      }),
    ).toBe(3);
  });

  it('rounds up to one minute and never says less', () => {
    const events = turn({ runId: 'run-a', fromMs: 0, toMs: 2 * MINUTE });

    expect(
      queueEstimate({
        events,
        runningRunId: RUNNING,
        runningSinceMs: START,
        nowMs: START + 2 * MINUTE - 10_000,
      }),
    ).toBe(1);
  });

  it('gives no number when it cannot know: no history, nothing running, or past the typical length', () => {
    const events = turn({ runId: 'run-a', fromMs: 0, toMs: 2 * MINUTE });

    expect(
      queueEstimate({ events: [], runningRunId: RUNNING, runningSinceMs: START, nowMs: START }),
    ).toBeNull();
    expect(
      queueEstimate({ events, runningRunId: null, runningSinceMs: null, nowMs: START }),
    ).toBeNull();
    expect(
      queueEstimate({
        events,
        runningRunId: RUNNING,
        runningSinceMs: START,
        nowMs: START + 5 * MINUTE,
      }),
    ).toBeNull();
  });
});
