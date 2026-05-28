import type { ProviderTelemetrySummary } from '@goodboy/db';
import type { BudgetRule } from '@goodboy/types';
import type { ProviderSpendEntry } from './types';

export function buildProviderSpendBreakdown(
  providerSummaries: ReadonlyArray<ProviderTelemetrySummary>,
  budgetRules: ReadonlyArray<BudgetRule>,
): ReadonlyArray<ProviderSpendEntry> {
  return providerSummaries.map((s) => {
    const rule = budgetRules.find((r) => r.provider === s.provider) ?? null;
    const capUsd = rule?.capUsd ?? null;
    const pct = capUsd !== null && capUsd > 0 ? s.estimatedCostUsd / capUsd : 0;
    return { provider: s.provider, spentUsd: s.estimatedCostUsd, capUsd, pct };
  });
}
