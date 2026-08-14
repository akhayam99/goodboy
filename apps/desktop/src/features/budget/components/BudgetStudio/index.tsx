import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollFade, SegmentedTabs } from '@goodboy/ui';
import type { BudgetRule, ProviderName, SessionId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessions } from '../../../../store';
import type { ProviderSpendEntry } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioRailLayout } from '@goodboy/ui';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useBudgetData } from '../../hooks/useBudgetData';
import { OverviewPanel } from './OverviewPanel';
import { ProviderPanel } from './ProviderPanel';
import { ScopeRail } from './ScopeRail';
import { SessionPanel } from './SessionPanel';
import {
  BUDGET_WINDOW_DAYS,
  BUDGET_WINDOW_OPTIONS,
  type BudgetScope,
  type BudgetWindowId,
  type SessionSpend,
  type WorkspaceTurn,
} from './lib';

type Props = {
  readonly workspaceName: string;
  readonly initialScope?: BudgetScope;
  readonly onClose: () => void;
};

const EMPTY_TELEMETRY = EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>;
const EMPTY_SPEND = EMPTY_ARRAY as ReadonlyArray<ProviderSpendEntry>;
const DAY_MS = 86_400_000;

export const BudgetStudio = ({ workspaceName, initialScope, onClose }: Props) => {
  const sessions = useSessions();
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const telemetryMap = useAppStore((s) => s.sessionTelemetry);
  const storedProviders = useAppStore((s) => s.providerSpendBreakdown ?? EMPTY_SPEND);
  const budgetAlerts = useAppStore((s) => s.budgetAlerts);
  const budgetRules = useAppStore((s) => s.budgetRules);
  const sessionBudgets = useAppStore((s) => s.sessionBudgets);

  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const dismissBudgetAlert = useAppStore((s) => s.dismissBudgetAlert);
  const saveBudgetRule = useAppStore((s) => s.saveBudgetRule);
  const deleteBudgetRule = useAppStore((s) => s.deleteBudgetRule);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const refreshProviderSpendBreakdown = useAppStore((s) => s.refreshProviderSpendBreakdown);

  const [scope, setScope] = useState<BudgetScope>(initialScope ?? { kind: 'overview' });
  const [windowId, setWindowId] = useState<BudgetWindowId>('last30');
  const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions]);
  const budgetData = useBudgetData({ sessionIds });
  const openSession = useCallback(
    (sessionId: SessionId) => {
      void setCurrentSession(sessionId);
      onClose();
    },
    [onClose, setCurrentSession],
  );

  const refreshBreakdown = useCallback(async () => {
    if (currentWorkspaceId !== null) {
      await refreshProviderSpendBreakdown(currentWorkspaceId);
    }
  }, [currentWorkspaceId, refreshProviderSpendBreakdown]);

  const saveProviderCap = useCallback(
    async (provider: ProviderName, capUsd: number) => {
      const existing = budgetRules.find((r) => r.provider === provider) ?? null;
      if (existing) {
        await deleteBudgetRule(existing.id);
      }
      const next: Omit<BudgetRule, 'id' | 'createdAt'> = {
        provider,
        period: existing?.period ?? 'monthly',
        capUsd,
        alertThresholdPct: existing?.alertThresholdPct ?? 80,
        extraTokensBudget: existing?.extraTokensBudget ?? null,
      };
      await saveBudgetRule(next);
      await refreshBreakdown();
    },
    [budgetRules, deleteBudgetRule, saveBudgetRule, refreshBreakdown],
  );

  const saveProviderThreshold = useCallback(
    async (provider: ProviderName, thresholdPct: number) => {
      const existing = budgetRules.find((r) => r.provider === provider) ?? null;
      if (existing === null) {
        return;
      }
      await deleteBudgetRule(existing.id);
      const next: Omit<BudgetRule, 'id' | 'createdAt'> = {
        provider,
        period: existing.period,
        capUsd: existing.capUsd,
        alertThresholdPct: thresholdPct,
        extraTokensBudget: existing.extraTokensBudget,
      };
      await saveBudgetRule(next);
      await refreshBreakdown();
    },
    [budgetRules, deleteBudgetRule, saveBudgetRule, refreshBreakdown],
  );

  const removeProviderCap = useCallback(
    async (provider: ProviderName) => {
      const existing = budgetRules.find((r) => r.provider === provider) ?? null;
      if (existing) {
        await deleteBudgetRule(existing.id);
      }
      await refreshBreakdown();
    },
    [budgetRules, deleteBudgetRule, refreshBreakdown],
  );

  const saveSessionCap = useCallback(
    async (sessionId: SessionId, capUsd: number) => {
      await setSessionBudget(sessionId, capUsd);
    },
    [setSessionBudget],
  );

  const sinceMs = useMemo(() => {
    if (windowId === 'all') {
      return null;
    }
    return Date.now() - BUDGET_WINDOW_DAYS * DAY_MS;
  }, [windowId]);

  const windowedSessions = useMemo(
    () =>
      sessions
        .map((session) => ({
          session,
          records: (telemetryMap[session.id] ?? EMPTY_TELEMETRY).filter(
            (record) => sinceMs === null || Date.parse(record.recordedAt) >= sinceMs,
          ),
        }))
        .filter(({ records }) => windowId === 'all' || records.length > 0),
    [sessions, sinceMs, telemetryMap, windowId],
  );

  const turns = useMemo<ReadonlyArray<WorkspaceTurn>>(
    () =>
      windowedSessions.flatMap(({ session, records }) =>
        records.map((record) => ({
          record,
          sessionId: session.id,
          sessionGoal: session.goal,
        })),
      ),
    [windowedSessions],
  );

  const sessionSpends = useMemo<ReadonlyArray<SessionSpend>>(
    () =>
      windowedSessions
        .map(({ session, records }) => {
          return {
            sessionId: session.id,
            goal: session.goal,
            spentUsd: records.reduce((sum, record) => sum + record.estimatedCostUsd, 0),
            turnCount: records.filter((record) => record.kind === 'turn').length,
            isCurrent: session.id === currentSessionId,
          };
        })
        .sort((a, b) => b.spentUsd - a.spentUsd),
    [currentSessionId, windowedSessions],
  );

  const providers = useMemo<ReadonlyArray<ProviderSpendEntry>>(() => {
    const spendByProvider = new Map<string, number>();
    for (const turn of turns) {
      const current = spendByProvider.get(turn.record.provider) ?? 0;
      spendByProvider.set(turn.record.provider, current + turn.record.estimatedCostUsd);
    }
    return storedProviders.map((entry) => {
      const spentUsd = spendByProvider.get(entry.provider) ?? 0;
      const pct = entry.capUsd !== null && entry.capUsd > 0 ? spentUsd / entry.capUsd : 0;
      return { ...entry, spentUsd, pct };
    });
  }, [storedProviders, turns]);

  const selectedSession =
    scope.kind === 'session'
      ? windowedSessions.find(({ session }) => session.id === scope.sessionId)?.session
      : undefined;

  useEffect(() => {
    if (scope.kind === 'session' && selectedSession == null) {
      setScope({ kind: 'overview' });
    }
  }, [scope, selectedSession]);

  return (
    <StudioShell
      icon={CONCEPT_ICONS.budget}
      tone={CONCEPT_TONE.budget}
      title="Budget studio"
      workspaceName={workspaceName}
      closeLabel="close budget studio"
      headerAccessory={
        <SegmentedTabs
          ariaLabel="Budget window"
          options={BUDGET_WINDOW_OPTIONS}
          value={windowId}
          onChange={setWindowId}
          size="sm"
        />
      }
      onClose={onClose}
    >
      {(requestClose) => (
        <StudioRailLayout
          railLabel="Budget scopes"
          railWidth="standard"
          rail={
            <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
              <ScopeRail
                scope={scope}
                onSelect={setScope}
                providers={providers}
                sessions={sessionSpends}
              />
            </ScrollFade>
          }
          detail={
            scope.kind === 'overview' ? (
              <OverviewPanel
                providers={providers}
                turns={turns}
                sessionCount={windowedSessions.length}
                alerts={budgetAlerts}
                rulesResult={budgetData.rules}
                alertsResult={budgetData.alerts}
                telemetryResult={budgetData.telemetry}
                isLoading={
                  budgetData.loading.rules ||
                  budgetData.loading.alerts ||
                  budgetData.loading.telemetry
                }
                onDismissAlert={(id) => void dismissBudgetAlert(id)}
                onSelect={setScope}
                onRetryRules={() => budgetData.retry('rules')}
                onRetryAlerts={() => budgetData.retry('alerts')}
                onRetryTelemetry={() => budgetData.retry('telemetry')}
                onOpenSession={openSession}
              />
            ) : scope.kind === 'provider' ? (
              <ProviderPanel
                provider={scope.provider}
                entry={providers.find((p) => p.provider === scope.provider) ?? null}
                turns={turns}
                rule={budgetRules.find((r) => r.provider === scope.provider) ?? null}
                rulesResult={budgetData.rules}
                telemetryResult={budgetData.telemetry}
                isLoading={budgetData.loading.rules || budgetData.loading.telemetry}
                onSaveCap={(capUsd) => saveProviderCap(scope.provider, capUsd)}
                onSaveThreshold={(pct) => saveProviderThreshold(scope.provider, pct)}
                onRemoveCap={() => removeProviderCap(scope.provider)}
                onRetryRules={() => budgetData.retry('rules')}
                onRetryTelemetry={() => budgetData.retry('telemetry')}
                onOpenSession={openSession}
              />
            ) : selectedSession != null ? (
              <SessionPanel
                sessionId={selectedSession.id}
                goal={selectedSession.goal}
                isCurrent={selectedSession.id === currentSessionId}
                turns={turns.filter((t) => t.sessionId === selectedSession.id)}
                softCapUsd={sessionBudgets[selectedSession.id]?.softCapUsd ?? null}
                telemetryResult={budgetData.telemetry}
                budgetResult={budgetData.sessionBudgets}
                isLoading={budgetData.loading.telemetry || budgetData.loading.sessionBudgets}
                onSaveCap={(capUsd) => saveSessionCap(selectedSession.id, capUsd)}
                onOpened={requestClose}
                onRetryTelemetry={() => budgetData.retry('telemetry')}
                onRetryBudget={() => budgetData.retry('sessionBudgets')}
                onOpenSession={openSession}
              />
            ) : null
          }
        />
      )}
    </StudioShell>
  );
};
