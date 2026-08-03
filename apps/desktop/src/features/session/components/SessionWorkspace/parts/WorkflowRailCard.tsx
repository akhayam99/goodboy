import { ChevronRight } from 'lucide-react';
import type { Agent, Workflow, WorkflowOrigin, WorkflowRun } from '@goodboy/types';
import { cn, formatUsdPrecise } from '@goodboy/ui';
import { classifyWorkflowChain } from '@goodboy/core';
import { workflowKindName } from '../../../../workspace/components/WorkspacesSidebar/lib';
import { WorkflowRunStatus } from '../../../../workspace/components/WorkspacesSidebar/parts/WorkflowRunStatus';
import { formatRelativeDuration } from '../../../../../shared/utils/relativeDate';
import { CostBadge } from '../../../../providers/components/CostBadge';
import { WorkflowOriginTag } from '../../../../workflows/components/WorkflowOriginTag';

type Props = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly costUsd: number | null;
  readonly predecessorName: string;
  readonly onSelect: () => void;
  readonly onRestore: () => void;
};

export const WorkflowRailCard = ({
  run,
  workflow,
  agents,
  costUsd,
  predecessorName,
  onSelect,
  onRestore,
}: Props) => {
  const chain = classifyWorkflowChain(workflow, agents);
  const stepLine =
    chain.kind === 'complete'
      ? null
      : chain.kind === 'blocked'
        ? `Blocked at ${chain.failedStep.name}`
        : `Next: ${chain.step.name}`;

  const isDiscarded = run.discardedAt != null;
  const ranAgents = [...agents]
    .filter((agent) => agent.status !== 'pending')
    .sort((left, right) => left.ordinal - right.ordinal);
  const lastAgent = ranAgents.at(-1) ?? null;
  const startedAt = ranAgents
    .map((agent) => agent.startedAt)
    .filter((value): value is NonNullable<typeof value> => value != null)
    .sort()[0];
  const completedAt = ranAgents
    .map((agent) => agent.completedAt)
    .filter((value): value is NonNullable<typeof value> => value != null)
    .sort()
    .at(-1);
  const isCompleted =
    run.executionMode === 'dynamic'
      ? run.orchestrationOutcome === 'done'
      : chain.kind === 'complete';
  const duration =
    isCompleted && startedAt != null && completedAt != null
      ? formatRelativeDuration(startedAt, completedAt)
      : null;
  const origin: WorkflowOrigin | null =
    run.executionMode === 'dynamic' ? 'orchestrated' : (workflow.origin ?? null);
  const stepCount =
    run.executionMode === 'dynamic'
      ? `${ranAgents.length} ${ranAgents.length === 1 ? 'step' : 'steps'} run`
      : `${ranAgents.length} of ${workflow.steps.length} steps run`;

  return (
    <div className="relative flex w-full flex-col">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border border-border-soft bg-elevated/40 px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
          isDiscarded && 'pr-16 opacity-70',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="line-clamp-2 text-sm font-medium text-foreground">
            {workflowKindName(workflow)}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <WorkflowRunStatus
              run={run}
              workflow={workflow}
              agents={agents}
              predecessorName={predecessorName}
            />
            {stepLine != null ? (
              <span className="line-clamp-1 text-2xs text-muted-foreground">{stepLine}</span>
            ) : null}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
            <span className="tabular-nums">{stepCount}</span>
            {duration != null ? (
              <>
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
                <span className="tabular-nums">{duration}</span>
              </>
            ) : null}
            {costUsd != null ? (
              <>
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
                <CostBadge value={costUsd} title={`${formatUsdPrecise(costUsd)} for this run`} />
              </>
            ) : null}
            {lastAgent != null ? (
              <>
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
                <span className="min-w-0 truncate">Last: {lastAgent.name}</span>
              </>
            ) : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {origin != null ? <WorkflowOriginTag origin={origin} /> : null}
          <ChevronRight size={14} aria-hidden className="text-muted-foreground/50" />
        </span>
      </button>
      {isDiscarded ? (
        <button
          type="button"
          onClick={onRestore}
          title="restore workflow"
          className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          Restore
        </button>
      ) : null}
    </div>
  );
};
