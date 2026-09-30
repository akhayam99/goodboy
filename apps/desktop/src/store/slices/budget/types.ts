import type { ProviderTelemetrySummary } from '@goodboy/db';
import type { ProviderBudgetStatus, ProviderName } from '@goodboy/types';

export type { SetFn } from '../../slice-types';

export type ProviderSpendEntry = {
  readonly provider: ProviderTelemetrySummary['provider'];
  readonly spentUsd: number;
};

export type ProviderBudgetStatuses = Readonly<Partial<Record<ProviderName, ProviderBudgetStatus>>>;
