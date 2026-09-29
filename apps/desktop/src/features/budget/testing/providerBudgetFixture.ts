import type { ProviderBudgetStatus } from '@goodboy/types';

type StatusParams = {
  readonly spentUsd: number;
  readonly capUsd: number;
  readonly thresholdPct?: number;
};

const SEPTEMBER_START_MS = Date.UTC(2026, 8, 1);
const SEPTEMBER_END_MS = Date.UTC(2026, 9, 1) - 1;

export const providerBudgetStatusFor = ({
  spentUsd,
  capUsd,
  thresholdPct = 80,
}: StatusParams): ProviderBudgetStatus => {
  const pct = (spentUsd / capUsd) * 100;
  const exceeded = spentUsd > capUsd;
  return {
    remainingUsd: capUsd - spentUsd,
    pct,
    exceeded,
    overThreshold: !exceeded && pct >= thresholdPct,
    spentUsd,
    capUsd,
    thresholdPct,
    windowStartMs: SEPTEMBER_START_MS,
    windowEndMs: SEPTEMBER_END_MS,
  };
};

export const SHARED_BUDGET = { spentUsd: 24, capUsd: 200, thresholdPct: 80 } as const;

export const SHARED_BUDGET_PCT_USED = 12;

export const WORKSPACE_WINDOW_SPEND_USD = 190;
