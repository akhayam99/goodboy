import type { ProviderBudgetStatus, ProviderId, ProviderLimits } from '@goodboy/types';
import { ROOM_RECENT_WINDOW_MS } from './constants';
import { limitsChipOf } from './selectLimitsChips';

export type ProviderRoom = Readonly<{
  usedPercent: number;
  isEstimated: boolean;
}>;

const FULL_PERCENT = 100;

const ESTIMATE_START_PERCENT = 50;

const ESTIMATE_FLOOR_PERCENT = 30;

const CLEAN_TURN_PERCENT = 2;

const AGENT_PERCENT = 10;

const RATE_LIMITED_PERCENT = 85;

const ESTIMATE_CEILING_PERCENT = 95;

type MeasuredParams = {
  readonly providerId: ProviderId;
  readonly limits: ProviderLimits | undefined;
  readonly budget: ProviderBudgetStatus | null;
  readonly nowMs: number;
};

const measuredPercent = ({ providerId, limits, budget, nowMs }: MeasuredParams): number | null => {
  const chip = limitsChipOf({ providerId, limits, nowMs });
  if (!chip.isStale && chip.state === 'reset') {
    return 0;
  }
  if (!chip.isStale && chip.usedFraction !== null) {
    return chip.usedFraction * FULL_PERCENT;
  }
  if (budget !== null && budget.capUsd !== null) {
    return budget.pct;
  }
  return null;
};

type EstimateParams = {
  readonly cleanTurns: number;
  readonly load: number;
  readonly lastRateLimitAtMs: number | null;
  readonly nowMs: number;
};

const estimatedPercent = ({
  cleanTurns,
  load,
  lastRateLimitAtMs,
  nowMs,
}: EstimateParams): number => {
  const earned = Math.max(
    ESTIMATE_FLOOR_PERCENT,
    ESTIMATE_START_PERCENT - cleanTurns * CLEAN_TURN_PERCENT,
  );
  const loaded = earned + load * AGENT_PERCENT;
  const isRateLimited =
    lastRateLimitAtMs !== null && nowMs - lastRateLimitAtMs <= ROOM_RECENT_WINDOW_MS;
  const withStrike = isRateLimited ? Math.max(loaded, RATE_LIMITED_PERCENT) : loaded;
  return Math.min(ESTIMATE_CEILING_PERCENT, withStrike);
};

type Params = {
  readonly providerId: ProviderId;
  readonly limits: ProviderLimits | undefined;
  readonly budget?: ProviderBudgetStatus | null;
  readonly cleanTurns: number;
  readonly load: number;
  readonly lastRateLimitAtMs: number | null;
  readonly nowMs: number;
};

export const providerRoom = ({
  providerId,
  limits,
  budget = null,
  cleanTurns,
  load,
  lastRateLimitAtMs,
  nowMs,
}: Params): ProviderRoom => {
  const measured = measuredPercent({ providerId, limits, budget, nowMs });
  if (measured !== null) {
    return {
      usedPercent: Math.round(Math.min(FULL_PERCENT, Math.max(0, measured))),
      isEstimated: false,
    };
  }
  return {
    usedPercent: Math.round(estimatedPercent({ cleanTurns, load, lastRateLimitAtMs, nowMs })),
    isEstimated: true,
  };
};
