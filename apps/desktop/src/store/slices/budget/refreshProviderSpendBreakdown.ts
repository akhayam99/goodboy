import { summarizeWorkspaceProviderTelemetry } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { invokeBudgetRuleList } from '../../../features/budget/budget';
import { tauriDatabase } from '../../../shared/lib/db';
import { buildProviderSpendBreakdown } from './buildProviderSpendBreakdown';
import type { SetFn } from './types';

export function refreshProviderSpendBreakdown(set: SetFn) {
  return async (workspaceId: WorkspaceId) => {
    const [providerSummaries, budgetRules] = await Promise.all([
      summarizeWorkspaceProviderTelemetry(tauriDatabase, workspaceId),
      invokeBudgetRuleList(),
    ]);
    set({ providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules) });
  };
}
