import type { WorkflowRunHistoryRow } from '@goodboy/db';
import type { Workflow } from '@goodboy/types';
import { ROW_INTERACTIVE, StatusDot, TEXT_ROLE, cn } from '@goodboy/ui';
import { formatAge } from '../../../../../shared/utils/time/formatAge';
import { useNow } from '../../../../../shared/hooks/useNow';
import type { BuiltinWorkflowState } from '../../../builtinWorkflowState';
import { WorkflowRoleGlyphs } from './WorkflowRoleGlyphs';

type Props = {
  readonly workflow: Workflow;
  readonly builtin: BuiltinWorkflowState;
  readonly runs: ReadonlyArray<WorkflowRunHistoryRow> | null;
  readonly onOpen: () => void;
  readonly onShowRuns: () => void;
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

export const WorkflowListRow = ({ workflow, builtin, runs, onOpen, onShowRuns }: Props) => {
  const now = useNow(30_000);
  const steps = workflow.steps.filter((step) => step.deletedAt == null).length;
  const latest = runs?.[0];
  const lastRun = latest === undefined ? '' : formatAge({ from: latest.createdAt, now });
  return (
    <li className="col-span-full grid grid-cols-subgrid">
      <button
        type="button"
        data-list-grid-row=""
        onClick={onOpen}
        aria-label={`Open ${workflow.name}`}
        className={cn('col-start-1 col-end-[-4]', ROW_BUTTON)}
      >
        <span className={cn('col-start-2 min-w-0 truncate text-row', TEXT_ROLE.label)}>
          {workflow.name}
        </span>
        <span className={cn('flex min-w-0 items-center gap-2', TEXT_ROLE.secondary)}>
          {builtin === 'custom' ? null : (
            <>
              {builtin === 'edited' ? <StatusDot tone="warning" size="sm" /> : null}
              <span className={cn('truncate', builtin === 'edited' ? '' : TEXT_ROLE.hint)}>
                {builtin === 'edited' ? 'Edited' : 'Built in'}
              </span>
            </>
          )}
        </span>
        <WorkflowRoleGlyphs workflow={workflow} />
        <span className={cn(END_CELL, TEXT_ROLE.secondary)}>
          {countOf({ count: steps, noun: 'step' })}
        </span>
      </button>
      <button
        type="button"
        data-list-grid-row=""
        onClick={onShowRuns}
        aria-label={runsLabelOf({ name: workflow.name, runs, lastRun })}
        className={cn('col-start-[-4] col-end-[-1]', ROW_BUTTON)}
      >
        <span className={cn(END_CELL, TEXT_ROLE.hint)}>
          {runs !== null && runs.length === 0 ? 'No runs' : lastRun}
        </span>
        <span className={cn(END_CELL, TEXT_ROLE.secondary)}>
          {runs === null || runs.length === 0 ? '' : countOf({ count: runs.length, noun: 'run' })}
        </span>
      </button>
    </li>
  );
};
