import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Agent, AgentId, MountId, Session } from '@goodboy/types';
import { ListGrid } from '@goodboy/ui';
import { agentPlace, useAppStore } from '../../../../../../store';
import { useNow } from '../../../../../../shared/hooks/useNow';
import { GroupBySwitch } from '../../../../../../shared/components/GroupBySwitch';
import { openAgentRevealEvent } from '../../../../../../shared/utils/openAgentReveal';
import { branchPlace } from '../../../../../../store/slices/navigation/place';
import { useGroupBy } from '../../../../../../store/slices/session-grouping/selectors';
import { runPlace } from '../../../../../workflows/runPlace';
import { useAgentMetrics } from '../../../../hooks/useAgentMetrics';
import { useRowReturn } from '../../../../../../shared/hooks/useRowReturn';
import { openSpawned } from '../../../../openSpawned';
import { NAMES } from '../../../../../../shared/utils/names';
import { VISIBLE_FINISHED_COUNT } from '../../../../finishedRunsCap';
import { branchGroupsOf } from '../../../../branchGroupsOf';
import { runGroupsOf } from '../../../../runGroupsOf';
import type { SessionRun } from '../../../../sessionRunsOf';
import { useMountRows } from '../../../SessionOverviewPane/ProjectMountRows/useMountRows';
import { RunsByBranch } from './RunsByBranch';
import { RunsByState } from './RunsByState';
import { RunsGridAgentRow } from './RunsGridAgentRow';
import { RunsGridRow } from './RunsGridRow';
import { RUNS_GRID_COLUMNS } from './runsGridColumns';

type Props = {
  readonly session: Session;
  readonly runs: ReadonlyArray<SessionRun>;
};

type RowParams = {
  readonly run: SessionRun;
  readonly rowKey: string;
};

type RenderParams = RowParams & {
  readonly titleSuffix: ReactNode;
};

type GroupParams = {
  readonly key: string;
};

type MountParams = {
  readonly mountId: MountId;
};

type AgentParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly agentId: AgentId;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const agentOf = ({ agents, agentId }: AgentParams): Agent | null =>
  agents.find((candidate) => candidate.id === agentId) ?? null;

export const RunsGrid = ({ session, runs }: Props) => {
  const sessionId = session.id;
  const now = useNow(30_000);
  const navigate = useAppStore((state) => state.navigate);
  const setGroupBy = useAppStore((state) => state.setGroupBy);
  const { aggregatesByAgentId } = useAgentMetrics({ sessionId });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const mountGroups = useMountRows({ sessionId });
  const mounts = useMemo(
    () => mountGroups.flatMap((group) => [...group.rows, ...group.finishedRows]),
    [mountGroups],
  );
  const branchCount = useMemo(
    () => new Set(runs.flatMap((run) => run.branches.map((branch) => branch.mountId))).size,
    [runs],
  );
  const groupBy = useGroupBy({ sessionId, branchCount });
  const [isEarlierShown, setIsEarlierShown] = useState(false);
  const [isArchivedShown, setIsArchivedShown] = useState(false);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const stateGroups = useMemo(() => runGroupsOf({ runs }), [runs]);
  const branchGroups = useMemo(() => branchGroupsOf({ runs, mounts }), [runs, mounts]);
  const finished = runs.filter((run) => run.isFinished && !run.isArchived);
  const archived = runs.filter((run) => run.isArchived);
  const rowIds = useMemo(
    () =>
      groupBy === 'branch'
        ? branchGroups.flatMap((group) => group.runs.map((run) => `${group.key}/${run.id}`))
        : runs.map((run) => run.id),
    [groupBy, branchGroups, runs],
  );
  const rowReturn = useRowReturn({ listKey: 'runs', rowIds, rowAttribute: 'data-row-key' });
  const { returnRowId } = rowReturn;
  const isReturnEarlier =
    groupBy === 'state' &&
    returnRowId !== null &&
    finished.slice(VISIBLE_FINISHED_COUNT).some((run) => run.id === returnRowId);
  const isReturnArchived =
    groupBy === 'state' && returnRowId !== null && archived.some((run) => run.id === returnRowId);
  const foldedGroupOfReturn =
    groupBy === 'branch' && returnRowId !== null
      ? branchGroups.find((group) =>
          group.runs.some(
            (run) => `${group.key}/${run.id}` === returnRowId && (run.isFinished || run.isArchived),
          ),
        )
      : undefined;
  const unfoldedFor = useRef<string | null>(null);

  useEffect(() => {
    if (returnRowId === null || unfoldedFor.current === returnRowId) {
      return;
    }
    if (isReturnEarlier) {
      unfoldedFor.current = returnRowId;
      setIsEarlierShown(true);
    }
    if (isReturnArchived) {
      unfoldedFor.current = returnRowId;
      setIsArchivedShown(true);
    }
    if (foldedGroupOfReturn !== undefined) {
      unfoldedFor.current = returnRowId;
      setOpenGroups((open) => new Set([...open, foldedGroupOfReturn.key]));
    }
  }, [returnRowId, isReturnEarlier, isReturnArchived, foldedGroupOfReturn]);

  const toggleGroup = useCallback(({ key }: GroupParams) => {
    setOpenGroups((open) => {
      const next = new Set(open);
      next.delete(key);
      return open.has(key) ? next : new Set([...open, key]);
    });
  }, []);

  const openBranch = ({ mountId }: MountParams) => {
    const mount = mounts.find((candidate) => candidate.mountId === mountId);
    navigate({ to: branchPlace({ sessionId, mountPath: mount?.worktreePath ?? null }) });
  };

  const open = ({ run, rowKey }: RowParams) => {
    rowReturn.remember({ rowId: rowKey });
    switch (run.open.kind) {
      case 'run':
        navigate({ to: runPlace({ sessionId, runId: run.open.runId }) });
        return;
      case 'auto':
        openSpawned({ sessionId, target: { kind: 'agent', agentId: run.open.agentId } });
        return;
      case 'agent':
        navigate({ to: agentPlace({ sessionId, agentId: run.open.agentId }) });
        window.dispatchEvent(openAgentRevealEvent());
        return;
      default: {
        const unreachable: never = run.open;
        return unreachable;
      }
    }
  };

  const renderRow = ({ run, rowKey, titleSuffix }: RenderParams) => {
    const aggregates = run.agentIds.map((agentId) => aggregatesByAgentId.get(agentId));
    const isCostTracked = aggregates.some((aggregate) => (aggregate?.turns ?? 0) > 0);
    const agent =
      run.shape === 'lead' && run.open.kind !== 'run'
        ? agentOf({ agents, agentId: run.open.agentId })
        : null;
    const costUsd = isCostTracked
      ? aggregates.reduce((total, aggregate) => total + (aggregate?.estimatedCostUsd ?? 0), 0)
      : null;
    if (agent === null) {
      return (
        <RunsGridRow
          key={rowKey}
          sessionId={sessionId}
          run={run}
          rowKey={rowKey}
          modelLine={null}
          costUsd={costUsd}
          titleSuffix={titleSuffix}
          now={now}
          onOpen={() => open({ run, rowKey })}
        />
      );
    }
    return (
      <RunsGridAgentRow
        key={rowKey}
        sessionId={sessionId}
        run={run}
        rowKey={rowKey}
        agent={agent}
        costUsd={costUsd}
        titleSuffix={titleSuffix}
        now={now}
        onOpen={() => open({ run, rowKey })}
      />
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {branchCount < 2 ? null : (
        <div className="flex justify-end">
          <GroupBySwitch
            value={groupBy}
            onChange={(next) => setGroupBy({ sessionId, groupBy: next })}
          />
        </div>
      )}
      <ListGrid label={NAMES.runs} columns={RUNS_GRID_COLUMNS} isGrouped>
        {groupBy === 'branch' ? (
          <RunsByBranch
            groups={branchGroups}
            mounts={mounts}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            onOpenBranch={openBranch}
            renderRow={renderRow}
          />
        ) : (
          <RunsByState
            sessionId={sessionId}
            groups={stateGroups}
            isEarlierShown={isEarlierShown}
            isArchivedShown={isArchivedShown}
            onToggleEarlier={() => setIsEarlierShown((isShown) => !isShown)}
            onToggleArchived={() => setIsArchivedShown((isShown) => !isShown)}
            renderRow={renderRow}
          />
        )}
      </ListGrid>
    </div>
  );
};
