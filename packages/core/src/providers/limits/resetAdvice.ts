import type { ProviderLimits, ProviderLimitWindow } from '@goodboy/types';

const RESET_STRONG_STOP_WEEK_USED = 0.5;
const RESET_STRONG_STOP_REFILL_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

export type ResetAdvice = Readonly<{
  weekUsedPercent: number;
  fiveHourUsedPercent: number | null;
  weekLeftPercent: number;
  weeklyRefillAt: string | null;
  weeklyRefillInHours: number | null;
  fiveHourFreesAt: string | null;
  isOnlyFiveHourFull: boolean;
  strong: boolean;
}>;

type WindowParams = {
  readonly limits: ProviderLimits | null;
  readonly kind: ProviderLimitWindow['kind'];
};

const windowOf = ({ limits, kind }: WindowParams): ProviderLimitWindow | null =>
  limits?.windows.find((window) => window.kind === kind && window.model === null) ?? null;

const percentOf = (window: ProviderLimitWindow | null): number | null =>
  window?.usedFraction == null ? null : Math.round(window.usedFraction * 100);

const hoursUntil = ({ iso, nowMs }: { readonly iso: string | null; readonly nowMs: number }) => {
  if (iso === null || Number.isNaN(Date.parse(iso))) {
    return null;
  }
  return Math.max(Date.parse(iso) - nowMs, 0) / HOUR_MS;
};

type Params = {
  readonly limits: ProviderLimits | null;
  readonly nowMs: number;
};

export const resetAdvice = ({ limits, nowMs }: Params): ResetAdvice => {
  const week = windowOf({ limits, kind: 'weekly' });
  const fiveHour = windowOf({ limits, kind: 'fiveHour' });
  const weekUsedPercent = percentOf(week) ?? 0;
  const fiveHourUsedPercent = percentOf(fiveHour);
  const weeklyRefillAt = week?.resetsAt ?? null;
  const weeklyRefillInHours = hoursUntil({ iso: weeklyRefillAt, nowMs });
  const isWeekMostlyLeft = weekUsedPercent < RESET_STRONG_STOP_WEEK_USED * 100;
  const isRefillSoon =
    weeklyRefillInHours !== null && weeklyRefillInHours <= RESET_STRONG_STOP_REFILL_HOURS;
  return {
    weekUsedPercent,
    fiveHourUsedPercent,
    weekLeftPercent: 100 - weekUsedPercent,
    weeklyRefillAt,
    weeklyRefillInHours,
    fiveHourFreesAt: fiveHour?.resetsAt ?? null,
    isOnlyFiveHourFull: (fiveHourUsedPercent ?? 0) >= 100 && weekUsedPercent < 100,
    strong: isWeekMostlyLeft || isRefillSoon,
  };
};

export type ResetOutcome = 'reset' | 'nothingToReset' | 'noCredit' | 'alreadyRedeemed';

const OUTCOMES: ReadonlyArray<ResetOutcome> = [
  'reset',
  'nothingToReset',
  'noCredit',
  'alreadyRedeemed',
];

export const parseResetOutcome = ({ value }: { readonly value: unknown }): ResetOutcome | null => {
  const outcome: unknown =
    typeof value === 'object' && value !== null ? Reflect.get(value, 'outcome') : undefined;
  return OUTCOMES.find((candidate) => candidate === outcome) ?? null;
};
