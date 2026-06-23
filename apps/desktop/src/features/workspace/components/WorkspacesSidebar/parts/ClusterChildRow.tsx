import { cn } from '@goodboy/ui';
import { Check, Clock, Loader2 } from 'lucide-react';
import type { Agent } from '@goodboy/types';
import { agentHasUnread } from '../../../../../store';

type ClusterChildRowProps = {
  readonly child: Agent;
  readonly index: number;
  readonly total: number;
  readonly costUsd: number;
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly onSelect: () => void;
};

export function ClusterChildRow({
  child,
  index,
  total,
  costUsd,
  isSelected,
  isTaskActive,
  onSelect,
}: ClusterChildRowProps) {
  const hasUnread = agentHasUnread(child, isSelected && isTaskActive);
  const icon =
    child.status === 'running' ? (
      <Loader2 size={10} className="motion-safe:animate-spin text-info" aria-hidden />
    ) : child.status === 'completed' ? (
      <span className="flex size-3 items-center justify-center rounded-full bg-success/15">
        <Check size={8} className="text-success" aria-hidden />
      </span>
    ) : child.status === 'failed' ? (
      <span className="size-1.5 rounded-full bg-danger" aria-hidden />
    ) : (
      <Clock size={10} className="text-muted-foreground/60" aria-hidden />
    );
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded border-l-2 border-transparent px-2 py-1 text-2xs font-medium transition-colors',
        hasUnread && !isSelected && 'border-warning/70 bg-warning/5',
        isSelected
          ? 'bg-elevated text-foreground'
          : 'text-foreground/70 hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <span className="tabular-nums text-muted-foreground/50">
        {index + 1}/{total}
      </span>
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{child.name}</span>
      {costUsd > 0 && (
        <span
          className="shrink-0 tabular-nums text-muted-foreground/60"
          title={`$${costUsd.toFixed(4)}`}
        >
          ${costUsd.toFixed(2)}
        </span>
      )}
    </button>
  );
}
