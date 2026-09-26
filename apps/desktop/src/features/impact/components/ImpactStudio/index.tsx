import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { SegmentedTabs, inlineMarkdownText } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useAppStore, sessionPlace } from '../../../../store';
import { ProviderPanel } from '../../../budget/components/spend/ProviderPanel';
import { SessionPanel } from '../../../budget/components/spend/SessionPanel';
import { useWorkspaceSpend } from '../../../budget/hooks/useWorkspaceSpend';
import { useImpactMetrics } from '../../hooks/useImpactMetrics';
import {
  IMPACT_WINDOW_OPTIONS,
  impactTabOf,
  impactWindowStart,
  type ImpactScope,
  type ImpactTab,
  type ImpactWindowId,
} from '../../lib';
import { FlowPanel } from './FlowPanel';
import { ImpactTabs } from './ImpactTabs';
import { OverviewPanel } from './OverviewPanel';
import { ShippedPanel } from './ShippedPanel';
import { SpendPanel } from './SpendPanel';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName?: string;
  readonly initialScope?: ImpactScope;
  readonly onClose: () => void;
};

const SPEND_SCOPE: ImpactScope = { kind: 'spend' };

export const ImpactStudio = ({ workspaceId, workspaceName, initialScope, onClose }: Props) => {
  const [windowId, setWindowId] = useState<ImpactWindowId>('last30');
  const [scope, setScope] = useState<ImpactScope>(initialScope ?? { kind: 'overview' });
  const navigate = useAppStore((state) => state.navigate);
  const metrics = useImpactMetrics({ workspaceId, windowId });
  const sinceMs = useMemo(() => impactWindowStart({ windowId, nowMs: Date.now() }), [windowId]);
  const spend = useWorkspaceSpend({ sinceMs });
  const openSession = useCallback(
    (sessionId: SessionId) => {
      navigate({ to: sessionPlace({ sessionId }) });
      onClose();
    },
    [onClose, navigate],
  );
  const selectTab = useCallback((tab: ImpactTab) => setScope({ kind: tab }), []);
  const backToSpend = useCallback(() => setScope(SPEND_SCOPE), []);

  const selectedSession =
    scope.kind === 'session'
      ? (spend.sessions.find((session) => session.sessionId === scope.sessionId) ?? null)
      : null;

  useEffect(() => {
    if (scope.kind === 'session' && selectedSession === null) {
      setScope(SPEND_SCOPE);
    }
  }, [scope, selectedSession]);

  const header = <ImpactTabs value={impactTabOf({ scope })} onChange={selectTab} />;

  const renderDetail = (requestClose: () => void): ReactNode => {
    switch (scope.kind) {
      case 'overview':
        return (
          <OverviewPanel
            header={header}
            windowId={windowId}
            workspaceName={workspaceName ?? null}
            overview={metrics.overview}
            pullRequests={metrics.pullRequests}
            reviews={metrics.reviews}
            isLoading={metrics.loading.overview || metrics.loading.shipped}
            onRetryOverview={() => metrics.retry('overview')}
            onRetryShipped={() => metrics.retry('shipped')}
            onSelectTab={selectTab}
            onOpenSession={openSession}
            onStartSession={() => {
              window.dispatchEvent(new CustomEvent('goodboy:new-session'));
              requestClose();
            }}
          />
        );
      case 'shipped':
        return (
          <ShippedPanel
            header={header}
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
            header={header}
            agentDurations={metrics.agentDurations}
            flowHealth={metrics.flowHealth}
            isLoading={metrics.loading.flow}
            onRetry={() => metrics.retry('flow')}
            onOpenSession={openSession}
          />
        );
      case 'spend':
        return (
          <SpendPanel
            header={header}
            windowId={windowId}
            spend={spend}
            metrics={metrics}
            onSelectProvider={(provider) => setScope({ kind: 'provider', provider })}
            onSelectSession={(sessionId) => setScope({ kind: 'session', sessionId })}
          />
        );
      case 'provider':
        return (
          <ProviderPanel
            header={header}
            onBack={backToSpend}
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
            header={header}
            onBack={backToSpend}
            sessionId={selectedSession.sessionId}
            goal={inlineMarkdownText({ text: selectedSession.goal })}
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
      default: {
        const exhaustive: never = scope;
        return exhaustive;
      }
    }
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.impact}
      tone={CONCEPT_TONE.impact}
      title="Impact"
      subtitle="What Goodboy got done, and what it cost."
      closeLabel="close impact"
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
        <div className="flex min-h-0 min-w-0 flex-1">{renderDetail(requestClose)}</div>
      )}
    </StudioShell>
  );
};
