import { summarizeWorkspaceProviderTelemetry } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { buildProviderSpendBreakdown } from './buildProviderSpendBreakdown';
import { loadCurrentProviderBudgetStatuses } from './loadProviderBudgetStatuses';
import type { SetFn } from './types';

export const refreshProviderSpendBreakdown = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const [providerSummaries, providerBudgetStatus] = await Promise.all([
      summarizeWorkspaceProviderTelemetry(tauriDatabase, workspaceId),
      loadCurrentProviderBudgetStatuses(),
    ]);
    set({
      providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries),
      providerBudgetStatus,
    });
  };
};
