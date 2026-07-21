import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { cn } from '@goodboy/ui';
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
  const completedSteps = agents.filter(
    (agent) => agent.status === 'completed' || agent.status === 'skipped',
  ).length;

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
      <div className="flex w-full items-center justify-between gap-2">
        <WorkflowRunStatus
          run={run}
          workflow={workflow}
          agents={agents}
          predecessorName={predecessorName}
        />
        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
          {completedSteps}/{workflow.steps.length} steps
        </span>
      </div>
    </button>
  );
};
