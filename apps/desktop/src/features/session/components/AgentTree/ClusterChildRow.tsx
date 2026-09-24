import { StatusDot, cn, formatUsd, formatUsdPrecise, tintClasses } from '@goodboy/ui';
import { Check, Clock } from 'lucide-react';
import type { Agent } from '@goodboy/types';
import { agentHasUnread, useAppStore } from '../../../../store';
import { useHoverMarkViewed } from '../../hooks/useHoverMarkViewed';
import { CapabilityObligationAction } from '../../../../shared/components/CapabilityObligationAction';
import { ClusterCompletionHoldAction } from '../../../../shared/components/ClusterCompletionHoldAction';
import { useClusterNode } from '../../../workflows/useClusterNode';

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
  const startAttempt = useAppStore((state) => state.clusterStartAttempts[child.id] ?? 1);
  const completionHold = useAppStore(
    (state) =>
      state.clusterCompletionHolds?.[child.sessionId]?.find(
        (hold) => hold.sourceAgentId === child.id && hold.state === 'open',
      ) ?? null,
  );
  const obligation = useAppStore(
    (state) =>
      state.capabilityObligations?.[child.sessionId]?.find(
        (candidate) => candidate.requesterAgentId === child.id && candidate.state === 'open',
      ) ?? null,
  );
  const clusterNode = useClusterNode({ sessionId: child.sessionId, agentId: child.id });
  const isWaiting =
    child.status === 'pending' && (clusterNode?.pendingDependencyTitles.length ?? 0) > 0;
  const domains = child.domains ?? [];
  const visibleDomains = domains.slice(0, 3);
  const hiddenDomainCount = domains.length - visibleDomains.length;
  const icon =
    child.status === 'running' ? (
      <StatusDot tone="info" size="sm" pulsing />
    ) : child.status === 'completed' ? (
      <span
        className={cn(
          'flex size-3 items-center justify-center rounded-full',
          tintClasses('success').bg,
        )}
      >
        <Check size={8} className="text-success" aria-hidden />
      </span>
    ) : child.status === 'failed' ? (
      <StatusDot tone="danger" size="sm" />
    ) : (
      <Clock size={10} className="text-faint-foreground" aria-hidden />
    );
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={hoverMarkViewed.onMouseEnter}
        onMouseLeave={hoverMarkViewed.onMouseLeave}
        className={cn(
          'flex w-full items-center gap-2 rounded-sm border-l-2 border-transparent px-2 py-1 text-2xs font-medium transition-colors',
          hasUnread && !isSelected && cn(tintClasses('warning').border),
          isSelected
            ? 'bg-elevated text-foreground'
            : 'text-muted-foreground hover:bg-hover hover:text-foreground',
        )}
      >
        <span className="tabular-nums text-faint-foreground">
          {index + 1}/{total}
        </span>
        {icon}
        <span className="min-w-0 flex-1 truncate text-left">{child.name}</span>
        {clusterNode !== null && clusterNode.role !== 'implementer' ? (
          <span
            className="shrink-0 rounded-sm bg-muted px-1 py-0.5 text-2xs font-normal uppercase tracking-eyebrow text-muted-foreground"
            title={`this cluster runs with the ${clusterNode.role} role`}
          >
            {clusterNode.role}
          </span>
        ) : null}
        {isWaiting ? (
          <span
            className="shrink-0 rounded-sm bg-muted px-1 py-0.5 text-2xs font-normal text-muted-foreground"
            title={`waits for ${clusterNode?.pendingDependencyTitles.join(', ') ?? ''}`}
          >
            waits
          </span>
        ) : null}
        {startAttempt > 1 && child.status !== 'completed' && child.status !== 'skipped' ? (
          <span
            className={cn(
              'shrink-0 rounded-sm',
              tintClasses('warning').bg,
              'px-1 py-0.5 text-2xs font-normal text-warning',
            )}
            title={`this cluster agent failed to start and is on attempt ${startAttempt}`}
          >
            attempt {startAttempt}
          </span>
        ) : null}
        {visibleDomains.map((domain, domainIndex) => (
          <span
            key={`${domain}-${domainIndex}`}
            className="shrink-0 rounded-sm bg-muted px-1 py-0.5 text-2xs font-normal text-muted-foreground"
          >
            {domain}
          </span>
        ))}
        {hiddenDomainCount > 0 ? (
          <span className="shrink-0 rounded-sm bg-muted px-1 py-0.5 text-2xs font-normal text-muted-foreground">
            +{hiddenDomainCount}
          </span>
        ) : null}
        {costUsd > 0 ? (
          <span
            className="shrink-0 tabular-nums text-faint-foreground"
            title={formatUsdPrecise(costUsd)}
          >
            {formatUsd(costUsd)}
          </span>
        ) : null}
      </button>
      {completionHold === null ? null : <ClusterCompletionHoldAction hold={completionHold} />}
      {obligation === null ? null : <CapabilityObligationAction obligation={obligation} />}
    </div>
  );
};
