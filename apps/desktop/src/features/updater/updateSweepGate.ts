const HOUR_MS = 60 * 60_000;
const MAX_PER_DAY = 6;

export type UpdateSweepRecord = {
  readonly lastSweepAt: number;
  readonly dayKey: string;
  readonly countToday: number;
};

const dayKeyOf = ({ atMs }: { readonly atMs: number }): string =>
  new Date(atMs).toISOString().slice(0, 10);

type ShouldSweepParams = {
  readonly nowMs: number;
  readonly record: UpdateSweepRecord | null;
};

export const shouldSweep = ({ nowMs, record }: ShouldSweepParams): boolean => {
  if (record === null) {
    return true;
  }
  if (dayKeyOf({ atMs: nowMs }) === record.dayKey && record.countToday >= MAX_PER_DAY) {
    return false;
  }
  return nowMs - record.lastSweepAt >= HOUR_MS;
};

type NextSweepRecordParams = {
  readonly nowMs: number;
  readonly record: UpdateSweepRecord | null;
};

export const nextSweepRecord = ({ nowMs, record }: NextSweepRecordParams): UpdateSweepRecord => {
  const today = dayKeyOf({ atMs: nowMs });
  const countToday = record !== null && record.dayKey === today ? record.countToday : 0;
  return { lastSweepAt: nowMs, dayKey: today, countToday: countToday + 1 };
};
