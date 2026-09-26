import type { WorkspaceTurn } from '../../budget/components/spend/lib';

export type SpendTotals = {
  readonly windowUsd: number;
  readonly todayUsd: number;
};

type Params = {
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly nowMs: number;
};

const startOfDay = (nowMs: number): number => {
  const day = new Date(nowMs);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

export const spendTotals = ({ turns, nowMs }: Params): SpendTotals => {
  const todayStart = startOfDay(nowMs);
  return turns.reduce<SpendTotals>(
    (totals, turn) => ({
      windowUsd: totals.windowUsd + turn.record.estimatedCostUsd,
      todayUsd:
        Date.parse(turn.record.recordedAt) >= todayStart
          ? totals.todayUsd + turn.record.estimatedCostUsd
          : totals.todayUsd,
    }),
    { windowUsd: 0, todayUsd: 0 },
  );
};
