import type { SessionId, TelemetryRecord } from '@goodboy/types';
import { spendFigures, totalUsd } from '../../budget/spendFigures';

export type SpendSource = {
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly records: ReadonlyArray<Pick<TelemetryRecord, 'recordedAt' | 'estimatedCostUsd'>>;
};

type Params = {
  readonly sources: ReadonlyArray<SpendSource>;
  readonly nowMs: number;
};

export type Spender = {
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly usd: number;
};

export type DailySpend = {
  readonly todayUsd: number;
  readonly yesterdayUsd: number;
  readonly weekUsd: number;
  readonly daily: ReadonlyArray<number>;
  readonly spenders: ReadonlyArray<Spender>;
};

export const SPEND_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

type DayParams = {
  readonly atMs: number;
};

const dayStartOf = ({ atMs }: DayParams): number => {
  const day = new Date(atMs);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

type RecordsParams = {
  readonly records: SpendSource['records'];
  readonly fromMs: number;
  readonly toMs: number;
};

const betweenOf = ({ records, fromMs, toMs }: RecordsParams): SpendSource['records'] =>
  records.filter((record) => {
    const at = Date.parse(record.recordedAt);
    return at >= fromMs && at < toMs;
  });

export const dailySpendOf = ({ sources, nowMs }: Params): DailySpend => {
  const todayStart = dayStartOf({ atMs: nowMs });
  const all = sources.flatMap((source) => source.records);
  const days = Array.from({ length: SPEND_DAYS }, (_, index) => {
    const fromMs = todayStart - (SPEND_DAYS - 1 - index) * DAY_MS;
    const toMs = index === SPEND_DAYS - 1 ? Number.POSITIVE_INFINITY : fromMs + DAY_MS;
    return totalUsd({ records: betweenOf({ records: all, fromMs, toMs }) });
  });
  const weekFrom = todayStart - (SPEND_DAYS - 1) * DAY_MS;
  const spenders = sources
    .map((source) => ({
      sessionId: source.sessionId,
      goal: source.goal,
      usd: totalUsd({
        records: betweenOf({
          records: source.records,
          fromMs: weekFrom,
          toMs: Number.POSITIVE_INFINITY,
        }),
      }),
    }))
    .filter((spender) => spender.usd > 0)
    .sort((a, b) => b.usd - a.usd);
  return {
    todayUsd: spendFigures({ records: all, nowMs, sinceMs: null }).today.usd,
    yesterdayUsd: days[SPEND_DAYS - 2] ?? 0,
    weekUsd: days.reduce((sum, usd) => sum + usd, 0),
    daily: days,
    spenders,
  };
};
