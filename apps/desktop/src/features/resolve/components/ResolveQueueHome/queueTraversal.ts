import type { ResolveQueueRow } from '../../buildResolveQueueRows';

type StepParams = Readonly<{
  rows: ReadonlyArray<ResolveQueueRow>;
  selectedThreadId: string | null;
  delta: number;
}>;

export const threadIdAtStep = ({ rows, selectedThreadId, delta }: StepParams): string | null => {
  const index = rows.findIndex((row) => row.thread.threadId === selectedThreadId);
  if (index === -1) {
    return null;
  }
  const next = index + delta;
  if (next < 0 || next >= rows.length) {
    return null;
  }
  return rows[next]?.thread.threadId ?? null;
};

type NextParams = Readonly<{
  rows: ReadonlyArray<ResolveQueueRow>;
  selectedThreadId: string | null;
  excludedThreadIds?: ReadonlyArray<string>;
  eligibleThreadIds?: ReadonlyArray<string>;
}>;

export const threadIdAfterDecision = ({
  rows,
  selectedThreadId,
  excludedThreadIds = [],
  eligibleThreadIds,
}: NextParams): string | null => {
  const index = rows.findIndex((row) => row.thread.threadId === selectedThreadId);
  if (index === -1) {
    return null;
  }
  const eligible = eligibleThreadIds === undefined ? null : new Set(eligibleThreadIds);
  const excluded = new Set(excludedThreadIds);
  return (
    rows
      .slice(index + 1)
      .find(
        (row) =>
          !excluded.has(row.thread.threadId) &&
          (eligible === null || eligible.has(row.thread.threadId)),
      )?.thread.threadId ?? null
  );
};
