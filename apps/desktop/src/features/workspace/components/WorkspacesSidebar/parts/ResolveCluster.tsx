import { useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronRight, MessageSquareReply, Play } from 'lucide-react';
import type { Agent, AgentId, DiffComment, PrComment, SessionId } from '@goodboy/types';
import { openUrl } from '../../../../../shared/lib/editor';
import { SegmentedControl } from '../../../../../shared/components/SegmentedControl';
import type { AgentMetrics } from '../../../../session/hooks/useAgentMetrics';
import {
  pluralize,
  resolveCompletionTab,
  resolverStatus,
  type CompletionTab,
  type ResolverState,
  type ResolverStatus,
} from '../lib';
import { ResolverRows } from './ResolverRows';
import { agentThreadIds } from '../../../../session/agentThreadIds';

const COMPLETED_STATUSES: ReadonlyArray<ResolverStatus> = [
  'resolved',
  'wontfix',
  'stopped',
  'done',
];

type ResolveClusterProps = {
  readonly agents: ReadonlyArray<Agent>;
  readonly sessionId: SessionId;
  readonly isTaskActive: boolean;
  readonly prNumber: number | null;
  readonly resolvedThreadIds: ReadonlySet<string>;
  readonly pendingThreadIds: ReadonlySet<string>;
  readonly resolverState: Readonly<Record<string, ResolverState>>;
  readonly commentByThreadId: ReadonlyMap<string, PrComment>;
  readonly diffCommentByAgentId: ReadonlyMap<AgentId, DiffComment>;
  readonly metrics: AgentMetrics;
  readonly isTranscriptLoading: boolean;
  readonly selectedAgentId: AgentId | null;
  readonly inspectedAgentId?: AgentId | null;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onSelect: (id: AgentId) => void;
  readonly onInspect?: (id: AgentId) => void;
  readonly onForceNext: () => void;
  readonly onResolveThread: (threadId: string) => Promise<void> | void;
  readonly onResolveAgent: (agentId: AgentId) => Promise<void> | void;
};

export const ResolveCluster = ({
  agents,
  sessionId,
  isTaskActive,
  prNumber,
  resolvedThreadIds,
  pendingThreadIds,
  resolverState,
  commentByThreadId,
  diffCommentByAgentId,
  metrics,
  isTranscriptLoading,
  selectedAgentId,
  inspectedAgentId = null,
  expanded,
  onToggle,
  onSelect,
  onInspect,
  onForceNext,
  onResolveThread,
  onResolveAgent,
}: ResolveClusterProps) => {
  const statusOf = (a: Agent): ResolverStatus =>
    resolverStatus(a, resolvedThreadIds, pendingThreadIds, resolverState[a.id]);
  const entries = [...agents]
    .sort((a, b) => b.ordinal - a.ordinal)
    .map((agent) => ({ agent, status: statusOf(agent) }));
  const completedEntries = entries.filter(({ status }) => COMPLETED_STATUSES.includes(status));
  const activeEntries = entries.filter(({ status }) => !COMPLETED_STATUSES.includes(status));
  const [selectedTab, setSelectedTab] = useState<CompletionTab | null>(null);
  const tab = resolveCompletionTab({
    activeCount: activeEntries.length,
    completedCount: completedEntries.length,
    selected: selectedTab,
  });
  const visibleEntries = tab === 'completed' ? completedEntries : activeEntries;
  const anyRunning = agents.some((a) => a.status === 'running');
  const queuedCount = agents.filter((a) => a.status === 'pending').length;
  const stalled = !anyRunning && queuedCount > 0;
  const jump = (agent: Agent) => {
    const threadId = agentThreadIds(agent)[0];
    if (threadId != null && prNumber != null) {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-github-session', {
          detail: { sessionId, prNumber, threadId },
        }),
      );
    } else if (agent.sourceCommentUrl != null) {
      void openUrl(agent.sourceCommentUrl);
    }
  };
  const openResolveBoard = () =>
    window.dispatchEvent(new CustomEvent('goodboy:open-github-session', { detail: { sessionId } }));
  const openPr = () => {
    if (prNumber == null) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent('goodboy:open-github-session', { detail: { sessionId, prNumber } }),
    );
  };
  return (
    <div className="flex flex-col gap-1 pl-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'collapse' : 'expand'} resolve cluster`}
          className="flex min-w-0 flex-1 items-center gap-1 px-2 py-0.5 text-2xs uppercase tracking-wide text-success/80 transition-colors hover:text-success"
        >
          {expanded ? (
            <ChevronDown size={10} aria-hidden className="shrink-0" />
          ) : (
            <ChevronRight size={10} aria-hidden className="shrink-0" />
          )}
          {pluralize(agents.length, 'resolver')}
        </button>
        {stalled ? (
          <button
            type="button"
            onClick={onForceNext}
            title="the current resolver has not committed or explained yet; run the next queued one anyway"
            className="inline-flex shrink-0 items-center gap-1 rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning transition-colors hover:bg-warning/20"
          >
            <Play size={9} aria-hidden />
            Run next ({queuedCount})
          </button>
        ) : null}
        {prNumber != null ? (
          <button
            type="button"
            onClick={openPr}
            title="open the pull request in studio"
            aria-label="open the pull request in studio"
            className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            Open PR
            <ArrowUpRight size={10} aria-hidden />
          </button>
        ) : null}
      </div>
      {expanded ? (
        <>
          {completedEntries.length > 0 ? (
            <SegmentedControl
              ariaLabel="Filter resolvers by status"
              options={[
                { value: 'active', label: `Active (${activeEntries.length})` },
                { value: 'completed', label: `Completed (${completedEntries.length})` },
              ]}
              value={tab}
              onChange={setSelectedTab}
            />
          ) : null}
          <ResolverRows
            entries={visibleEntries}
            isTaskActive={isTaskActive}
            isTranscriptLoading={isTranscriptLoading}
            selectedAgentId={selectedAgentId}
            inspectedAgentId={inspectedAgentId}
            commentByThreadId={commentByThreadId}
            diffCommentByAgentId={diffCommentByAgentId}
            metrics={metrics}
            onSelect={onSelect}
            onInspect={onInspect}
            onJump={jump}
            onResolveThread={onResolveThread}
            onResolveAgent={onResolveAgent}
          />
          <button
            type="button"
            onClick={openResolveBoard}
            className="mt-0.5 inline-flex items-center gap-1 self-start rounded px-2 py-0.5 text-2xs font-medium text-muted-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <MessageSquareReply size={11} aria-hidden />
            Resolve comments
            <ArrowUpRight size={10} aria-hidden className="opacity-70" />
          </button>
        </>
      ) : null}
    </div>
  );
};
