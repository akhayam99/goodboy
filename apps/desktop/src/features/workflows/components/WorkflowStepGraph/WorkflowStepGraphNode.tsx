import { cn as tokenCn, tintClasses as tokenTintClasses } from '@goodboy/ui';
import { cn } from '@goodboy/ui';
import type { Agent, ProviderId, ProviderName } from '@goodboy/types';
import type { AgentKind } from '../../../session/agent-kind';
import { AgentKindChip } from '../../../session/components/AgentKindChip';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { WorkflowStepStatus } from '../WorkflowStepStatus';

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
  isSelected,
  onSelect,
}: Props) => (
  <div className="flex min-w-0 flex-1 items-center gap-1.5">
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        'flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg border bg-subtle px-2 py-1 text-left transition-colors hover:bg-hover',
        isSelected
          ? tokenCn(tokenTintClasses('primary').border, tokenTintClasses('primary').bgSoft)
          : 'border-border-soft',
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
        className="shrink-0 px-1 py-1 font-mono text-2xs tabular-nums text-faint-foreground"
      >
        {doneChildCount}/{childCount}
      </span>
    ) : null}
  </div>
);
