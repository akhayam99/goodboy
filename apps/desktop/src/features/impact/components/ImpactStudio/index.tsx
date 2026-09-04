import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ScrollFade, SegmentedTabs, StudioRailLayout } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { stripInlineMarkdown } from '../../../../shared/components/InlineMarkdown/stripInlineMarkdown';
import { useAppStore } from '../../../../store';
import { ProviderPanel } from '../../../budget/components/spend/ProviderPanel';
import { SessionPanel } from '../../../budget/components/spend/SessionPanel';
import { SpendSection } from '../../../budget/components/spend/SpendSection';
import { useWorkspaceSpend } from '../../../budget/hooks/useWorkspaceSpend';
import { useImpactMetrics } from '../../hooks/useImpactMetrics';
import {
  IMPACT_WINDOW_DAYS,
  IMPACT_WINDOW_OPTIONS,
  type ImpactScope,
  type ImpactWindowId,
} from '../../lib';
import { EfficiencyPanel } from './EfficiencyPanel';
import { FlowPanel } from './FlowPanel';
import { OverviewPanel } from './OverviewPanel';
import { ScopeRail } from './ScopeRail';
import { ShippedPanel } from './ShippedPanel';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly initialScope?: ImpactScope;
  readonly onClose: () => void;
};

const DAY_MS = 86_400_000;

export const ImpactStudio = ({ workspaceId, workspaceName, initialScope, onClose }: Props) => {
  const [windowId, setWindowId] = useState<ImpactWindowId>('last30');
  const [scope, setScope] = useState<ImpactScope>(initialScope ?? { kind: 'overview' });
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const metrics = useImpactMetrics({ workspaceId, windowId });
  const sinceMs = useMemo(
    () => (windowId === 'all' ? null : Date.now() - IMPACT_WINDOW_DAYS * DAY_MS),
    [windowId],
  );
  const spend = useWorkspaceSpend({ sinceMs });
  const openSession = useCallback(
    (sessionId: SessionId) => {
      void setCurrentSession(sessionId);
      onClose();
    },
    [onClose, setCurrentSession],
  );

  const selectedSession =
    scope.kind === 'session'
      ? (spend.sessions.find((session) => session.sessionId === scope.sessionId) ?? null)
      : null;

  useEffect(() => {
    if (scope.kind === 'session' && selectedSession === null) {
      setScope({ kind: 'overview' });
    }
  }, [scope, selectedSession]);

  const renderDetail = (requestClose: () => void): ReactNode => {
    switch (scope.kind) {
      case 'overview':
        return (
          <OverviewPanel
            overview={metrics.overview}
            pullRequests={metrics.pullRequests}
            reviews={metrics.reviews}
            isLoading={metrics.loading.overview || metrics.loading.shipped}
            onRetryOverview={() => metrics.retry('overview')}
            onRetryShipped={() => metrics.retry('shipped')}
            onOpenSession={openSession}
            spendSection={
              <SpendSection
                providers={spend.providers}
                alerts={spend.alerts}
                rulesResult={spend.data.rules}
                alertsResult={spend.data.alerts}
                telemetryResult={spend.data.telemetry}
                isLoading={
                  spend.data.loading.rules ||
                  spend.data.loading.alerts ||
                  spend.data.loading.telemetry
                }
                onDismissAlert={spend.dismissAlert}
                onSelectProvider={(provider) => setScope({ kind: 'provider', provider })}
                onRetryRules={() => spend.data.retry('rules')}
                onRetryAlerts={() => spend.data.retry('alerts')}
                onRetryTelemetry={() => spend.data.retry('telemetry')}
              />
            }
          />
        );
      case 'shipped':
        return (
          <ShippedPanel
            pullRequests={metrics.pullRequests}
            reviews={metrics.reviews}
            externalTasks={metrics.externalTasks}
            isLoading={metrics.loading.shipped}
            onRetry={() => metrics.retry('shipped')}
            onOpenSession={openSession}
          />
        );
      case 'flow':
        return (
          <FlowPanel
            agentDurations={metrics.agentDurations}
            flowHealth={metrics.flowHealth}
            isLoading={metrics.loading.flow}
            onRetry={() => metrics.retry('flow')}
            onOpenSession={openSession}
          />
        );
      case 'efficiency':
        return (
          <EfficiencyPanel
            cacheEfficiency={metrics.cacheEfficiency}
            contextGrowth={metrics.contextGrowth}
            turns={metrics.turns}
            nudges={metrics.nudges}
            isLoading={metrics.loading.efficiency}
            onRetry={() => metrics.retry('efficiency')}
          />
        );
      case 'provider':
        return (
          <ProviderPanel
            provider={scope.provider}
            entry={spend.providers.find((entry) => entry.provider === scope.provider) ?? null}
            turns={spend.turns}
            rule={spend.rules.find((rule) => rule.provider === scope.provider) ?? null}
            rulesResult={spend.data.rules}
            telemetryResult={spend.data.telemetry}
            isLoading={spend.data.loading.rules || spend.data.loading.telemetry}
            onSaveCap={(capUsd) => spend.saveProviderCap({ provider: scope.provider, capUsd })}
            onSaveThreshold={(thresholdPct) =>
              spend.saveProviderThreshold({ provider: scope.provider, thresholdPct })
            }
            onRemoveCap={() => spend.removeProviderCap({ provider: scope.provider })}
            onRetryRules={() => spend.data.retry('rules')}
            onRetryTelemetry={() => spend.data.retry('telemetry')}
            onOpenSession={openSession}
          />
        );
      case 'session':
        return selectedSession === null ? null : (
          <SessionPanel
            sessionId={selectedSession.sessionId}
            goal={stripInlineMarkdown({ text: selectedSession.goal })}
            isCurrent={selectedSession.isCurrent}
            turns={spend.turns.filter((turn) => turn.sessionId === selectedSession.sessionId)}
            softCapUsd={spend.softCapUsd(selectedSession.sessionId)}
            telemetryResult={spend.data.telemetry}
            budgetResult={spend.data.sessionBudgets}
            isLoading={spend.data.loading.telemetry || spend.data.loading.sessionBudgets}
            onSaveCap={(capUsd) =>
              spend.saveSessionCap({ sessionId: selectedSession.sessionId, capUsd })
            }
            onOpened={requestClose}
            onRetryTelemetry={() => spend.data.retry('telemetry')}
            onRetryBudget={() => spend.data.retry('sessionBudgets')}
            onOpenSession={openSession}
          />
        );
    }
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.impact}
      tone={CONCEPT_TONE.impact}
      title="Impact studio"
      workspaceName={workspaceName}
      closeLabel="close impact studio"
      headerAccessory={
        <SegmentedTabs
          ariaLabel="Impact window"
          options={IMPACT_WINDOW_OPTIONS}
          value={windowId}
          onChange={setWindowId}
          size="sm"
        />
      }
      onClose={onClose}
    >
      {(requestClose) => (
        <StudioRailLayout
          railLabel="Impact scopes"
          railWidth="standard"
          rail={
            <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
              <ScopeRail
                scope={scope}
                providers={spend.providers}
                sessions={spend.sessions}
                onSelect={setScope}
              />
            </ScrollFade>
          }
          detail={renderDetail(requestClose)}
        />
      )}
    </StudioShell>
  );
};
