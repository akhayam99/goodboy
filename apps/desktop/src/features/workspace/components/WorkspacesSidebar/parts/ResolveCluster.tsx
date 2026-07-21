import { ArrowUpRight, ChevronDown, ChevronRight, MessageSquareReply, Play } from 'lucide-react';
import type { Agent, AgentId, DiffComment, PrComment, SessionId } from '@goodboy/types';
import { openUrl } from '../../../../../shared/lib/editor';
import { resolverStatus, type ResolverState, type ResolverStatus } from '../lib';
import { ResolveClusterRow } from './ResolveClusterRow';

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
  readonly selectedAgentId: AgentId | null;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onSelect: (id: AgentId) => void;
  readonly onForceNext: () => void;
  readonly onResolveThread: (threadId: string) => Promise<void> | void;
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
  selectedAgentId,
  expanded,
  onToggle,
  onSelect,
  onForceNext,
  onResolveThread,
}: ResolveClusterProps) => {
  const statusOf = (a: Agent): ResolverStatus =>
    resolverStatus(a, resolvedThreadIds, pendingThreadIds, resolverState[a.id]);
  const resolvedCount = agents.filter((a) => statusOf(a) === 'resolved').length;
  const anyRunning = agents.some((a) => a.status === 'running');
  const queuedCount = agents.filter((a) => a.status === 'pending').length;
  const stalled = !anyRunning && queuedCount > 0;
  const jump = (agent: Agent) => {
    if (agent.sourceThreadId != null && prNumber != null) {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-github-session', {
          detail: { sessionId, prNumber, threadId: agent.sourceThreadId },
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
    <div className="flex flex-col gap-0.5 pl-2">
      <div className="flex items-center gap-1 pr-1">
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
          <span className="tabular-nums">
            {resolvedCount}/{agents.length}
          </span>{' '}
          resolved
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
          {agents.map((agent, i) => {
            const diffComment =
              agent.sourceThreadId == null && agent.sourceCommentUrl == null
                ? (diffCommentByAgentId.get(agent.id) ?? null)
                : null;
            const threadComment =
              agent.sourceThreadId != null
                ? (commentByThreadId.get(agent.sourceThreadId) ?? null)
                : null;
            return (
              <ResolveClusterRow
                key={agent.id}
                agent={agent}
                index={i}
                total={agents.length}
                status={statusOf(agent)}
                threadComment={threadComment}
                diffComment={diffComment}
                isSelected={agent.id === selectedAgentId}
                isTaskActive={isTaskActive}
                canJump={agent.sourceThreadId != null || agent.sourceCommentUrl != null}
                onSelect={() => onSelect(agent.id)}
                onJump={() => jump(agent)}
                onResolveThread={onResolveThread}
              />
            );
          })}
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
