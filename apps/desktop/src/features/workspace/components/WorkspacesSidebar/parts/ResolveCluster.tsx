import { cn } from '@goodboy/ui';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  GitCommit,
  Loader2,
  MessageSquareReply,
  Play,
} from 'lucide-react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { agentHasUnread } from '../../../../../store';
import { openUrl } from '../../../../../shared/lib/editor';
import { resolverStatus, type ResolverState, type ResolverStatus } from '../lib';

type ResolveClusterProps = {
  readonly agents: ReadonlyArray<Agent>;
  readonly sessionId: SessionId;
  readonly isTaskActive: boolean;
  readonly prNumber: number | null;
  readonly resolvedThreadIds: ReadonlySet<string>;
  readonly pendingThreadIds: ReadonlySet<string>;
  readonly resolverState: Readonly<Record<string, ResolverState>>;
  readonly selectedAgentId: AgentId | null;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onSelect: (id: AgentId) => void;
  readonly onForceNext: () => void;
};

export function ResolveCluster({
  agents,
  sessionId,
  isTaskActive,
  prNumber,
  resolvedThreadIds,
  pendingThreadIds,
  resolverState,
  selectedAgentId,
  expanded,
  onToggle,
  onSelect,
  onForceNext,
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
          {resolvedCount}/{agents.length} resolved
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
      </div>
      {expanded
        ? agents.map((agent, i) => (
            <ResolveClusterRow
              key={agent.id}
              agent={agent}
              index={i}
              total={agents.length}
              status={statusOf(agent)}
              isSelected={agent.id === selectedAgentId}
              isTaskActive={isTaskActive}
              canJump={agent.sourceThreadId != null || agent.sourceCommentUrl != null}
              onSelect={() => onSelect(agent.id)}
              onJump={() => jump(agent)}
            />
          ))
        : null}
    </div>
  );
}

type ResolveClusterRowProps = {
  readonly agent: Agent;
  readonly index: number;
  readonly total: number;
  readonly status: ResolverStatus;
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly canJump: boolean;
  readonly onSelect: () => void;
  readonly onJump: () => void;
};

function ResolveClusterRow({
  agent,
  index,
  total,
  status,
  isSelected,
  isTaskActive,
  canJump,
  onSelect,
  onJump,
}: ResolveClusterRowProps) {
  const hasUnread = agentHasUnread(agent, isSelected && isTaskActive);
  const icon =
    status === 'running' ? (
      <Loader2 size={10} className="motion-safe:animate-spin text-info" aria-hidden />
    ) : status === 'failed' ? (
      <span className="size-1.5 rounded-full bg-danger" aria-hidden />
    ) : status === 'pending' ? (
      <Clock size={10} className="text-muted-foreground/60" aria-hidden />
    ) : status === 'resolved' ? (
      <CheckCheck size={10} className="text-success" aria-hidden />
    ) : status === 'committed' ? (
      <GitCommit size={10} className="text-warning" aria-hidden />
    ) : status === 'wontfix' ? (
      <Ban size={10} className="text-muted-foreground/70" aria-hidden />
    ) : status === 'awaiting' ? (
      <AlertTriangle size={10} className="text-warning" aria-hidden />
    ) : (
      <Check size={10} className="text-muted-foreground/70" aria-hidden />
    );
  const statusLabel =
    status === 'resolved'
      ? 'resolved on GitHub'
      : status === 'committed'
        ? 'committed locally, pending push'
        : status === 'wontfix'
          ? 'explained, pending resolve'
          : status === 'awaiting'
            ? 'needs you: no commit yet'
            : status === 'running'
              ? 'working'
              : status === 'pending'
                ? 'queued'
                : status === 'failed'
                  ? 'failed'
                  : 'done locally';
  return (
    <div
      className={cn(
        'flex w-full items-center gap-2 rounded border px-2 py-1 text-2xs font-medium transition-colors',
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
      <span className="tabular-nums text-muted-foreground/50">
        {index + 1}/{total}
      </span>
      <span title={statusLabel}>{icon}</span>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 truncate text-left hover:text-foreground"
      >
        {agent.name}
      </button>
      {canJump ? (
        <button
          type="button"
          onClick={onJump}
          title="go to the review comment"
          aria-label="go to the review comment"
          className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <MessageSquareReply size={11} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
