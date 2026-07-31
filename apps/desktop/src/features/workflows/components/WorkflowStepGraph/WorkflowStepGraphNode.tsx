import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Agent, ProviderId } from '@goodboy/types';
import type { AgentKind } from '../../../session/agent-kind';
import { AgentKindChip } from '../../../session/components/AgentKindChip';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { WorkflowStepStatus } from '../WorkflowStepStatus';

type Props = {
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly provider: ProviderId;
  readonly model: string;
  readonly marker: string;
  readonly childCount: number;
  readonly doneChildCount: number;
  readonly isBranchOpen: boolean;
  readonly isSelected: boolean;
  readonly onToggleBranch: () => void;
  readonly onSelect: () => void;
};

export const WorkflowStepGraphNode = ({
  run,
  kind,
  provider,
  model,
  marker,
  childCount,
  doneChildCount,
  isBranchOpen,
  isSelected,
  onToggleBranch,
  onSelect,
}: Props) => (
  <div className="flex min-w-0 items-center gap-1.5">
    <span className="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground/50">
      {marker}
    </span>
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        'flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg border bg-muted/30 px-2 py-1 text-left transition-colors hover:bg-muted/60',
        isSelected ? 'border-primary/50 bg-primary/[0.06]' : 'border-border-soft',
      )}
    >
      <AgentKindChip kind={kind} />
      <span className="min-w-0 flex-1 truncate text-2xs font-medium text-foreground">
        {run.name}
      </span>
      <WorkflowStepStatus status={run.status} label={run.name} />
      <RoutingBadge provider={provider} model={model} className="max-w-28 shrink-0" />
    </button>
    {childCount > 0 ? (
      <button
        type="button"
        onClick={onToggleBranch}
        aria-expanded={isBranchOpen}
        aria-label={`${isBranchOpen ? 'hide' : 'show'} the ${childCount} agents under ${run.name}`}
        className="flex shrink-0 items-center gap-0.5 rounded-md px-1 py-1 font-mono text-[10px] tabular-nums text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        {isBranchOpen ? (
          <ChevronDown size={11} aria-hidden />
        ) : (
          <ChevronRight size={11} aria-hidden />
        )}
        {doneChildCount}/{childCount}
      </button>
    ) : null}
  </div>
);
