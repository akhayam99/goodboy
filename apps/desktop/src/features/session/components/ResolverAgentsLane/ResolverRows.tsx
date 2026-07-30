import type { Agent, AgentId, DiffComment, PrComment } from '@goodboy/types';
import { EMPTY_ARRAY } from '../../../../store';
import type { AgentMetrics } from '../../hooks/useAgentMetrics';
import { agentThreadIds } from '../../agentThreadIds';
import type { ResolverLink } from '../../resolver-linkage';
import { ResolverCard } from './ResolverCard';

type Props = {
  readonly entries: ReadonlyArray<ResolverLink>;
  readonly isTaskActive: boolean;
  readonly isTranscriptLoading: boolean;
  readonly isMuted: boolean;
  readonly selectedAgentId: AgentId | null;
  readonly inspectedAgentId: AgentId | null;
  readonly commentByThreadId: ReadonlyMap<string, PrComment>;
  readonly diffCommentByAgentId: ReadonlyMap<AgentId, DiffComment>;
  readonly metrics: AgentMetrics;
  readonly reportedCommitShaByAgentId: ReadonlyMap<AgentId, string>;
  readonly onOpenChat: (agentId: AgentId) => void;
  readonly onInspect: (agentId: AgentId) => void;
  readonly onJump: (agent: Agent) => void;
};

export const ResolverRows = ({
  entries,
  isTaskActive,
  isTranscriptLoading,
  isMuted,
  selectedAgentId,
  inspectedAgentId,
  commentByThreadId,
  diffCommentByAgentId,
  metrics,
  reportedCommitShaByAgentId,
  onOpenChat,
  onInspect,
  onJump,
}: Props) => (
  <ul className="flex flex-col gap-1">
    {entries.map(({ agent, status }) => {
      const threadIds = agentThreadIds(agent);
      const threadId = threadIds[0];
      const diffComment =
        threadIds.length === 0 && agent.sourceCommentUrl == null
          ? (diffCommentByAgentId.get(agent.id) ?? null)
          : null;
      const threadComment = threadId != null ? (commentByThreadId.get(threadId) ?? null) : null;
      return (
        <ResolverCard
          key={agent.id}
          agent={agent}
          status={status}
          threadComment={threadComment}
          diffComment={diffComment}
          telemetry={metrics.latestTelemetryByAgentId.get(agent.id) ?? null}
          aggregate={metrics.aggregatesByAgentId.get(agent.id) ?? null}
          contextUsage={metrics.providerUsageByAgentId.get(agent.id) ?? EMPTY_ARRAY}
          turns={metrics.turnsByAgentId.get(agent.id) ?? 0}
          turnsLoading={agent.id === selectedAgentId && isTranscriptLoading}
          reportedCommitSha={reportedCommitShaByAgentId.get(agent.id) ?? null}
          isSelected={agent.id === selectedAgentId}
          isTaskActive={isTaskActive}
          isInspected={agent.id === inspectedAgentId}
          isMuted={isMuted}
          canJump={threadIds.length > 0 || agent.sourceCommentUrl != null}
          onOpenChat={() => onOpenChat(agent.id)}
          onInspect={() => onInspect(agent.id)}
          onJump={() => onJump(agent)}
        />
      );
    })}
  </ul>
);
