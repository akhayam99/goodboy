import { useCallback, useMemo } from 'react';
import type { BudgetAlert, BudgetRule, ProviderBudgetStatus, ProviderName } from '@goodboy/types';
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
import { totalUsd } from '../../spendFigures';
import { useBudgetData, type BudgetData } from '../useBudgetData';

type Params = {
  readonly sinceMs: number | null;
};

type SaveProviderCapParams = {
  readonly provider: ProviderName;
  readonly capUsd: number;
  readonly thresholdPct?: number;
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
  readonly removeProviderCap: (params: RemoveProviderCapParams) => Promise<void>;
};

const EMPTY_SPEND = EMPTY_ARRAY as ReadonlyArray<ProviderSpendEntry>;
const EMPTY_STATUSES = {} as const;
const DEFAULT_THRESHOLD_PCT = 80;

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
    async ({ provider, capUsd, thresholdPct }: SaveProviderCapParams) => {
      const existing = rules.find((rule) => rule.provider === provider) ?? null;
      const next: BudgetRule | Omit<BudgetRule, 'id' | 'createdAt'> =
        existing === null
          ? {
              provider,
              period: 'monthly',
              capUsd,
              alertThresholdPct: thresholdPct ?? DEFAULT_THRESHOLD_PCT,
              extraTokensBudget: null,
            }
          : {
              ...existing,
              capUsd,
              alertThresholdPct: thresholdPct ?? existing.alertThresholdPct,
            };
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
          spentUsd: totalUsd({ records }),
          turnCount: records.filter((record) => record.kind === 'turn').length,
          isCurrent: sessionId === currentSessionId,
          isDeleted,
        }))
        .sort((a, b) => b.spentUsd - a.spentUsd),
    [currentSessionId, windowedSessions],
  );

  const providers = useMemo<ReadonlyArray<ProviderBudgetEntry>>(() => {
    return storedProviders.map((entry) => {
      const records = turns
        .filter((turn) => turn.record.provider === entry.provider)
        .map((turn) => turn.record);
      return {
        ...entry,
        spentUsd: totalUsd({ records }),
        budget: budgetStatuses[entry.provider] ?? null,
      };
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
    removeProviderCap,
  };
};
