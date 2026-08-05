import { ArrowUpRight, Check, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { AgentId, DiffComment } from '@goodboy/types';
import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';

type Props = {
  comment: DiffComment;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onViewAgent: (agentId: AgentId) => void;
  getAgentName: (agentId: AgentId) => string | undefined;
};

export const CommentItem = ({
  comment,
  onResolve,
  onReopen,
  onDelete,
  onViewAgent,
  getAgentName,
}: Props) => {
  const agentName = comment.consumedByAgentId ? getAgentName(comment.consumedByAgentId) : undefined;
  const containerClass =
    comment.status === 'resolved'
      ? 'border-success/40 bg-success/5 opacity-60'
      : comment.status === 'consumed'
        ? 'border-info/40 bg-info/5'
        : 'border-warning bg-warning/5';
  const statusPill =
    comment.status === 'resolved'
      ? { label: 'resolved', cls: 'bg-success/15 text-success' }
      : comment.status === 'consumed'
        ? { label: 'in progress', cls: 'bg-info/15 text-info' }
        : null;
  return (
    <div
      className={cn('group flex flex-col gap-1.5 rounded-md border-l-2 px-3 py-2', containerClass)}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-3xs font-semibold uppercase text-muted-foreground"
        >
          ME
        </span>
        <span className="text-2xs font-medium text-foreground">you</span>
        <span className="text-3xs text-muted-foreground/70">
          {formatRelativeAge({ fromIso: comment.createdAt })}
        </span>
        {statusPill ? (
          <span className={cn('rounded-full px-1.5 py-0.5 text-3xs font-medium', statusPill.cls)}>
            {statusPill.label}
          </span>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {comment.status === 'open' && (
            <button
              type="button"
              onClick={() => onResolve(comment.id)}
              title="Mark resolved"
              aria-label="Mark resolved"
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-success"
            >
              <Check size={11} />
            </button>
          )}
          {comment.status === 'consumed' && (
            <button
              type="button"
              onClick={() => onReopen(comment.id)}
              title="Reopen note"
              aria-label="Reopen note"
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-warning"
            >
              <RotateCcw size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(comment.id)}
            title="Delete"
            aria-label="Delete"
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-danger"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
        {comment.status === 'resolved' ? (
          <span className="line-through">{comment.body}</span>
        ) : (
          comment.body
        )}
      </p>
      {comment.status === 'consumed' && (
        <div className="flex items-center gap-1.5 text-3xs text-muted-foreground">
          {agentName && comment.consumedByAgentId ? (
            <>
              <span>consumed by</span>
              <button
                type="button"
                onClick={() => onViewAgent(comment.consumedByAgentId as AgentId)}
                className="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-info hover:bg-info/10 hover:text-info"
              >
                <span className="font-medium">{agentName}</span>
                <ArrowUpRight size={9} aria-hidden />
              </button>
            </>
          ) : (
            <span className="italic">consumed by removed agent</span>
          )}
        </div>
      )}
    </div>
  );
};
