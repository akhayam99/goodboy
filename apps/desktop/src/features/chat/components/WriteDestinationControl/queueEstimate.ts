import type { ProviderRunId, TurnEvent } from '@goodboy/types';

type Params = Readonly<{
  events: ReadonlyArray<TurnEvent>;
  runningRunId: ProviderRunId | null;
  runningSinceMs: number | null;
  nowMs: number;
}>;

const MINUTE_MS = 60_000;

type Span = { first: number; last: number };

const finishedDurations = ({
  events,
  runningRunId,
}: Pick<Params, 'events' | 'runningRunId'>): ReadonlyArray<number> => {
  const spans = new Map<string, Span>();
  for (const event of events) {
    if (!('runId' in event) || event.runId === runningRunId) {
      continue;
    }
    const at = Date.parse(event.at);
    if (Number.isNaN(at)) {
      continue;
    }
    const span = spans.get(event.runId);
    if (span === undefined) {
      spans.set(event.runId, { first: at, last: at });
      continue;
    }
    span.first = Math.min(span.first, at);
    span.last = Math.max(span.last, at);
  }
  return Array.from(spans.values())
    .map((span) => span.last - span.first)
    .filter((duration) => duration > 0);
};

type MedianParams = Readonly<{ values: ReadonlyArray<number> }>;

const medianOf = ({ values }: MedianParams): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

export const queueEstimate = ({
  events,
  runningRunId,
  runningSinceMs,
  nowMs,
}: Params): number | null => {
  if (runningSinceMs === null) {
    return null;
  }
  const durations = finishedDurations({ events, runningRunId });
  if (durations.length === 0) {
    return null;
  }
  const remaining = medianOf({ values: durations }) - (nowMs - runningSinceMs);
  if (remaining <= 0) {
    return null;
  }
  return Math.max(1, Math.round(remaining / MINUTE_MS));
};
