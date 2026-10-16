import { useState } from 'react';
import type { WorkflowRunHistoryRow } from '@goodboy/db';
import { ListGrid, ListGridRow, SegmentedTabs, StateDot, formatUsd } from '@goodboy/ui';
import { sessionTitle } from '../../../session/sessionTitle';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { runHistoryState, type RunHistoryStateKey } from '../../runHistoryState';
import { HISTORY_COLUMNS } from './historyColumns';

type Props = {
  readonly workflowName: string;
  readonly runs: ReadonlyArray<WorkflowRunHistoryRow>;
  readonly onOpenRun: (run: WorkflowRunHistoryRow) => void;
};

type HistoryFilter = 'all' | 'running' | 'failed';

const FILTER_FROM = 11;

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'failed', label: 'Failed' },
] as const satisfies ReadonlyArray<{ readonly value: HistoryFilter; readonly label: string }>;

type MatchParams = {
  readonly filter: HistoryFilter;
  readonly key: RunHistoryStateKey;
};

const isShownBy = ({ filter, key }: MatchParams): boolean => filter === 'all' || filter === key;

export const WorkflowHistoryList = ({ workflowName, runs, onOpenRun }: Props) => {
  const now = useNow(30_000);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const hasFilter = runs.length >= FILTER_FROM;
  const rows = runs
    .map((run) => ({ run, state: runHistoryState({ run }) }))
    .filter(({ state }) => !hasFilter || isShownBy({ filter, key: state.key }));
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {hasFilter ? (
        <SegmentedTabs
          ariaLabel="Show runs"
          size="xs"
          className="w-max"
          value={filter}
          onChange={setFilter}
          options={FILTER_OPTIONS}
        />
      ) : null}
      <ListGrid label={`Runs of ${workflowName}`} columns={HISTORY_COLUMNS}>
        {rows.map(({ run, state }) => {
          const title = sessionTitle({ session: { goal: run.sessionGoal } });
          return (
            <ListGridRow
              key={run.workflowRunId}
              ariaLabel={`Open the run in ${title}`}
              tooltip={`${title} · ${state.label}`}
              onSelect={() => onOpenRun(run)}
              cells={[
                <StateDot state={state.dot} label={state.label} isLive />,
                title,
                run.costUsd > 0 ? formatUsd(run.costUsd) : '',
                formatAge({ from: run.createdAt, now }),
              ]}
            />
          );
        })}
      </ListGrid>
    </div>
  );
};
