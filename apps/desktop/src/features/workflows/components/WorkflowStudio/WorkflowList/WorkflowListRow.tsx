import type { WorkflowRunHistoryRow } from '@goodboy/db';
import type { Workflow } from '@goodboy/types';
import { Copy } from '@goodboy/ui/icons';
import { IconButton, ROW_INTERACTIVE, TEXT_ROLE, cn } from '@goodboy/ui';
import { formatAge } from '../../../../../shared/utils/time/formatAge';
import { useNow } from '../../../../../shared/hooks/useNow';
import type { BuiltinWorkflowState } from '../../../builtinWorkflowState';
import { WorkflowRoleNames } from './WorkflowRoleNames';

type Props = {
  readonly workflow: Workflow;
  readonly builtin: BuiltinWorkflowState;
  readonly runs: ReadonlyArray<WorkflowRunHistoryRow> | null;
  readonly isHistoryFailed: boolean;
  readonly onOpen: () => void;
  readonly onShowRuns: () => void;
  readonly onDuplicate: () => void;
};

type CountParams = {
  readonly count: number;
  readonly noun: string;
};

const countOf = ({ count, noun }: CountParams): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

type RunsLabelParams = {
  readonly name: string;
  readonly runs: ReadonlyArray<WorkflowRunHistoryRow> | null;
  readonly lastRun: string;
};

const runsLabelOf = ({ name, runs, lastRun }: RunsLabelParams): string => {
  if (runs === null) {
    return `Runs of ${name}`;
  }
  if (runs.length === 0) {
    return `Runs of ${name}: none yet`;
  }
  return `Runs of ${name}: last run ${lastRun}, ${countOf({ count: runs.length, noun: 'run' })}`;
};

const ROW_BUTTON = cn(
  'grid h-8 grid-cols-subgrid items-center rounded-md text-left',
  ROW_INTERACTIVE,
);

const END_CELL = 'min-w-0 truncate justify-self-end text-right tabular-nums';

export const WorkflowListRow = ({
  workflow,
  builtin,
  runs,
  isHistoryFailed,
  onOpen,
  onShowRuns,
  onDuplicate,
}: Props) => {
  const now = useNow(30_000);
  const steps = workflow.steps.filter((step) => step.deletedAt == null).length;
  const latest = runs?.[0];
  const lastRun = latest === undefined ? '' : formatAge({ from: latest.createdAt, now });
  const runsWord =
    runs === null
      ? isHistoryFailed
        ? 'Runs'
        : null
      : runs.length === 0
        ? 'No runs'
        : countOf({ count: runs.length, noun: 'run' });
  return (
    <li className="col-span-full grid grid-cols-subgrid">
      <button
        type="button"
        data-list-grid-row=""
        onClick={onOpen}
        aria-label={`Open ${workflow.name}`}
        className={cn('col-start-1 col-end-[-4]', ROW_BUTTON)}
      >
        <span className="col-start-2 flex min-w-0 items-baseline gap-2">
          <span className={cn('shrink-0 text-row', TEXT_ROLE.label)}>{workflow.name}</span>
          <span data-workflow-use-when="" className={cn('min-w-0 truncate', TEXT_ROLE.hint)}>
            {workflow.description}
          </span>
        </span>
        <span className={cn('min-w-0 truncate', TEXT_ROLE.hint)}>
          {builtin === 'custom' ? '' : builtin === 'edited' ? 'Edited' : 'Built in'}
        </span>
        <WorkflowRoleNames workflow={workflow} />
        <span className={cn(END_CELL, TEXT_ROLE.secondary)}>
          {countOf({ count: steps, noun: 'step' })}
        </span>
        <span className={cn(END_CELL, TEXT_ROLE.hint)}>{lastRun}</span>
      </button>
      <span className="col-start-[-4] col-end-[-3] flex h-8 min-w-0 items-center justify-end">
        {runsWord === null ? null : (
          <button
            type="button"
            onClick={onShowRuns}
            aria-label={runsLabelOf({ name: workflow.name, runs, lastRun })}
            className={cn(
              'min-w-0 truncate rounded-md px-1 text-right tabular-nums underline decoration-border underline-offset-2',
              ROW_INTERACTIVE,
              TEXT_ROLE.secondary,
            )}
          >
            {runsWord}
          </button>
        )}
      </span>
      <span className="col-start-[-3] col-end-[-1] flex h-8 min-w-0 items-center justify-end">
        <IconButton
          icon={Copy}
          label={`Duplicate ${workflow.name}`}
          tooltip="Duplicate workflow"
          size="xs"
          variant="ghost"
          onClick={onDuplicate}
        />
      </span>
    </li>
  );
};
