import type { WorkspaceId } from '@goodboy/types';
import { summarizeWorkspaceProviderTelemetry, summarizeWorkspaceTelemetry } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeBudgetRuleList } from '../../../features/budget/budget';
import { buildProviderSpendBreakdown } from '../budget';
import type { SetFn } from './types';

export const refreshWorkspaceSummary = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const [summary, providerSummaries, budgetRules] = await Promise.all([
      summarizeWorkspaceTelemetry(tauriDatabase, workspaceId),
      summarizeWorkspaceProviderTelemetry(tauriDatabase, workspaceId),
      invokeBudgetRuleList(),
    ]);
    set({
      workspaceSummary: summary,
      providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
    });
  };
};
