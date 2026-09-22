import { cn } from '@goodboy/ui';
import type { Agent, ProviderId, ProviderName } from '@goodboy/types';
import type { AgentKind } from '../../../session/agent-kind';
import { AgentKindChip } from '../../../session/components/AgentKindChip';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { WorkflowStepStatus } from '../WorkflowStepStatus';
import { useAppStore } from '../../../../store';
import { ClusterCompletionHoldAction } from '../../../../shared/components/ClusterCompletionHoldAction';
import { useClusterNode } from '../../useClusterNode';

type Props = {
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly provider: ProviderName;
  readonly model: string;
  readonly plannedProvider: ProviderId;
  readonly plannedModel: string;
  readonly marker: string;
  readonly childCount: number;
  readonly doneChildCount: number;
  readonly answersForStepName: string | null;
  readonly visibleAgentIds: ReadonlySet<string>;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
};

export const WorkflowStepGraphNode = ({
  run,
  kind,
  provider,
  model,
  plannedProvider,
  plannedModel,
  marker,
  childCount,
  doneChildCount,
  answersForStepName,
  visibleAgentIds,
  isSelected,
  onSelect,
}: Props) => {
  const clusterNode = useClusterNode({ sessionId: run.sessionId, agentId: run.id });
  const completionHold = useAppStore((state) => {
    const openHolds = (state.clusterCompletionHolds?.[run.sessionId] ?? []).filter(
      (hold) => hold.state === 'open',
    );
    const sourceHold = openHolds.find((hold) => hold.sourceAgentId === run.id);
    if (sourceHold !== undefined) {
      return sourceHold;
    }
    return (
      openHolds.find(
        (hold) => hold.containerAgentId === run.id && !visibleAgentIds.has(hold.sourceAgentId),
      ) ?? null
    );
  });
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className={cn(
          'flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg border bg-muted/30 px-2 py-1 text-left transition-colors hover:bg-muted/60',
          isSelected ? 'border-primary/50 bg-primary/[0.06]' : 'border-border-soft',
        )}
      >
        <span className="sr-only">{marker}</span>
        <AgentKindChip kind={kind} />
        <span className="min-w-0 flex-1 truncate text-2xs font-medium text-foreground">
          {run.name}
        </span>
        {answersForStepName !== null ? (
          <span
            data-testid={`answers-for-${run.id}`}
            className="max-w-40 shrink-0 truncate text-3xs text-muted-foreground"
          >
            answering for {answersForStepName}
          </span>
        ) : null}
        {clusterNode !== null && clusterNode.dependsOnTitles.length > 0 ? (
          <span
            data-testid={`depends-on-${run.id}`}
            className="max-w-40 shrink-0 truncate text-3xs text-muted-foreground"
            title={`depends on ${clusterNode.dependsOnTitles.join(', ')}`}
          >
            after {clusterNode.dependsOnTitles.join(', ')}
          </span>
        ) : null}
        <RoutingBadge
          provider={provider}
          model={model}
          planned={{ provider: plannedProvider, model: plannedModel }}
          glyphPlacement="trailing"
          className="max-w-40 shrink-0"
        />
        <WorkflowStepStatus status={run.status} label={run.name} />
      </button>
      {childCount > 0 ? (
        <span
          title={`${doneChildCount} of ${childCount} agents under ${run.name} are done`}
          className="shrink-0 px-1 py-1 font-mono text-2xs tabular-nums text-muted-foreground/70"
        >
          {doneChildCount}/{childCount}
        </span>
      ) : null}
      {completionHold === null ? null : <ClusterCompletionHoldAction hold={completionHold} />}
    </div>
  );
};
