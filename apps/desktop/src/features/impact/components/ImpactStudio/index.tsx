import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Divider, EmptyState, ScrollFade, SegmentedTabs } from '@goodboy/ui';
import { TrendingUp } from 'lucide-react';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useImpactMetrics } from '../../hooks/useImpactMetrics';
import { IMPACT_WINDOW_OPTIONS, type ImpactWindowId } from '../../lib';
import { DelegationSection } from './DelegationSection';
import { EffortSection } from './EffortSection';
import { HeroBand } from './HeroBand';
import { PlanSection } from './PlanSection';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly onClose: () => void;
};

const EMPTY_DESCRIPTION =
  'Once you run sessions here this page measures planning, context slots, turns per agent, model mix, split work, review, and issue links.';

export const ImpactStudio = ({ workspaceId, workspaceName, onClose }: Props) => {
  const [windowId, setWindowId] = useState<ImpactWindowId>('last30');
  const { overview, allTimeOverview, plan, context, turns, mix, nudges, delegation } =
    useImpactMetrics({ workspaceId, windowId });

  const isWorkspaceEmpty =
    overview !== null && allTimeOverview !== null && allTimeOverview.sessionCount === 0;

  return (
    <StudioShell
      icon={TrendingUp}
      title="Impact Studio"
      workspaceName={workspaceName}
      closeLabel="close impact studio"
      headerAccessory={
        <SegmentedTabs
          options={IMPACT_WINDOW_OPTIONS}
          value={windowId}
          onChange={setWindowId}
          size="sm"
          ariaLabel="impact window"
        />
      }
      onClose={onClose}
    >
      {() => (
        <ScrollFade className="min-h-0 flex-1">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-5">
            <HeroBand overview={overview} allTimeOverview={allTimeOverview} />
            {isWorkspaceEmpty ? (
              <EmptyState
                icon={TrendingUp}
                title="No activity in this workspace yet"
                description={EMPTY_DESCRIPTION}
                bordered
              />
            ) : (
              <>
                <Divider />
                <PlanSection plan={plan} context={context} windowId={windowId} />
                <Divider />
                <EffortSection turns={turns} mix={mix} nudges={nudges} windowId={windowId} />
                <Divider />
                <DelegationSection delegation={delegation} windowId={windowId} />
              </>
            )}
          </div>
        </ScrollFade>
      )}
    </StudioShell>
  );
};
