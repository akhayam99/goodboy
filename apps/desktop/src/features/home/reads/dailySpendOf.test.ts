// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type SessionId } from '@goodboy/types';
import { spendFigures } from '../../budget/spendFigures';
import { dailySpendOf, type SpendSource } from './dailySpendOf';

const NOW = new Date(2026, 10, 27, 15, 0, 0).getTime();

type AtParams = {
  readonly daysAgo: number;
  readonly hour: number;
};

const at = ({ daysAgo, hour }: AtParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(2026, 10, 27 - daysAgo, hour, 0, 0).toISOString() });

type SourceParams = {
  readonly id: string;
  readonly goal: string;
  readonly records: ReadonlyArray<readonly [number, number, number]>;
};

const source = ({ id, goal, records }: SourceParams): SpendSource => ({
  sessionId: brandId<SessionId>({ value: id }),
  goal,
  records: records.map(([daysAgo, hour, usd]) => ({
    recordedAt: at({ daysAgo, hour }),
    estimatedCostUsd: usd,
  })),
});

const SOURCES: ReadonlyArray<SpendSource> = [
  source({
    id: 'session-ledger-core',
    goal: 'Cap retries',
    records: [
      [0, 9, 4],
      [0, 11, 1.5],
      [1, 10, 2],
      [6, 8, 3],
      [9, 8, 50],
    ],
  }),
  source({
    id: 'session-notify-relay',
    goal: 'Dedupe alerts',
    records: [
      [0, 12, 0.5],
      [2, 14, 6],
    ],
  }),
];

describe('dailySpendOf', () => {
  it('buckets seven days, oldest first, today last, and leaves older records out', () => {
    const spend = dailySpendOf({ sources: SOURCES, nowMs: NOW });

    expect(spend.daily).toEqual([3, 0, 0, 0, 6, 2, 6]);
    expect(spend.weekUsd).toBe(17);
    expect(spend.yesterdayUsd).toBe(2);
  });

  it('reads today with the function behind the top bar figure', () => {
    const spend = dailySpendOf({ sources: SOURCES, nowMs: NOW });
    const records = SOURCES.flatMap((entry) => entry.records);

    expect(spend.todayUsd).toBe(spendFigures({ records, nowMs: NOW, sinceMs: null }).today.usd);
    expect(spend.todayUsd).toBe(6);
  });

  it('orders the spenders by what they cost this week and drops a session with no spend', () => {
    const spend = dailySpendOf({
      sources: [
        ...SOURCES,
        source({ id: 'session-payments-api', goal: 'Idle', records: [[12, 9, 9]] }),
      ],
      nowMs: NOW,
    });

    expect(spend.spenders.map((spender) => [spender.goal, spender.usd])).toEqual([
      ['Cap retries', 10.5],
      ['Dedupe alerts', 6.5],
    ]);
  });

  it('is all zero with no record', () => {
    expect(dailySpendOf({ sources: [], nowMs: NOW })).toEqual({
      todayUsd: 0,
      yesterdayUsd: 0,
      weekUsd: 0,
      daily: [0, 0, 0, 0, 0, 0, 0],
      spenders: [],
    });
  });
});
