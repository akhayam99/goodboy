import { useState } from 'react';
import { StatusDot, cn } from '@goodboy/ui';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  MessageSquareReply,
  Play,
  Upload,
} from 'lucide-react';
import type { Agent, AgentId, DiffComment, PrComment, SessionId } from '@goodboy/types';
import { agentHasUnread } from '../../../../../store';
import { openUrl } from '../../../../../shared/lib/editor';
import {
  ResolverStateBadge,
  resolverBadgeState,
} from '../../../../session/components/ResolverStateBadge';
import { CommentSnippet } from '../../../../session/components/CommentSnippet';
import { resolverStatus, type ResolverState, type ResolverStatus } from '../lib';

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

const diffLocation = (comment: DiffComment): string => {
  if (comment.anchor == null) {
    return comment.filePath;
  }
  return `${comment.filePath}:${comment.anchor.lineNumber}`;
};

const commentLocation = (comment: PrComment): string | null => {
  if (comment.source === 'issue') {
    return 'conversation';
  }
  if (comment.path == null) {
    return null;
  }
  return comment.line != null ? `${comment.path}:${comment.line}` : comment.path;
};

export function ResolveCluster({
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
}: ResolveClusterProps) {
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
}

type ResolveClusterRowProps = {
  readonly agent: Agent;
  readonly index: number;
  readonly total: number;
  readonly status: ResolverStatus;
  readonly threadComment: PrComment | null;
  readonly diffComment: DiffComment | null;
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly canJump: boolean;
  readonly onSelect: () => void;
  readonly onJump: () => void;
  readonly onResolveThread: (threadId: string) => Promise<void> | void;
};

function ResolveClusterRow({
  agent,
  index,
  total,
  status,
  threadComment,
  diffComment,
  isSelected,
  isTaskActive,
  canJump,
  onSelect,
  onJump,
  onResolveThread,
}: ResolveClusterRowProps) {
  const hasUnread = agentHasUnread(agent, isSelected && isTaskActive);
  const [pushing, setPushing] = useState(false);
  const canPush = agent.sourceThreadId != null && (status === 'committed' || status === 'wontfix');
  const onPush = async () => {
    if (pushing || agent.sourceThreadId == null) {
      return;
    }
    setPushing(true);
    try {
      await onResolveThread(agent.sourceThreadId);
    } finally {
      setPushing(false);
    }
  };
  const snippet = threadComment ? (
    <CommentSnippet
      author={threadComment.author}
      location={commentLocation(threadComment)}
      body={threadComment.body}
    />
  ) : diffComment ? (
    <CommentSnippet location={diffLocation(diffComment)} body={diffComment.body} />
  ) : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={agent.name}
      className={cn(
        'relative flex w-full cursor-pointer flex-col gap-1 rounded border px-2 py-1.5 text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
        isSelected
          ? 'bg-elevated text-foreground border-border'
          : 'text-foreground/70 hover:bg-muted/60',
        status === 'running'
          ? 'border-info/60'
          : status === 'awaiting' || hasUnread
            ? 'border-warning/70'
            : 'border-transparent',
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span className="tabular-nums text-muted-foreground/50">
          {index + 1}/{total}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{agent.name}</span>
        <ResolverStateBadge state={resolverBadgeState(status)} />
        {canJump ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onJump();
            }}
            title="Go to comment"
            aria-label="Go to comment"
            className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <MessageSquareReply size={11} aria-hidden />
          </button>
        ) : null}
      </div>
      {snippet ? <div className="pl-7">{snippet}</div> : null}
      {canPush ? (
        <div className="flex justify-end pl-7">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void onPush();
            }}
            disabled={pushing}
            title="push the branch and resolve this comment now"
            className={cn(
              'inline-flex items-center gap-1 rounded-full border border-info/40 px-2 py-0.5 text-[10px] font-semibold text-info transition-colors hover:bg-info/10 disabled:cursor-not-allowed disabled:opacity-60',
              pushing && 'animate-border-pulse',
            )}
          >
            {pushing ? (
              <StatusDot tone="info" size="sm" pulsing />
            ) : (
              <Upload size={9} aria-hidden />
            )}
            {pushing ? 'Pushing…' : 'Push & resolve this'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
