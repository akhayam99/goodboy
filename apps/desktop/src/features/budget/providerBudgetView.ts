import type { ProviderBudgetStatus } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { formatDateTime } from '../../shared/utils/time/formatDateTime';

type StatusParams = {
  readonly status: ProviderBudgetStatus;
};

export const budgetPctUsed = ({ status }: StatusParams): number => Math.round(status.pct);

export const budgetRingFraction = ({ status }: StatusParams): number => status.pct / 100;

export const budgetTone = ({ status }: StatusParams): Tone => {
  if (status.exceeded) {
    return 'danger';
  }
  return status.overThreshold ? 'warning' : 'primary';
};

export const budgetResetLabel = ({ status }: StatusParams): string =>
  formatDateTime({ at: status.windowEndMs + 1 });

export const budgetScopeNote = ({ status }: StatusParams): string =>
  `Across all workspaces. The month resets ${budgetResetLabel({ status })} your time.`;
