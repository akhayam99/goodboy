import { useMemo, type ComponentProps } from 'react';
import type { MountId, Session } from '@goodboy/types';
import { ListGrid } from '@goodboy/ui';
import { useAppStore } from '../../../../../../store';
import { GroupBySwitch } from '../../../../../../shared/components/GroupBySwitch';
import { useGroupBy } from '../../../../../../store/slices/session-grouping/hooks/useGroupBy';
import { NAMES } from '../../../../../../shared/utils/names';
import { branchGroupOrderOf } from '../../../../branchGroupOrderOf';
import { branchGroupsOf, namedBranchGroupCountOf } from '../../../../branchGroupsOf';
import { openBranchWorkTab } from '../../../../openBranchWorkTab';
import { runGroupsOf } from '../../../../runGroupsOf';
import type { SessionRun } from '../../../../sessionRunsOf';
import { useMountRows } from '../../../../../../shared/hooks/useMountRows';
import { useCanOpenBranchWork } from '../../../../hooks/useCanOpenBranchWork';
import { ContinueAllAction } from './ContinueAllAction';
import { FinishedBranches } from './FinishedBranches';
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
  const runs = useMemo(() => sessionRuns.filter((run) => !run.isArchived), [sessionRuns]);
  const mounts = useMemo(
    () => mountGroups.flatMap((group) => [...group.rows, ...group.finishedRows]),
    [mountGroups],
  );
  const branchCount = useMemo(
    () => namedBranchGroupCountOf({ branchLists: runs.map((run) => run.branches), mounts }),
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

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div data-runs-actions="" className="flex items-center justify-end gap-3 empty:hidden">
        <StopAllAction sessionId={sessionId} />
        <ContinueAllAction sessionId={sessionId} runs={runs} />
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
