import type { ProviderBudgetStatus, TelemetryRecord } from '@goodboy/types';
import { budgetPctUsed, budgetRingFraction, budgetWarnFraction } from './providerBudgetView';

type SpendWindow = 'today' | 'range' | 'month';

type SpendRecord = Pick<TelemetryRecord, 'recordedAt' | 'estimatedCostUsd'>;

type TotalParams = {
  readonly records: ReadonlyArray<SpendRecord>;
};

type Params = TotalParams & {
  readonly nowMs: number;
  readonly sinceMs: number | null;
  readonly budget?: ProviderBudgetStatus | null;
};

type LimitParams = {
  readonly budget: ProviderBudgetStatus;
};

type SpendFigure = {
  readonly window: SpendWindow;
  readonly usd: number;
};

type LimitFigures = {
  readonly limitUsd: number;
  readonly leftUsd: number;
  readonly pctUsed: number;
  readonly ringFraction: number;
  readonly warnFraction: number | undefined;
  readonly resetsAtMs: number;
};

export type SpendFigures = {
  readonly today: SpendFigure;
  readonly range: SpendFigure;
  readonly month: SpendFigure | null;
  readonly limit: LimitFigures | null;
};

export const totalUsd = ({ records }: TotalParams): number =>
  records.reduce((sum, record) => sum + record.estimatedCostUsd, 0);

const startOfDay = (nowMs: number): number => {
  const day = new Date(nowMs);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

const limitOf = ({ budget }: LimitParams): LimitFigures | null => {
  if (budget.capUsd === null) {
    return null;
  }
  return {
    limitUsd: budget.capUsd,
    leftUsd: Math.max(budget.capUsd - budget.spentUsd, 0),
    pctUsed: budgetPctUsed({ status: budget }),
    ringFraction: budgetRingFraction({ status: budget }),
    warnFraction: budgetWarnFraction({ status: budget }),
    resetsAtMs: budget.windowEndMs + 1,
  };
};

export const spendFigures = ({ records, nowMs, sinceMs, budget = null }: Params): SpendFigures => {
  const todayStart = startOfDay(nowMs);
  const inRange = records.filter(
    (record) => sinceMs === null || Date.parse(record.recordedAt) >= sinceMs,
  );
  const today = inRange.filter((record) => Date.parse(record.recordedAt) >= todayStart);
  return {
    today: { window: 'today', usd: totalUsd({ records: today }) },
    range: { window: 'range', usd: totalUsd({ records: inRange }) },
    month: budget === null ? null : { window: 'month', usd: budget.spentUsd },
    limit: budget === null ? null : limitOf({ budget }),
  };
};
