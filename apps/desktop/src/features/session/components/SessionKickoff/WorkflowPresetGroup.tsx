import { Eyebrow, cn } from '@goodboy/ui';
import type { Workflow, WorkflowId } from '@goodboy/types';

type Props = {
  readonly label: string;
  readonly workflows: ReadonlyArray<Workflow>;
  readonly pickedId: WorkflowId | null;
  readonly onPick: (workflowId: WorkflowId) => void;
};

export const WorkflowPresetGroup = ({ label, workflows, pickedId, onPick }: Props) => {
  if (workflows.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Eyebrow label={label} className="px-2.5" />
      <ul aria-label={label} className="flex flex-col gap-0.5">
        {workflows.map((workflow) => {
          const isPicked = workflow.id === pickedId;
          return (
            <li key={workflow.id}>
              <button
                type="button"
                aria-pressed={isPicked}
                onClick={() => onPick(workflow.id)}
                className={cn(
                  'flex w-full min-w-0 items-baseline gap-2 rounded-md px-2 py-1.5 text-left motion-safe:transition-colors',
                  isPicked ? 'bg-selected' : 'hover:bg-hover',
                )}
              >
                <span className="shrink-0 text-body text-foreground">{workflow.name}</span>
                <span className="min-w-0 flex-1 truncate text-label text-muted-foreground">
                  {workflow.description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
