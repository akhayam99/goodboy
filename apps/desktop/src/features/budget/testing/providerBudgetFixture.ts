import type { ProviderBudgetStatus } from '@goodboy/types';

type StatusParams = {
  readonly spentUsd: number;
  readonly capUsd: number;
  readonly thresholdPct?: number;
};

const monthWindow = (): { readonly startMs: number; readonly endMs: number } => {
  const now = new Date();
  return {
    startMs: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    endMs: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1,
  };
};

export const providerBudgetStatusFor = ({
  spentUsd,
  capUsd,
  thresholdPct = 80,
}: StatusParams): ProviderBudgetStatus => {
  const pct = (spentUsd / capUsd) * 100;
  const { startMs, endMs } = monthWindow();
  const exceeded = spentUsd >= capUsd;
  return {
    remainingUsd: capUsd - spentUsd,
    pct,
    exceeded,
    overThreshold: !exceeded && pct >= thresholdPct,
    spentUsd,
    capUsd,
    thresholdPct,
    windowStartMs: startMs,
    windowEndMs: endMs,
  };
};

export const WORKSPACE_WINDOW_SPEND_USD = 190;
