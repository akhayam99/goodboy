import { summarizeWorkspaceProviderTelemetry, type ProviderTelemetrySummary } from '@kay-am/db';
import type {
  BudgetRule,
  BudgetAlert,
  SessionBudget,
  SessionId,
  WorkspaceId,
  IsoDateTime,
} from '@kay-am/types';
import {
  invokeBudgetRuleList,
  invokeBudgetRuleUpsert,
  invokeBudgetRuleDelete,
  invokeBudgetAlertsList,
  invokeBudgetAlertDismiss,
  invokeSessionBudgetGet,
  invokeSessionBudgetSet,
} from '../../features/budget/budget';
import { tauriDatabase } from '../../shared/lib/db';
import type { AppStore } from '../store';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

export interface ProviderSpendEntry {
  readonly provider: ProviderTelemetrySummary['provider'];
  readonly spentUsd: number;
  readonly capUsd: number | null;
  readonly pct: number;
}

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

export function createBudgetSlice(set: SetFn, _get: GetFn) {
  return {
    loadBudgetRules: async () => {
      const rules = await invokeBudgetRuleList();
      set({ budgetRules: rules });
    },

    saveBudgetRule: async (partial: Omit<BudgetRule, 'id' | 'createdAt'>) => {
      const now = new Date().toISOString() as IsoDateTime;
      const rule: BudgetRule = {
        id: crypto.randomUUID(),
        createdAt: now,
        ...partial,
      };
      await invokeBudgetRuleUpsert(rule);
      const rules = await invokeBudgetRuleList();
      set({ budgetRules: rules });
    },

    deleteBudgetRule: async (id: string) => {
      await invokeBudgetRuleDelete(id);
      set((state) => ({ budgetRules: state.budgetRules.filter((r) => r.id !== id) }));
    },

    loadSessionBudget: async (sessionId: SessionId) => {
      const budget = await invokeSessionBudgetGet(sessionId);
      if (budget !== null) {
        set((state) => ({
          sessionBudgets: { ...state.sessionBudgets, [sessionId]: budget },
        }));
      }
    },

    setSessionBudget: async (sessionId: SessionId, softCapUsd: number) => {
      await invokeSessionBudgetSet(sessionId, softCapUsd);
      const budget: SessionBudget = { sessionId, softCapUsd };
      set((state) => ({
        sessionBudgets: { ...state.sessionBudgets, [sessionId]: budget },
      }));
    },

    refreshProviderSpendBreakdown: async (workspaceId: WorkspaceId) => {
      const [providerSummaries, budgetRules] = await Promise.all([
        summarizeWorkspaceProviderTelemetry(tauriDatabase, workspaceId),
        invokeBudgetRuleList(),
      ]);
      set({ providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules) });
    },

    loadBudgetAlerts: async () => {
      const alerts = await invokeBudgetAlertsList();
      set({ budgetAlerts: alerts });
    },

    dismissBudgetAlert: async (id: string) => {
      await invokeBudgetAlertDismiss(id);
      set((state) => ({
        budgetAlerts: state.budgetAlerts.map((a) =>
          a.id === id ? { ...a, dismissedAt: new Date().toISOString() as IsoDateTime } : a,
        ),
      }));
    },
  };
}
