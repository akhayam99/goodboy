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
  readonly isSelected: boolean;
  readonly onSelect: () => void;
};

export const WorkflowRailCard = ({
  run,
  workflow,
  agents,
  predecessorName,
  isSelected,
  onSelect,
}: Props) => {
  const chain = classifyWorkflowChain(workflow, agents);
  const stepLine =
    chain.kind === 'complete'
      ? null
      : chain.kind === 'blocked'
        ? `Blocked at ${chain.failedStep.name}`
        : `Next: ${chain.step.name}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? 'true' : undefined}
      className={cn(
        'flex w-full flex-col items-start gap-1.5 rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
        isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40',
      )}
    >
      <span className="line-clamp-2 text-xs font-medium text-foreground">
        {workflowKindName(workflow)}
      </span>
      <WorkflowRunStatus
        run={run}
        workflow={workflow}
        agents={agents}
        predecessorName={predecessorName}
      />
      {stepLine != null ? (
        <span className="line-clamp-1 w-full text-2xs text-muted-foreground">{stepLine}</span>
      ) : null}
    </button>
  );
};
