import { ChevronRight } from 'lucide-react';
import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { classifyWorkflowChain } from '@goodboy/core';
import { workflowKindName } from '../../../../workspace/components/WorkspacesSidebar/lib';
import { WorkflowRunStatus } from '../../../../workspace/components/WorkspacesSidebar/parts/WorkflowRunStatus';

type Props = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly predecessorName: string;
  readonly onSelect: () => void;
  readonly onRestore: () => void;
};

export const WorkflowRailCard = ({
  run,
  workflow,
  agents,
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
        </span>
        <ChevronRight size={14} aria-hidden className="shrink-0 text-muted-foreground/50" />
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
