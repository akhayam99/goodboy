import { useEffect, useMemo, useState } from 'react';
import { Divider } from '@goodboy/ui';
import { Wallet } from 'lucide-react';
import type { TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessions } from '../../../../store';
import type { ProviderSpendEntry } from '../../../../store';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { ScrollFade } from '../../../../shared/components/ScrollFade';
import { OverviewPanel } from './OverviewPanel';
import { ProviderPanel } from './ProviderPanel';
import { ScopeRail } from './ScopeRail';
import { SessionPanel } from './SessionPanel';
import type { BudgetScope, SessionSpend, WorkspaceTurn } from './lib';

interface Props {
  readonly workspaceName: string;
  readonly initialScope?: BudgetScope;
  readonly onClose: () => void;
}

const EMPTY_TELEMETRY = EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>;
const EMPTY_SPEND = EMPTY_ARRAY as ReadonlyArray<ProviderSpendEntry>;

export function BudgetStudio({ workspaceName, initialScope, onClose }: Props) {
  const sessions = useSessions();
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const telemetryMap = useAppStore((s) => s.sessionTelemetry);
  const workspaceSummary = useAppStore((s) => s.workspaceSummary);
  const providers = useAppStore((s) => s.providerSpendBreakdown ?? EMPTY_SPEND);
  const budgetAlerts = useAppStore((s) => s.budgetAlerts);

  const loadBudgetRules = useAppStore((s) => s.loadBudgetRules);
  const loadBudgetAlerts = useAppStore((s) => s.loadBudgetAlerts);
  const loadSessionTelemetry = useAppStore((s) => s.loadSessionTelemetry);
  const dismissBudgetAlert = useAppStore((s) => s.dismissBudgetAlert);

  const [scope, setScope] = useState<BudgetScope>(initialScope ?? { kind: 'overview' });

  useEffect(() => {
    void loadBudgetRules();
    void loadBudgetAlerts();
  }, [loadBudgetRules, loadBudgetAlerts]);

  useEffect(() => {
    for (const s of sessions) void loadSessionTelemetry(s.id);
  }, [sessions, loadSessionTelemetry]);

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
    if (scope.kind === 'session' && !selectedSession) setScope({ kind: 'overview' });
  }, [scope, selectedSession]);

  return (
    <StudioShell
      icon={Wallet}
      title="Budget Studio"
      workspaceName={workspaceName}
      closeLabel="close budget studio"
      onClose={onClose}
    >
      {(requestClose) => (
        <>
          <ScrollFade className="w-72 shrink-0">
            <ScopeRail
              scope={scope}
              onSelect={setScope}
              providers={providers}
              sessions={sessionSpends}
            />
          </ScrollFade>
          <Divider orientation="vertical" />
          <div className="min-h-0 flex-1">
            {scope.kind === 'overview' ? (
              <OverviewPanel
                workspaceSummary={workspaceSummary}
                providers={providers}
                turns={turns}
                sessionCount={sessions.length}
                alerts={budgetAlerts}
                onDismissAlert={(id) => void dismissBudgetAlert(id)}
                onSelect={setScope}
              />
            ) : scope.kind === 'provider' ? (
              <ProviderPanel
                provider={scope.provider}
                entry={providers.find((p) => p.provider === scope.provider) ?? null}
                turns={turns}
              />
            ) : selectedSession ? (
              <SessionPanel
                sessionId={selectedSession.id}
                goal={selectedSession.goal}
                isCurrent={selectedSession.id === currentSessionId}
                turns={turns.filter((t) => t.sessionId === selectedSession.id)}
                onOpened={requestClose}
              />
            ) : null}
          </div>
        </>
      )}
    </StudioShell>
  );
}
