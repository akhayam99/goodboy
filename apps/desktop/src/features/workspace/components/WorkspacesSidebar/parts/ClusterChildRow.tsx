import { StatusDot, cn, formatUsd } from '@goodboy/ui';
import { Check, Clock } from 'lucide-react';
import type { Agent } from '@goodboy/types';
import { agentHasUnread } from '../../../../../store';
import { useHoverMarkViewed } from '../../../../../features/session/hooks/useHoverMarkViewed';

type Props = {
  readonly child: Agent;
  readonly index: number;
  readonly total: number;
  readonly costUsd: number;
  readonly isSelected: boolean;
  readonly isTaskActive: boolean;
  readonly onSelect: () => void;
};

export const ClusterChildRow = ({
  child,
  index,
  total,
  costUsd,
  isSelected,
  isTaskActive,
  onSelect,
}: Props) => {
  const hasUnread = agentHasUnread(child, isSelected && isTaskActive);
  const hoverMarkViewed = useHoverMarkViewed({
    sessionId: child.sessionId,
    agentId: child.id,
    hasUnread,
  });
  const domains = child.domains ?? [];
  const visibleDomains = domains.slice(0, 3);
  const hiddenDomainCount = domains.length - visibleDomains.length;
  const icon =
    child.status === 'running' ? (
      <StatusDot tone="info" size="sm" pulsing />
    ) : child.status === 'completed' ? (
      <span className="flex size-3 items-center justify-center rounded-full bg-success/15">
        <Check size={8} className="text-success" aria-hidden />
      </span>
    ) : child.status === 'failed' ? (
      <StatusDot tone="danger" size="sm" />
    ) : (
      <Clock size={10} className="text-muted-foreground/60" aria-hidden />
    );
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={hoverMarkViewed.onMouseEnter}
      onMouseLeave={hoverMarkViewed.onMouseLeave}
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
      {visibleDomains.map((domain, domainIndex) => (
        <span
          key={`${domain}-${domainIndex}`}
          className="shrink-0 rounded bg-muted px-1 py-0.5 text-2xs font-normal text-muted-foreground"
        >
          {domain}
        </span>
      ))}
      {hiddenDomainCount > 0 ? (
        <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-2xs font-normal text-muted-foreground">
          +{hiddenDomainCount}
        </span>
      ) : null}
      {costUsd > 0 ? (
        <span className="shrink-0 tabular-nums text-muted-foreground/60">{formatUsd(costUsd)}</span>
      ) : null}
    </button>
  );
};
