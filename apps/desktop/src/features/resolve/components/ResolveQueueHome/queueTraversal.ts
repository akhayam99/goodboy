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
}>;

export const threadIdAfterDecision = ({ rows, selectedThreadId }: NextParams): string | null => {
  const index = rows.findIndex((row) => row.thread.threadId === selectedThreadId);
  if (index === -1) {
    return null;
  }
  return rows[index + 1]?.thread.threadId ?? null;
};
