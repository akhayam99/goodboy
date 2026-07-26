import type { Agent, AgentId, DiffComment, PrComment } from '@goodboy/types';
import { EMPTY_ARRAY } from '../../../../../store';
import type { AgentMetrics } from '../../../../session/hooks/useAgentMetrics';
import type { ResolverStatus } from '../lib';
import { ResolveClusterRow } from './ResolveClusterRow';
import { agentThreadIds } from '../../../../session/agentThreadIds';

type Entry = {
  readonly agent: Agent;
  readonly status: ResolverStatus;
  readonly index: number;
};

type Props = {
  readonly entries: ReadonlyArray<Entry>;
  readonly total: number;
  readonly isTaskActive: boolean;
  readonly isTranscriptLoading: boolean;
  readonly selectedAgentId: AgentId | null;
  readonly inspectedAgentId: AgentId | null;
  readonly commentByThreadId: ReadonlyMap<string, PrComment>;
  readonly diffCommentByAgentId: ReadonlyMap<AgentId, DiffComment>;
  readonly metrics: AgentMetrics;
  readonly onSelect: (id: AgentId) => void;
  readonly onInspect?: (id: AgentId) => void;
  readonly onJump: (agent: Agent) => void;
  readonly onResolveThread: (threadId: string) => Promise<void> | void;
  readonly onResolveAgent: (agentId: AgentId) => Promise<void> | void;
};

export const ResolverRows = ({
  entries,
  total,
  isTaskActive,
  isTranscriptLoading,
  selectedAgentId,
  inspectedAgentId,
  commentByThreadId,
  diffCommentByAgentId,
  metrics,
  onSelect,
  onInspect,
  onJump,
  onResolveThread,
  onResolveAgent,
}: Props) => (
  <>
    {entries.map(({ agent, status, index }) => {
      const threadIds = agentThreadIds(agent);
      const threadId = threadIds[0];
      const diffComment =
        threadIds.length === 0 && agent.sourceCommentUrl == null
          ? (diffCommentByAgentId.get(agent.id) ?? null)
          : null;
      const threadComment = threadId != null ? (commentByThreadId.get(threadId) ?? null) : null;
      return (
        <ResolveClusterRow
          key={agent.id}
          agent={agent}
          index={index}
          total={total}
          status={status}
          threadComment={threadComment}
          diffComment={diffComment}
          telemetry={metrics.latestTelemetryByAgentId.get(agent.id) ?? null}
          aggregate={metrics.aggregatesByAgentId.get(agent.id) ?? null}
          contextUsage={metrics.providerUsageByAgentId.get(agent.id) ?? EMPTY_ARRAY}
          turns={metrics.turnsByAgentId.get(agent.id) ?? 0}
          turnsLoading={agent.id === selectedAgentId && isTranscriptLoading}
          isSelected={agent.id === selectedAgentId}
          isTaskActive={isTaskActive}
          canJump={threadIds.length > 0 || agent.sourceCommentUrl != null}
          isInspected={agent.id === inspectedAgentId}
          onSelect={() => onSelect(agent.id)}
          onJump={() => onJump(agent)}
          onInspect={onInspect === undefined ? undefined : () => onInspect(agent.id)}
          onResolveThread={onResolveThread}
          onResolveAgent={onResolveAgent}
        />
      );
    })}
  </>
);
