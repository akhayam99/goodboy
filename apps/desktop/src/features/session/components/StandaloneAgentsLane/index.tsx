import { useEffect } from 'react';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { AdHocRow } from '../../../workspace/components/WorkspacesSidebar/parts/AdHocRow';
import { AgentLane } from '../AgentLane';
import { AgentLaneEmpty } from '../AgentLane/AgentLaneEmpty';
import { AgentLaneNote } from '../AgentLane/AgentLaneNote';
import { CreateAgentPopover } from '../CreateAgentPopover';
import { AgentListSkeleton } from './AgentListSkeleton';
import { useStandaloneAgentsLane } from './useStandaloneAgentsLane';
import { visibleLaneAgents } from './visibleLaneAgents';

const NO_AGENTS_DESCRIPTION =
  'Spawn an agent to start working on this session, or kick off a workflow to run a sequence of agents toward the goal.';
const ALL_DONE_DESCRIPTION = 'Every agent here is marked done. Spawn a new one to keep going.';

type Props = {
  readonly session: Session;
  readonly variant?: 'lens' | 'sidebar';
  readonly showCreateControl?: boolean;
  readonly inspectedAgentId?: AgentId | null;
  readonly onInspectAgent?: (agentId: AgentId) => void;
  readonly showCompleted?: boolean;
  readonly onCompletedCountChange?: (completedCount: number) => void;
};

export const StandaloneAgentsLane = ({
  session,
  variant = 'lens',
  showCreateControl = true,
  inspectedAgentId = null,
  onInspectAgent,
  showCompleted = false,
  onCompletedCountChange,
}: Props) => {
  const sessionId = session.id as SessionId;
  const lane = useStandaloneAgentsLane({ session });
  const isLens = variant === 'lens';
  const agents = visibleLaneAgents({
    isLens,
    showCompleted,
    active: lane.activeAgents,
    completed: lane.completedAgents,
    all: lane.standaloneAgents,
  });
  const hasNoAgents = lane.standaloneAgents.length === 0;
  const isLoadingEmpty = lane.isAgentsLoading && hasNoAgents;

  useEffect(() => {
    if (!isLens || onCompletedCountChange == null) {
      return;
    }
    onCompletedCountChange(lane.completedAgents.length);
  }, [isLens, lane.completedAgents.length, onCompletedCountChange]);

  const list = (
    <ul className="flex flex-col gap-1">
      {agents.map((run) => (
        <AdHocRow
          key={run.id}
          run={run}
          firstUserTextByAgentId={lane.firstUserTextByAgentId}
          agentKindOverride={lane.agentKindOverride}
          childrenByParentId={lane.childrenByParentId}
          latestTelemetryByAgentId={lane.metrics.latestTelemetryByAgentId}
          aggregatesByAgentId={lane.metrics.aggregatesByAgentId}
          providerUsageByAgentId={lane.metrics.providerUsageByAgentId}
          turnsByAgentId={lane.metrics.turnsByAgentId}
          selectedAgentId={lane.selectedAgentId}
          isTranscriptLoading={lane.isTranscriptLoading}
          isTaskActive={lane.isTaskActive}
          editingId={lane.editingId}
          setEditingId={lane.setEditingId}
          clusterExpand={lane.clusterExpand}
          toggleClusterExpand={lane.toggleClusterExpand}
          onPickAgent={lane.onPickAgent}
          onRenameCommit={lane.onRenameCommit}
          onDeleteAgent={lane.onDeleteAgent}
          isInspected={run.id === inspectedAgentId}
          onInspectAgent={onInspectAgent}
          onMarkDone={lane.onMarkDone}
          isMuted={isLens && run.doneAt != null}
        />
      ))}
    </ul>
  );

  const error = lane.error != null && <p className="text-2xs text-danger">{lane.error}</p>;

  if (!isLens) {
    return (
      <div className="flex flex-col gap-1.5">
        {isLoadingEmpty && <AgentListSkeleton />}
        {!isLoadingEmpty && hasNoAgents && <AgentLaneNote text="No agents yet. Spawn one below." />}
        {!isLoadingEmpty && !hasNoAgents && list}
        {showCreateControl && <CreateAgentPopover sessionId={sessionId} variant="compact" />}
        {error}
      </div>
    );
  }

  return (
    <AgentLane
      isEmpty={agents.length === 0}
      empty={
        isLoadingEmpty ? (
          <AgentListSkeleton />
        ) : (
          <AgentLaneEmpty
            title={hasNoAgents ? 'No agents yet' : 'No active agents'}
            description={hasNoAgents ? NO_AGENTS_DESCRIPTION : ALL_DONE_DESCRIPTION}
          />
        )
      }
      footer={error}
    >
      {list}
    </AgentLane>
  );
};
