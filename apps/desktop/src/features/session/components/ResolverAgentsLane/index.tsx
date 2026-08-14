import { useEffect, type ReactNode } from 'react';
import type { AgentId, Session } from '@goodboy/types';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { LensEmptyState } from '@goodboy/ui';
import { AgentLane } from '../AgentLane';
import { ResolveCommentsAction } from './ResolveCommentsAction';
import { ResolverLaneToolbar } from './ResolverLaneToolbar';
import { ResolverRows } from './ResolverRows';
import { useResolverAgentsLane } from './useResolverAgentsLane';

const NOTHING_TO_RESOLVE_DESCRIPTION =
  'Spawn a resolver from a pull request comment or a diff selection and it will show up here.';
const ALL_RESOLVED_DESCRIPTION =
  'Every resolver here has finished. Show completed resolvers to review what they did.';

type Props = {
  readonly session: Session;
  readonly inspectedResolverId: AgentId | null;
  readonly onInspectResolver: (agentId: AgentId) => void;
  readonly showCompleted?: boolean;
  readonly onCompletedCountChange?: (completedCount: number) => void;
  readonly filedToggle?: ReactNode;
};

export const ResolverAgentsLane = ({
  session,
  inspectedResolverId,
  onInspectResolver,
  showCompleted = false,
  onCompletedCountChange,
  filedToggle,
}: Props) => {
  const lane = useResolverAgentsLane({ session });
  const hasNoResolvers = lane.totalCount === 0;
  const hasActiveEntries = lane.activeEntries.length > 0;
  const hasVisibleEntries = hasActiveEntries || (showCompleted && lane.completedEntries.length > 0);

  useEffect(() => {
    if (onCompletedCountChange == null) {
      return;
    }
    onCompletedCountChange(lane.completedEntries.length);
  }, [lane.completedEntries.length, onCompletedCountChange]);

  return (
    <AgentLane
      toolbar={
        <ResolverLaneToolbar
          sessionId={lane.sessionId}
          queuedCount={lane.queuedCount}
          isStalled={lane.isStalled}
          onForceNext={lane.onForceNext}
        />
      }
      isEmpty={!hasActiveEntries}
      empty={
        <LensEmptyState
          tone={CONCEPT_TONE.resolve}
          icon={CONCEPT_ICONS.resolve}
          title={hasNoResolvers ? 'Nothing to resolve' : 'No active resolvers'}
          description={hasNoResolvers ? NOTHING_TO_RESOLVE_DESCRIPTION : ALL_RESOLVED_DESCRIPTION}
          action={<ResolveCommentsAction variant="tile" onOpen={lane.onOpenResolveBoard} />}
        />
      }
      footer={
        hasVisibleEntries ? (
          <ResolveCommentsAction variant="link" onOpen={lane.onOpenResolveBoard} />
        ) : null
      }
    >
      {hasVisibleEntries || filedToggle != null ? (
        <div className="flex flex-col gap-5">
          {hasActiveEntries ? (
            <ResolverRows
              entries={lane.activeEntries}
              activeIds={lane.activeIds}
              canOpenDiff={lane.canOpenDiff}
              isQueueStalled={lane.isStalled}
              isTaskActive={lane.isTaskActive}
              isTranscriptLoading={lane.isTranscriptLoading}
              isMuted={false}
              selectedAgentId={lane.selectedAgentId}
              inspectedAgentId={inspectedResolverId}
              commentByThreadId={lane.commentByThreadId}
              diffCommentByAgentId={lane.diffCommentByAgentId}
              metrics={lane.metrics}
              reportedCommitShaByAgentId={lane.reportedCommitShaByAgentId}
              diffTargetByAgentId={lane.diffTargetByAgentId}
              onOpenChat={lane.onOpenChat}
              onInspect={onInspectResolver}
              onJump={lane.onJump}
              onOpenDiff={lane.onOpenDiff}
            />
          ) : null}
          {filedToggle}
          {showCompleted && lane.completedEntries.length > 0 ? (
            <ResolverRows
              entries={lane.completedEntries}
              activeIds={lane.activeIds}
              canOpenDiff={lane.canOpenDiff}
              isQueueStalled={lane.isStalled}
              isTaskActive={lane.isTaskActive}
              isTranscriptLoading={lane.isTranscriptLoading}
              isMuted
              selectedAgentId={lane.selectedAgentId}
              inspectedAgentId={inspectedResolverId}
              commentByThreadId={lane.commentByThreadId}
              diffCommentByAgentId={lane.diffCommentByAgentId}
              metrics={lane.metrics}
              reportedCommitShaByAgentId={lane.reportedCommitShaByAgentId}
              diffTargetByAgentId={lane.diffTargetByAgentId}
              onOpenChat={lane.onOpenChat}
              onInspect={onInspectResolver}
              onJump={lane.onJump}
              onOpenDiff={lane.onOpenDiff}
            />
          ) : null}
        </div>
      ) : null}
    </AgentLane>
  );
};
