import type { WorkflowRunHistoryRow } from '@goodboy/db';
import type { Workflow } from '@goodboy/types';
import { Button, DrawerFrame, EmptyLine, Skeleton } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { WorkflowRunHistoryLoad } from '../../../../store/slices/workflowStudio/types';
import { workflowRunsOf } from '../../workflowRunsOf';
import { WorkflowHistoryList } from './WorkflowHistoryList';

type Props = {
  readonly workflow: Workflow;
  readonly load: WorkflowRunHistoryLoad | null;
  readonly onRetry: () => void;
  readonly onClose: () => void;
  readonly onOpenWorkflow: () => void;
  readonly onOpenRun: (run: WorkflowRunHistoryRow) => void;
  readonly onStartRun: () => void;
};

type CountParams = {
  readonly count: number;
};

const runCountOf = ({ count }: CountParams): string => `${count} ${count === 1 ? 'run' : 'runs'}`;

export const WorkflowHistoryPane = ({
  workflow,
  load,
  onRetry,
  onClose,
  onOpenWorkflow,
  onOpenRun,
  onStartRun,
}: Props) => {
  const runs =
    load === null || load.runs === null
      ? null
      : workflowRunsOf({ runs: load.runs, workflowId: workflow.id });
  const isFailed = load?.status === 'failed';
  return (
    <DrawerFrame
      title={workflow.name}
      icon={CONCEPT_ICONS.workflows}
      closeLabel="Close runs"
      {...(runs !== null && { count: runCountOf({ count: runs.length }) })}
      action={
        <Button size="xs" variant="ghost" onClick={onOpenWorkflow}>
          Open workflow
        </Button>
      }
      onClose={onClose}
    >
      <div className="flex min-w-0 flex-col gap-3">
        {isFailed ? (
          <EmptyLine
            action={
              <Button size="xs" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            }
          >
            Could not load runs.
          </EmptyLine>
        ) : null}
        {runs === null && !isFailed ? (
          <div role="status" aria-label="Loading runs" className="flex flex-col gap-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : null}
        {runs !== null && runs.length === 0 ? (
          <EmptyLine
            action={
              <Button size="xs" variant="secondary" onClick={onStartRun}>
                Start a run with this workflow
              </Button>
            }
          >
            No runs yet.
          </EmptyLine>
        ) : null}
        {runs !== null && runs.length > 0 ? (
          <WorkflowHistoryList workflowName={workflow.name} runs={runs} onOpenRun={onOpenRun} />
        ) : null}
      </div>
    </DrawerFrame>
  );
};
