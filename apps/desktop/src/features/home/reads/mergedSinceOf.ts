import type { SessionId } from '@goodboy/types';
import type { MergeFact } from './mergeFactsOf';

type Params = {
  readonly merges: ReadonlyArray<MergeFact>;
  readonly nowMs: number;
};

export type MergedRow = {
  readonly key: string;
  readonly sessionId: SessionId;
  readonly title: string;
  readonly mergedAtMs: number;
};

export type MergedWeek = {
  readonly rows: ReadonlyArray<MergedRow>;
  readonly byDay: ReadonlyArray<number>;
};

export const MERGED_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export const mergedSinceOf = ({ merges, nowMs }: Params): MergedWeek => {
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const firstDayMs = today.getTime() - (MERGED_DAYS - 1) * DAY_MS;
  const seen = new Set<string>();
  const rows = merges
    .flatMap((merge) => {
      const mergedAtMs = Date.parse(merge.mergedAt);
      if (
        Number.isNaN(mergedAtMs) ||
        mergedAtMs < firstDayMs ||
        mergedAtMs > nowMs ||
        seen.has(merge.key)
      ) {
        return [];
      }
      seen.add(merge.key);
      return [{ key: merge.key, sessionId: merge.sessionId, title: merge.title, mergedAtMs }];
    })
    .sort((a, b) => b.mergedAtMs - a.mergedAtMs);
  const byDay = Array.from(
    { length: MERGED_DAYS },
    (_, index) =>
      rows.filter(
        (row) =>
          Math.min(MERGED_DAYS - 1, Math.floor((row.mergedAtMs - firstDayMs) / DAY_MS)) === index,
      ).length,
  );
  return { rows, byDay };
};
