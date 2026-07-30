import { cn } from '@goodboy/ui';
import type { Agent } from '@goodboy/types';
import type { AgentKind } from '../../../session/agent-kind';
import { AgentKindChip } from '../../../session/components/AgentKindChip';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { WorkflowStepStatusGlyph } from './WorkflowStepStatusGlyph';

type Props = {
  readonly run: Agent;
  readonly kind: AgentKind;
  readonly model: string;
  readonly children: ReadonlyArray<Agent>;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
};

export const WorkflowStepStripItem = ({
  run,
  kind,
  model,
  children,
  isSelected,
  onSelect,
}: Props) => {
  const completedChildren = children.filter(
    (child) => child.status === 'completed' || child.status === 'skipped',
  ).length;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        'inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-lg border bg-muted/30 px-2 py-1 text-left transition-colors hover:bg-muted/60',
        isSelected ? 'border-primary/50 bg-primary/[0.06]' : 'border-border-soft',
      )}
    >
      <AgentKindChip kind={kind} />
      <span className="max-w-36 truncate text-2xs font-medium text-foreground">{run.name}</span>
      <span className="flex min-w-4 shrink-0 items-center justify-center font-mono text-[10px] text-muted-foreground">
        {children.length > 0 ? (
          `${completedChildren}/${children.length}`
        ) : (
          <WorkflowStepStatusGlyph status={run.status} />
        )}
      </span>
      <RoutingBadge model={model} className="max-w-28 shrink-0" />
    </button>
  );
};
