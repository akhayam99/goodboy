import type { ResolveQueueRow } from '../../buildResolveQueueRows';

type StepParams = Readonly<{
  rows: ReadonlyArray<ResolveQueueRow>;
  selectedThreadId: string | null;
  delta: number;
}>;

export const threadIdAtStep = ({ rows, selectedThreadId, delta }: StepParams): string | null => {
  if (rows.length === 0) {
    return null;
  }
  const index = rows.findIndex((row) => row.thread.threadId === selectedThreadId);
  if (index === -1) {
    const first = delta > 0 ? rows[0] : rows[rows.length - 1];
    return first?.thread.threadId ?? null;
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

export const threadIdAfterDecision = ({ rows, selectedThreadId }: NextParams): string | null =>
  threadIdAtStep({ rows, selectedThreadId, delta: 1 });
