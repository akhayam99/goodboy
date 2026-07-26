import { Bot } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import type { SpawnNode } from '../../../orchestration/components/SpawnTree/lib';
import type { RunLaneModel } from '../../../orchestration/hooks/useWorkspaceRuns';
import { CompletedAgentRow } from './CompletedAgentRow';
import { CompletedPipelineLane } from './CompletedPipelineLane';
import { SummaryRow } from './SummaryRow';

type Props = {
  readonly sessionId: SessionId;
  readonly lanes: ReadonlyArray<RunLaneModel>;
  readonly freeAgents: ReadonlyArray<SpawnNode>;
  readonly onSelectLens: (lens: LensKind) => void;
};

const MAX_VISIBLE_ITEMS = 4;

export const CompletedSection = ({ sessionId, lanes, freeAgents, onSelectLens }: Props) => {
  const setFocusedWorkflowRun = useAppStore((state) => state.setFocusedWorkflowRun);
  const visibleLanes = lanes.slice(0, MAX_VISIBLE_ITEMS);
  const remainingSlots = MAX_VISIBLE_ITEMS - visibleLanes.length;
  const visibleAgents = freeAgents.slice(0, remainingSlots);
  const hiddenLaneCount = lanes.length - visibleLanes.length;
  const hiddenAgentCount = freeAgents.length - visibleAgents.length;

  if (lanes.length === 0 && freeAgents.length === 0) {
    return null;
  }

  const openWorkflow = (runId: string) => {
    setFocusedWorkflowRun(sessionId, runId);
    onSelectLens('workflows');
  };

  return (
    <div className="flex flex-col gap-2">
      <Eyebrow label="Completed" muted className="px-0.5 font-medium" />
      <div className="flex flex-col gap-1.5">
        {visibleLanes.map((lane) => (
          <CompletedPipelineLane
            key={lane.runId}
            lane={lane}
            onOpen={() => openWorkflow(lane.runId)}
          />
        ))}
        {visibleAgents.map((agent) => (
          <CompletedAgentRow key={agent.id} agent={agent} onClick={() => onSelectLens('agents')} />
        ))}
        {hiddenLaneCount > 0 ? (
          <SummaryRow
            icon={SECTION_ICONS.workflows}
            tone="accent"
            label="View all workflows"
            onClick={() => onSelectLens('workflows')}
          />
        ) : null}
        {hiddenAgentCount > 0 ? (
          <SummaryRow
            icon={Bot}
            tone="primary"
            label="View all agents"
            onClick={() => onSelectLens('agents')}
          />
        ) : null}
      </div>
    </div>
  );
};
