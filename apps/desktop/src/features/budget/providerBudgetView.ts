import type { ProviderBudgetStatus } from '@goodboy/types';
import { formatDateTime } from '../../shared/utils/time/formatDateTime';

type StatusParams = {
  readonly status: ProviderBudgetStatus;
};

export const budgetPctUsed = ({ status }: StatusParams): number => Math.round(status.pct);

export const budgetRingFraction = ({ status }: StatusParams): number => status.pct / 100;

export const budgetWarnFraction = ({ status }: StatusParams): number | undefined =>
  status.thresholdPct === null ? undefined : status.thresholdPct / 100;

export const budgetResetLabel = ({ status }: StatusParams): string =>
  formatDateTime({ at: status.windowEndMs + 1 });

export const budgetScopeNote = ({ status }: StatusParams): string =>
  `Across all workspaces. The month resets ${budgetResetLabel({ status })} your time (00:00 UTC).`;
