import { useCallback, useState } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ScrollFade, SegmentedTabs } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioRailLayout } from '@goodboy/ui';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../store';
import { useImpactMetrics } from '../../hooks/useImpactMetrics';
import { IMPACT_WINDOW_OPTIONS, type ImpactScopeId, type ImpactWindowId } from '../../lib';
import { EfficiencyPanel } from './EfficiencyPanel';
import { FlowPanel } from './FlowPanel';
import { ImpactRail } from './ImpactRail';
import { OverviewPanel } from './OverviewPanel';
import { ShippedPanel } from './ShippedPanel';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly onClose: () => void;
};

export const ImpactStudio = ({ workspaceId, workspaceName, onClose }: Props) => {
  const [windowId, setWindowId] = useState<ImpactWindowId>('last30');
  const [scope, setScope] = useState<ImpactScopeId>('overview');
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const metrics = useImpactMetrics({ workspaceId, windowId });
  const openSession = useCallback(
    (sessionId: SessionId) => {
      void setCurrentSession(sessionId);
      onClose();
    },
    [onClose, setCurrentSession],
  );

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
      {() => (
        <StudioRailLayout
          railLabel="Impact scopes"
          railWidth="standard"
          rail={
            <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
              <ImpactRail scope={scope} onSelect={setScope} />
            </ScrollFade>
          }
          detail={
            scope === 'overview' ? (
              <OverviewPanel
                overview={metrics.overview}
                pullRequests={metrics.pullRequests}
                reviews={metrics.reviews}
                isLoading={metrics.loading.overview || metrics.loading.shipped}
                onRetryOverview={() => metrics.retry('overview')}
                onRetryShipped={() => metrics.retry('shipped')}
                onOpenSession={openSession}
              />
            ) : scope === 'shipped' ? (
              <ShippedPanel
                pullRequests={metrics.pullRequests}
                reviews={metrics.reviews}
                externalTasks={metrics.externalTasks}
                isLoading={metrics.loading.shipped}
                onRetry={() => metrics.retry('shipped')}
                onOpenSession={openSession}
              />
            ) : scope === 'flow' ? (
              <FlowPanel
                agentDurations={metrics.agentDurations}
                flowHealth={metrics.flowHealth}
                isLoading={metrics.loading.flow}
                onRetry={() => metrics.retry('flow')}
                onOpenSession={openSession}
              />
            ) : (
              <EfficiencyPanel
                cacheEfficiency={metrics.cacheEfficiency}
                contextGrowth={metrics.contextGrowth}
                turns={metrics.turns}
                nudges={metrics.nudges}
                isLoading={metrics.loading.efficiency}
                onRetry={() => metrics.retry('efficiency')}
              />
            )
          }
        />
      )}
    </StudioShell>
  );
};
