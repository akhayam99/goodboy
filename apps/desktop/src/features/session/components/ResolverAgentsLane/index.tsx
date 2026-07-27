import { useState } from 'react';
import type { AgentId, Session } from '@goodboy/types';
import { AgentLane } from '../AgentLane';
import { AgentLaneEmpty } from '../AgentLane/AgentLaneEmpty';
import { AgentLaneNote } from '../AgentLane/AgentLaneNote';
import type { CompletionTab } from '../AgentLane/completionTab';
import { ResolveCommentsAction } from './ResolveCommentsAction';
import { ResolverLaneToolbar } from './ResolverLaneToolbar';
import { ResolverRows } from './ResolverRows';
import { useResolverAgentsLane } from './useResolverAgentsLane';

const NOTHING_TO_RESOLVE_DESCRIPTION =
  'Spawn a resolver from a pull request comment or a diff selection and it will show up here.';
const ALL_RESOLVED_DESCRIPTION =
  'Every resolver here has finished. Check the completed tab for what they did.';

type Props = {
  readonly session: Session;
  readonly inspectedResolverId: AgentId | null;
  readonly onInspectResolver: (agentId: AgentId) => void;
};

export const ResolverAgentsLane = ({ session, inspectedResolverId, onInspectResolver }: Props) => {
  const lane = useResolverAgentsLane({ session });
  const [tab, setTab] = useState<CompletionTab>('active');
  const entries = tab === 'completed' ? lane.completedEntries : lane.activeEntries;
  const hasNoResolvers = lane.totalCount === 0;

  return (
    <AgentLane
      ariaLabel="Filter resolvers by status"
      activeCount={lane.activeEntries.length}
      completedCount={lane.completedEntries.length}
      tab={tab}
      onTabChange={setTab}
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
      isEmpty={entries.length === 0}
      emptyActive={
        <AgentLaneEmpty
          title={hasNoResolvers ? 'Nothing to resolve' : 'No active resolvers'}
          description={hasNoResolvers ? NOTHING_TO_RESOLVE_DESCRIPTION : ALL_RESOLVED_DESCRIPTION}
          action={<ResolveCommentsAction variant="tile" onOpen={lane.onOpenResolveBoard} />}
        />
      }
      emptyCompleted={<AgentLaneNote text="No completed resolvers yet." />}
      footer={<ResolveCommentsAction variant="link" onOpen={lane.onOpenResolveBoard} />}
    >
      <ResolverRows
        entries={entries}
        isTaskActive={lane.isTaskActive}
        isTranscriptLoading={lane.isTranscriptLoading}
        isMuted={tab === 'completed'}
        selectedAgentId={lane.selectedAgentId}
        inspectedAgentId={inspectedResolverId}
        commentByThreadId={lane.commentByThreadId}
        diffCommentByAgentId={lane.diffCommentByAgentId}
        metrics={lane.metrics}
        onOpenChat={lane.onOpenChat}
        onInspect={onInspectResolver}
        onJump={lane.onJump}
        onResolveThread={lane.onResolveThread}
        onResolveAgent={lane.onResolveAgent}
      />
    </AgentLane>
  );
};
