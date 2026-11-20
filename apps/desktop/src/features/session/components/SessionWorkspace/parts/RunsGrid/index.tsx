import { useMemo, type ComponentProps } from 'react';
import type { MountId, Session } from '@goodboy/types';
import { Button, Chip, ListGrid } from '@goodboy/ui';
import { useAppStore } from '../../../../../../store';
import { GroupBySwitch } from '../../../../../../shared/components/GroupBySwitch';
import { useGroupBy } from '../../../../../../store/slices/session-grouping/hooks/useGroupBy';
import { NAMES } from '../../../../../../shared/utils/names';
import { branchGroupOrderOf } from '../../../../branchGroupOrderOf';
import { branchGroupsOf, namedBranchGroupCountOf } from '../../../../branchGroupsOf';
import { openBranchWorkTab } from '../../../../openBranchWorkTab';
import { runBranchMembershipOf } from '../../../../runBranchMembershipOf';
import { runGroupKeyOf, runGroupsOf } from '../../../../runGroupsOf';
import type { SessionRun } from '../../../../sessionRunsOf';
import { useMountRows } from '../../../../../../shared/hooks/useMountRows';
import { useCanOpenBranchWork } from '../../../../hooks/useCanOpenBranchWork';
import { useRunsFilter } from '../../../../hooks/useRunsFilter';
import { ContinueAllAction } from './ContinueAllAction';
import { FinishedBranches } from './FinishedBranches';
import { NothingRunningLine } from './NothingRunningLine';
import { RunsByBranch } from './RunsByBranch';
import { RunsByState } from './RunsByState';
import { StopAllAction } from './StopAllAction';
import { openSessionRun } from './openSessionRun';
import { RUNS_GRID_COLUMNS } from './runsGridColumns';
import { useRunRowRender } from './useRunRowRender';
import { FINISHED_FOLD_KEY } from './finishedFoldKey';
import { useRunsFolds } from './useRunsFolds';

type Props = {
  readonly session: Session;
  readonly runs: ReadonlyArray<SessionRun>;
};

type RowParams = {
  readonly run: SessionRun;
  readonly rowKey: string;
};

type MountParams = {
  readonly mountId: MountId;
};

export const RunsGrid = ({ session, runs: sessionRuns }: Props) => {
  const sessionId = session.id;
  const setGroupBy = useAppStore((state) => state.setGroupBy);
  const mountGroups = useMountRows({ sessionId });
  const canOpenBranch = useCanOpenBranchWork({ sessionId });
  const filter = useRunsFilter({ sessionId });
  const liveRuns = useMemo(() => sessionRuns.filter((run) => !run.isArchived), [sessionRuns]);
  const runs = useMemo(
    () =>
      filter.isRunningOnly
        ? liveRuns.filter((run) => runGroupKeyOf({ run }) === 'running')
        : liveRuns,
    [filter.isRunningOnly, liveRuns],
  );
  const mounts = useMemo(
    () => mountGroups.flatMap((group) => [...group.rows, ...group.finishedRows]),
    [mountGroups],
  );
  const branchCount = useMemo(
    () =>
      namedBranchGroupCountOf({
        branchLists: runs.map((run) => runBranchMembershipOf({ run })),
        mounts,
      }),
    [runs, mounts],
  );
  const groupBy = useGroupBy({ sessionId, branchCount });
  const stateGroups = useMemo(() => runGroupsOf({ runs }), [runs]);
  const branchOrder = useMemo(
    () => branchGroupOrderOf({ groups: branchGroupsOf({ runs, mounts }), mounts }),
    [runs, mounts],
  );
  const folds = useRunsFolds({ groupBy, runs, branchOrder });
  const { rowReturn, revealRun } = folds;

  const openBranch = ({ mountId }: MountParams) => {
    openBranchWorkTab({ sessionId, mountId });
  };

  const open = ({ run, rowKey }: RowParams) => {
    rowReturn.remember({ rowId: rowKey });
    openSessionRun({ sessionId, run });
  };

  const renderRow = useRunRowRender({ session, onOpen: open });

  const byBranch: Omit<ComponentProps<typeof RunsByBranch>, 'groups' | 'headingLevel'> = {
    mounts,
    openGroups: folds.openGroups,
    onToggleGroup: folds.toggleGroup,
    onOpenBranch: openBranch,
    canOpenBranch,
    onRevealRun: revealRun,
    renderRow,
  };

  const clearFilter = (
    <Button variant="ghost" size="xs" onClick={filter.clear}>
      Clear filter
    </Button>
  );

  if (filter.isRunningOnly && runs.length === 0) {
    return <NothingRunningLine clearFilter={clearFilter} />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {filter.isRunningOnly ? (
        <div data-runs-filter="" className="flex items-center gap-2">
          <Chip tone="neutral" kind="reference" label={NAMES.running} />
          {clearFilter}
        </div>
      ) : null}
      <div data-runs-actions="" className="flex items-center justify-end gap-3 empty:hidden">
        <StopAllAction sessionId={sessionId} />
        <ContinueAllAction sessionId={sessionId} runs={liveRuns} />
        {branchCount < 2 ? null : (
          <GroupBySwitch
            value={groupBy}
            onChange={(next) => setGroupBy({ sessionId, groupBy: next })}
          />
        )}
      </div>
      <ListGrid label={NAMES.runs} columns={RUNS_GRID_COLUMNS} isGrouped>
        {groupBy === 'branch' ? (
          <>
            <RunsByBranch groups={branchOrder.shown} {...byBranch} />
            <FinishedBranches
              count={branchOrder.finished.length}
              isOpen={folds.openGroups.has(FINISHED_FOLD_KEY)}
              onToggle={() => folds.toggleGroup({ key: FINISHED_FOLD_KEY })}
            >
              <RunsByBranch groups={branchOrder.finished} headingLevel={3} {...byBranch} />
            </FinishedBranches>
          </>
        ) : (
          <RunsByState
            groups={stateGroups}
            isEarlierShown={folds.isEarlierShown}
            onToggleEarlier={folds.toggleEarlier}
            onOpenBranch={openBranch}
            canOpenBranch={canOpenBranch}
            renderRow={renderRow}
          />
        )}
      </ListGrid>
    </div>
  );
};
