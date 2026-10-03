import { useCallback, useMemo } from 'react';
import type {
  BudgetAlert,
  BudgetRule,
  ProviderBudgetStatus,
  ProviderName,
  SessionId,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useDormantSpend,
  useSessions,
  useTelemetryForSessions,
} from '../../../../store';
import { spendSources } from '../../../../shared/utils/spendSources';
import type { ProviderSpendEntry } from '../../../../store';
import type { SessionSpend, WorkspaceTurn } from '../../components/spend/lib';
import { useBudgetData, type BudgetData } from '../useBudgetData';

type Params = {
  readonly sinceMs: number | null;
};

type SaveProviderCapParams = {
  readonly provider: ProviderName;
  readonly capUsd: number;
};

type SaveProviderThresholdParams = {
  readonly provider: ProviderName;
  readonly thresholdPct: number;
};

type RemoveProviderCapParams = {
  readonly provider: ProviderName;
};

export type ProviderBudgetEntry = ProviderSpendEntry & {
  readonly budget: ProviderBudgetStatus | null;
};

export type WorkspaceSpend = {
  readonly providers: ReadonlyArray<ProviderBudgetEntry>;
  readonly sessions: ReadonlyArray<SessionSpend>;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly alerts: ReadonlyArray<BudgetAlert>;
  readonly rules: ReadonlyArray<BudgetRule>;
  readonly data: BudgetData;
  readonly dismissAlert: (alertId: string) => void;
  readonly saveProviderCap: (params: SaveProviderCapParams) => Promise<void>;
  readonly saveProviderThreshold: (params: SaveProviderThresholdParams) => Promise<void>;
  readonly removeProviderCap: (params: RemoveProviderCapParams) => Promise<void>;
};

const EMPTY_SPEND = EMPTY_ARRAY as ReadonlyArray<ProviderSpendEntry>;
const EMPTY_STATUSES = {} as const;

export const useWorkspaceSpend = ({ sinceMs }: Params): WorkspaceSpend => {
  const sessions = useSessions();
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const telemetryMap = useTelemetryForSessions({ sessions });
  const dormant = useDormantSpend();
  const storedProviders = useAppStore((s) => s.providerSpendBreakdown ?? EMPTY_SPEND);
  const budgetStatuses = useAppStore((s) => s.providerBudgetStatus ?? EMPTY_STATUSES);
  const alerts = useAppStore((s) => s.budgetAlerts);
  const rules = useAppStore((s) => s.budgetRules);

  const dismissBudgetAlert = useAppStore((s) => s.dismissBudgetAlert);
  const saveBudgetRule = useAppStore((s) => s.saveBudgetRule);
  const deleteBudgetRule = useAppStore((s) => s.deleteBudgetRule);
  const refreshProviderSpendBreakdown = useAppStore((s) => s.refreshProviderSpendBreakdown);

  const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions]);
  const data = useBudgetData({ sessionIds });

  const refreshBreakdown = useCallback(async () => {
    if (currentWorkspaceId !== null) {
      await refreshProviderSpendBreakdown(currentWorkspaceId);
    }
  }, [currentWorkspaceId, refreshProviderSpendBreakdown]);

  const saveProviderCap = useCallback(
    async ({ provider, capUsd }: SaveProviderCapParams) => {
      const existing = rules.find((rule) => rule.provider === provider) ?? null;
      const next: BudgetRule | Omit<BudgetRule, 'id' | 'createdAt'> =
        existing === null
          ? {
              provider,
              period: 'monthly',
              capUsd,
              alertThresholdPct: 80,
              extraTokensBudget: null,
            }
          : { ...existing, capUsd };
      await saveBudgetRule(next);
      await refreshBreakdown();
    },
    [refreshBreakdown, rules, saveBudgetRule],
  );

  const saveProviderThreshold = useCallback(
    async ({ provider, thresholdPct }: SaveProviderThresholdParams) => {
      const existing = rules.find((rule) => rule.provider === provider) ?? null;
      if (existing === null) {
        return;
      }
      const next: BudgetRule = { ...existing, alertThresholdPct: thresholdPct };
      await saveBudgetRule(next);
      await refreshBreakdown();
    },
    [refreshBreakdown, rules, saveBudgetRule],
  );

  const removeProviderCap = useCallback(
    async ({ provider }: RemoveProviderCapParams) => {
      const existing = rules.find((rule) => rule.provider === provider) ?? null;
      if (existing) {
        await deleteBudgetRule(existing.id);
      }
      await refreshBreakdown();
    },
    [deleteBudgetRule, refreshBreakdown, rules],
  );

  const windowedSessions = useMemo(
    () =>
      spendSources({ sessions, telemetryMap, dormant })
        .map((source) => ({
          ...source,
          records: source.records.filter(
            (record) => sinceMs === null || Date.parse(record.recordedAt) >= sinceMs,
          ),
        }))
        .filter(({ records }) => sinceMs === null || records.length > 0),
    [dormant, sessions, sinceMs, telemetryMap],
  );

  const turns = useMemo<ReadonlyArray<WorkspaceTurn>>(
    () =>
      windowedSessions.flatMap(({ sessionId, goal, isDeleted, records }) =>
        records.map((record) => ({
          record,
          sessionId,
          sessionGoal: goal,
          isSessionDeleted: isDeleted,
        })),
      ),
    [windowedSessions],
  );

  const spendSessions = useMemo<ReadonlyArray<SessionSpend>>(
    () =>
      windowedSessions
        .map(({ sessionId, goal, isDeleted, records }) => ({
          sessionId,
          goal,
          spentUsd: records.reduce((sum, record) => sum + record.estimatedCostUsd, 0),
          turnCount: records.filter((record) => record.kind === 'turn').length,
          isCurrent: sessionId === currentSessionId,
          isDeleted,
        }))
        .sort((a, b) => b.spentUsd - a.spentUsd),
    [currentSessionId, windowedSessions],
  );

  const providers = useMemo<ReadonlyArray<ProviderBudgetEntry>>(() => {
    const spendByProvider = new Map<string, number>();
    for (const turn of turns) {
      const current = spendByProvider.get(turn.record.provider) ?? 0;
      spendByProvider.set(turn.record.provider, current + turn.record.estimatedCostUsd);
    }
    return storedProviders.map((entry) => {
      const spentUsd = spendByProvider.get(entry.provider) ?? 0;
      return { ...entry, spentUsd, budget: budgetStatuses[entry.provider] ?? null };
    });
  }, [budgetStatuses, storedProviders, turns]);

  const dismissAlert = useCallback(
    (alertId: string) => {
      void dismissBudgetAlert(alertId);
    },
    [dismissBudgetAlert],
  );

  return {
    providers,
    sessions: spendSessions,
    turns,
    alerts,
    rules,
    data,
    dismissAlert,
    saveProviderCap,
    saveProviderThreshold,
    removeProviderCap,
  };
};
