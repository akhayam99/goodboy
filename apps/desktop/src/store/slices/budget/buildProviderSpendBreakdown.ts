import type { ProviderTelemetrySummary } from '@goodboy/db';
import type { ProviderSpendEntry } from './types';

export const buildProviderSpendBreakdown = (
  providerSummaries: ReadonlyArray<ProviderTelemetrySummary>,
): ReadonlyArray<ProviderSpendEntry> => {
  return providerSummaries.map((s) => ({ provider: s.provider, spentUsd: s.estimatedCostUsd }));
};
