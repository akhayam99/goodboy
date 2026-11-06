import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Agent, AgentId, MountId, Session } from '@goodboy/types';
import { ListGrid } from '@goodboy/ui';
import { agentPlace, useAppStore } from '../../../../../../store';
import { useNow } from '../../../../../../shared/hooks/useNow';
import { GroupBySwitch } from '../../../../../../shared/components/GroupBySwitch';
import { openAgentRevealEvent } from '../../../../../../shared/utils/openAgentReveal';
import { branchPlace } from '../../../../../../store/slices/navigation/place';
import type { GroupBy } from '../../../../../../store/slices/session-grouping/state';
import { useGroupBy } from '../../../../../../store/slices/session-grouping/selectors';
import { runGroupFocusOf } from '../../../../../../store/slices/navigation/runGroupFocusOf';
import { runPlace } from '../../../../../workflows/runPlace';
import { useAgentMetrics } from '../../../../hooks/useAgentMetrics';
import { useRowReturn } from '../../../../../../shared/hooks/useRowReturn';
import { NAMES } from '../../../../../../shared/utils/names';
import { VISIBLE_FINISHED_COUNT } from '../../../../finishedRunsCap';
import { branchGroupsOf, type BranchGroup } from '../../../../branchGroupsOf';
import { runGroupsOf } from '../../../../runGroupsOf';
import type { SessionRun } from '../../../../sessionRunsOf';
import { useMountRows } from '../../../SessionOverviewPane/ProjectMountRows/useMountRows';
import { ContinueAllAction } from './ContinueAllAction';
import { RunsByBranch } from './RunsByBranch';
import { RunsByState } from './RunsByState';
import { RunsGridAgentRow } from './RunsGridAgentRow';
import { RunsGridRow } from './RunsGridRow';
import { StopAllAction } from './StopAllAction';
import { archivedFoldKeyOf } from './branchGroupRunsOf';
import { RUNS_GRID_COLUMNS } from './runsGridColumns';
import { useRunVerbPress } from './useRunVerbPress';

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

type RevealParams = {
  readonly run: SessionRun;
  readonly fromGroupKey: string;
};

type AgentParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly agentId: AgentId;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

type ReturnFoldParams = {
  readonly groupBy: GroupBy;
  readonly returnRowId: string | null;
  readonly branchGroups: ReadonlyArray<BranchGroup>;
};

const foldKeyOfReturnRow = ({
  groupBy,
  returnRowId,
  branchGroups,
}: ReturnFoldParams): string | undefined => {
  if (groupBy !== 'branch' || returnRowId === null) {
    return undefined;
  }
  for (const group of branchGroups) {
    const run = group.runs.find((candidate) => `${group.key}/${candidate.id}` === returnRowId);
    if (run === undefined) {
      continue;
    }
    if (run.isArchived) {
      return archivedFoldKeyOf({ groupKey: group.key });
    }
    return run.isFinished ? group.key : undefined;
  }
  return undefined;
};

const agentOf = ({ agents, agentId }: AgentParams): Agent | null =>
  agents.find((candidate) => candidate.id === agentId) ?? null;

export const RunsGrid = ({ session, runs }: Props) => {
  const sessionId = session.id;
  const now = useNow(30_000);
  const navigate = useAppStore((state) => state.navigate);
  const setGroupBy = useAppStore((state) => state.setGroupBy);
  const verbPress = useRunVerbPress({ sessionId });
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
  const foldKeyOfReturn = foldKeyOfReturnRow({ groupBy, returnRowId, branchGroups });
  const unfoldedFor = useRef<string | null>(null);
  const [revealRowKey, setRevealRowKey] = useState<string | null>(null);
  const arrivedGroupKey = useAppStore((state) => runGroupFocusOf({ state })?.groupKey ?? null);

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
    if (foldKeyOfReturn !== undefined) {
      unfoldedFor.current = returnRowId;
      setOpenGroups((open) => new Set([...open, foldKeyOfReturn]));
    }
  }, [returnRowId, isReturnEarlier, isReturnArchived, foldKeyOfReturn]);

  useEffect(() => {
    if (revealRowKey === null) {
      return;
    }
    const row = document.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(revealRowKey)}"]`);
    if (row === null) {
      return;
    }
    setRevealRowKey(null);
    row.scrollIntoView?.({ block: 'center' });
    row.focus();
  }, [revealRowKey]);

  useEffect(() => {
    if (arrivedGroupKey === null) {
      return;
    }
    setOpenGroups((open) => new Set([...open, arrivedGroupKey]));
    const firstRun = branchGroups.find((group) => group.key === arrivedGroupKey)?.runs[0];
    if (firstRun !== undefined) {
      setRevealRowKey(`${arrivedGroupKey}/${firstRun.id}`);
    }
  }, [arrivedGroupKey]);

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

  const revealRun = ({ run, fromGroupKey }: RevealParams) => {
    const groupKeys = branchGroups
      .filter((group) => group.runs.some((candidate) => candidate.id === run.id))
      .map((group) => group.key);
    const nextIndex = (groupKeys.indexOf(fromGroupKey) + 1) % groupKeys.length;
    const groupKey = groupKeys[nextIndex];
    if (groupKey === undefined || groupKey === fromGroupKey) {
      return;
    }
    setOpenGroups((open) => new Set([...open, groupKey, archivedFoldKeyOf({ groupKey })]));
    setRevealRowKey(`${groupKey}/${run.id}`);
  };

  const open = ({ run, rowKey }: RowParams) => {
    rowReturn.remember({ rowId: rowKey });
    switch (run.open.kind) {
      case 'run':
        navigate({ to: runPlace({ sessionId, runId: run.open.runId }) });
        return;
      case 'auto':
        navigate({ to: agentPlace({ sessionId, agentId: run.open.agentId }) });
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
          session={session}
          run={run}
          rowKey={rowKey}
          modelLine={null}
          costUsd={costUsd}
          titleSuffix={titleSuffix}
          now={now}
          isVerbBusy={verbPress.isBusy({ run })}
          onOpen={() => open({ run, rowKey })}
          onVerb={() => verbPress.press({ run })}
        />
      );
    }
    return (
      <RunsGridAgentRow
        key={rowKey}
        session={session}
        run={run}
        rowKey={rowKey}
        agent={agent}
        costUsd={costUsd}
        titleSuffix={titleSuffix}
        now={now}
        isVerbBusy={verbPress.isBusy({ run })}
        onOpen={() => open({ run, rowKey })}
        onVerb={() => verbPress.press({ run })}
      />
    );
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
          <RunsByBranch
            groups={branchGroups}
            mounts={mounts}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            onOpenBranch={openBranch}
            onRevealRun={revealRun}
            renderRow={renderRow}
          />
        ) : (
          <RunsByState
            groups={stateGroups}
            isEarlierShown={isEarlierShown}
            isArchivedShown={isArchivedShown}
            onToggleEarlier={() => setIsEarlierShown((isShown) => !isShown)}
            onToggleArchived={() => setIsArchivedShown((isShown) => !isShown)}
            onOpenBranch={openBranch}
            renderRow={renderRow}
          />
        )}
      </ListGrid>
    </div>
  );
};
