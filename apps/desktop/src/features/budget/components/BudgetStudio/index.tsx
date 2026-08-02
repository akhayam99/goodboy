import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { BudgetRule, ProviderName, SessionId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessions } from '../../../../store';
import type { ProviderSpendEntry } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { StudioRailLayout } from '../../../../shared/components/StudioRailLayout';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useBudgetData } from '../../hooks/useBudgetData';
import { OverviewPanel } from './OverviewPanel';
import { ProviderPanel } from './ProviderPanel';
import { ScopeRail } from './ScopeRail';
import { SessionPanel } from './SessionPanel';
import type { BudgetScope, SessionSpend, WorkspaceTurn } from './lib';

type Props = {
  readonly workspaceName: string;
  readonly initialScope?: BudgetScope;
  readonly onClose: () => void;
};

const EMPTY_TELEMETRY = EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>;
const EMPTY_SPEND = EMPTY_ARRAY as ReadonlyArray<ProviderSpendEntry>;

export const BudgetStudio = ({ workspaceName, initialScope, onClose }: Props) => {
  const sessions = useSessions();
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);
  const telemetryMap = useAppStore((s) => s.sessionTelemetry);
  const workspaceSummary = useAppStore((s) => s.workspaceSummary);
  const providers = useAppStore((s) => s.providerSpendBreakdown ?? EMPTY_SPEND);
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

  const turns = useMemo<ReadonlyArray<WorkspaceTurn>>(
    () =>
      sessions.flatMap((s) =>
        (telemetryMap[s.id] ?? EMPTY_TELEMETRY).map((record) => ({
          record,
          sessionId: s.id,
          sessionGoal: s.goal,
        })),
      ),
    [sessions, telemetryMap],
  );

  const sessionSpends = useMemo<ReadonlyArray<SessionSpend>>(
    () =>
      sessions
        .map((s) => {
          const recs = telemetryMap[s.id] ?? EMPTY_TELEMETRY;
          return {
            sessionId: s.id,
            goal: s.goal,
            spentUsd: recs.reduce((sum, r) => sum + r.estimatedCostUsd, 0),
            turnCount: recs.filter((r) => r.kind === 'turn').length,
            isCurrent: s.id === currentSessionId,
          };
        })
        .sort((a, b) => b.spentUsd - a.spentUsd),
    [sessions, telemetryMap, currentSessionId],
  );

  const selectedSession =
    scope.kind === 'session' ? sessions.find((s) => s.id === scope.sessionId) : undefined;

  useEffect(() => {
    if (scope.kind === 'session' && selectedSession == null) {
      setScope({ kind: 'overview' });
    }
  }, [scope, selectedSession]);

  return (
    <StudioShell
      icon={CONCEPT_ICONS.budget}
      title="Budget studio"
      workspaceName={workspaceName}
      closeLabel="close budget studio"
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
                workspaceSummary={workspaceSummary}
                providers={providers}
                turns={turns}
                sessionCount={sessions.length}
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
