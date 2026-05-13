import type { ProviderUsage } from '@kay-am/types';

// OpenCode reports an authoritative `cost` (USD) directly in `step_finish.part.cost`
// since it owns the upstream provider routing layer. The adapter forwards that
// value into ProviderUsage.estimatedCostUsd before invoking `cost()`, so this
// function simply echoes it back. Returning a recomputed value here would
// double-count.
export function computeOpenCodeCostUsd(usage: ProviderUsage, _model: string): number {
  return usage.estimatedCostUsd;
}
