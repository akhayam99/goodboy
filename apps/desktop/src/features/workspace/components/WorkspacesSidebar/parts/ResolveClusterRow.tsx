import { useState } from 'react';
import { StatusDot, cn } from '@goodboy/ui';
import { MessageSquareReply, PanelRight, Upload } from 'lucide-react';
import type { Agent, DiffComment, PrComment, TelemetryRecord } from '@goodboy/types';
import { agentHasUnread } from '../../../../../store';
import {
  ResolverStateBadge,
  resolverBadgeState,
} from '../../../../session/components/ResolverStateBadge';
import { CommentSnippet } from '../../../../session/components/CommentSnippet';
import { ForceResolveAction } from '../../../../session/components/ForceResolveAction';
import {
  AgentMetricsBlock,
  type AgentAggregate,
} from '../../../../session/components/AgentMetricsBlock';
import { AgentMetricsInline } from '../../../../session/components/AgentMetricsInline';
import { ContextWindowBar, type ProviderContextUsage } from './ContextWindowBar';
import { ForceCloseResolverAction } from '../../../../session/components/ForceCloseResolverAction';
import { diffCommentLocation } from '../../../../session/diff-comment-location';
import { prCommentLocation } from '../../../../session/pr-comment-location';
import type { ResolverStatus } from '../lib';

type Props = {
  readonly agent: Agent;
  readonly index: number;
  readonly total: number;
  readonly status: ResolverStatus;
  readonly threadComment: PrComment | null;
  readonly diffComment: DiffComment | null;
  readonly telemetry: TelemetryRecord | null;
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
  readonly turnsLoading: boolean;
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly canJump: boolean;
  readonly isInspected?: boolean;
  readonly onSelect: () => void;
  readonly onJump: () => void;
  readonly onInspect?: () => void;
  readonly onResolveThread: (threadId: string) => Promise<void> | void;
};

export const ResolveClusterRow = ({
  agent,
  index,
  total,
  status,
  threadComment,
  diffComment,
  telemetry,
  aggregate,
  contextUsage,
  turns,
  turnsLoading,
  isSelected,
  isTaskActive,
  canJump,
  isInspected = false,
  onSelect,
  onJump,
  onInspect,
  onResolveThread,
}: Props) => {
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
      location={prCommentLocation({ comment: threadComment })}
      body={threadComment.body}
    />
  ) : diffComment ? (
    <CommentSnippet
      location={diffCommentLocation({ comment: diffComment })}
      body={diffComment.body}
    />
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
        <span className="min-w-0 flex-1 truncate text-left" title={agent.name}>
          {agent.name}
        </span>
        <ResolverStateBadge state={resolverBadgeState(status)} />
        {onInspect !== undefined ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect();
            }}
            title="Inspect resolver"
            aria-label="Inspect resolver"
            aria-pressed={isInspected}
            className={cn(
              'shrink-0 rounded-md p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground',
              isInspected && 'bg-foreground/10 text-foreground',
            )}
          >
            <PanelRight size={11} aria-hidden />
          </button>
        ) : null}
        {canJump ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onJump();
            }}
            title="Go to comment"
            aria-label="Go to comment"
            className="shrink-0 rounded-md p-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <MessageSquareReply size={11} aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5 pl-7">
        <AgentMetricsInline
          telemetry={telemetry}
          aggregate={aggregate}
          contextUsage={contextUsage}
          turns={turns}
          turnsLoading={turnsLoading}
        />
        <AgentMetricsBlock run={agent} aggregate={aggregate} />
        <ContextWindowBar usage={contextUsage} />
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
      <div className="flex items-center justify-end gap-1.5 pl-7">
        <ForceCloseResolverAction agent={agent} sessionId={agent.sessionId} status={status} />
        <ForceResolveAction agent={agent} sessionId={agent.sessionId} status={status} />
      </div>
    </div>
  );
};
