export type TimeInterval = {
  readonly startMs: number;
  readonly endMs: number;
};

type Params = {
  readonly intervals: ReadonlyArray<TimeInterval>;
};

export const unionDurationMs = ({ intervals }: Params): number => {
  const sorted = intervals
    .filter((interval) => interval.endMs > interval.startMs)
    .sort((left, right) => left.startMs - right.startMs);
  let total = 0;
  let openStart: number | null = null;
  let openEnd = 0;
  for (const interval of sorted) {
    if (openStart !== null && interval.startMs <= openEnd) {
      openEnd = Math.max(openEnd, interval.endMs);
      continue;
    }
    if (openStart !== null) {
      total += openEnd - openStart;
    }
    openStart = interval.startMs;
    openEnd = interval.endMs;
  }
  return openStart === null ? total : total + (openEnd - openStart);
};
