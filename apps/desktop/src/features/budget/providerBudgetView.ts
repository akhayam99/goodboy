import type { ProviderBudgetStatus } from '@goodboy/types';
import { APP_LOCALE } from '../../shared/utils/appLocale';
import { formatShortDayMonth } from '../../shared/utils/formatShortDayMonth';

type StatusParams = {
  readonly status: ProviderBudgetStatus;
};

export const budgetPctUsed = ({ status }: StatusParams): number => Math.round(status.pct);

export const budgetRingFraction = ({ status }: StatusParams): number => status.pct / 100;

export const budgetWarnFraction = ({ status }: StatusParams): number | undefined =>
  status.thresholdPct === null ? undefined : status.thresholdPct / 100;

const clock = ({ ms }: { readonly ms: number }): string =>
  new Intl.DateTimeFormat(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));

export const budgetResetLabel = ({ status }: StatusParams): string => {
  const resetMs = status.windowEndMs + 1;
  return `${formatShortDayMonth({ iso: resetMs })}, ${clock({ ms: resetMs })}`;
};

export const budgetScopeNote = ({ status }: StatusParams): string =>
  `Across all workspaces. The month resets ${budgetResetLabel({ status })} your time (00:00 UTC).`;
