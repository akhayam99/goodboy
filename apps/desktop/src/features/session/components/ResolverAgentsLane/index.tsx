import { useEffect } from 'react';
import type { AgentId, Session } from '@goodboy/types';
import { AgentLane } from '../AgentLane';
import { AgentLaneEmpty } from '../AgentLane/AgentLaneEmpty';
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
};

export const ResolverAgentsLane = ({
  session,
  inspectedResolverId,
  onInspectResolver,
  showCompleted = false,
  onCompletedCountChange,
}: Props) => {
  const lane = useResolverAgentsLane({ session });
  const hasNoResolvers = lane.totalCount === 0;
  const hasVisibleEntries =
    lane.activeEntries.length > 0 || (showCompleted && lane.completedEntries.length > 0);

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
          prNumber={lane.prNumber}
          queuedCount={lane.queuedCount}
          isStalled={lane.isStalled}
          onForceNext={lane.onForceNext}
          onOpenPr={lane.onOpenPr}
        />
      }
      isEmpty={!hasVisibleEntries}
      empty={
        <AgentLaneEmpty
          title={hasNoResolvers ? 'Nothing to resolve' : 'No active resolvers'}
          description={hasNoResolvers ? NOTHING_TO_RESOLVE_DESCRIPTION : ALL_RESOLVED_DESCRIPTION}
          action={<ResolveCommentsAction variant="tile" onOpen={lane.onOpenResolveBoard} />}
        />
      }
      footer={<ResolveCommentsAction variant="link" onOpen={lane.onOpenResolveBoard} />}
    >
      <ResolverRows
        entries={lane.activeEntries}
        isTaskActive={lane.isTaskActive}
        isTranscriptLoading={lane.isTranscriptLoading}
        isMuted={false}
        selectedAgentId={lane.selectedAgentId}
        inspectedAgentId={inspectedResolverId}
        commentByThreadId={lane.commentByThreadId}
        diffCommentByAgentId={lane.diffCommentByAgentId}
        metrics={lane.metrics}
        reportedCommitShaByAgentId={lane.reportedCommitShaByAgentId}
        onOpenChat={lane.onOpenChat}
        onInspect={onInspectResolver}
        onJump={lane.onJump}
      />
      {showCompleted && lane.completedEntries.length > 0 ? (
        <ResolverRows
          entries={lane.completedEntries}
          isTaskActive={lane.isTaskActive}
          isTranscriptLoading={lane.isTranscriptLoading}
          isMuted
          selectedAgentId={lane.selectedAgentId}
          inspectedAgentId={inspectedResolverId}
          commentByThreadId={lane.commentByThreadId}
          diffCommentByAgentId={lane.diffCommentByAgentId}
          metrics={lane.metrics}
          reportedCommitShaByAgentId={lane.reportedCommitShaByAgentId}
          onOpenChat={lane.onOpenChat}
          onInspect={onInspectResolver}
          onJump={lane.onJump}
        />
      ) : null}
    </AgentLane>
  );
};
