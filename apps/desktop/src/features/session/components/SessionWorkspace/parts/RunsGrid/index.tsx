import { useMemo, type ReactNode } from 'react';
import type { Agent, AgentId, MountId, Session } from '@goodboy/types';
import { ListGrid } from '@goodboy/ui';
import { agentPlace, useAppStore } from '../../../../../../store';
import { useNow } from '../../../../../../shared/hooks/useNow';
import { GroupBySwitch } from '../../../../../../shared/components/GroupBySwitch';
import { openAgentRevealEvent } from '../../../../../../shared/utils/openAgentReveal';
import { branchPlace } from '../../../../../../store/slices/navigation/place';
import { useGroupBy } from '../../../../../../store/slices/session-grouping/hooks/useGroupBy';
import { runPlace } from '../../../../../workflows/runPlace';
import { useAgentMetrics } from '../../../../hooks/useAgentMetrics';
import { NAMES } from '../../../../../../shared/utils/names';
import { branchGroupsOf } from '../../../../branchGroupsOf';
import { runGroupsOf } from '../../../../runGroupsOf';
import type { SessionRun } from '../../../../sessionRunsOf';
import { useMountRows } from '../../../../../../shared/hooks/useMountRows';
import { ContinueAllAction } from './ContinueAllAction';
import { RunsByBranch } from './RunsByBranch';
import { RunsByState } from './RunsByState';
import { RunsGridAgentRow } from './RunsGridAgentRow';
import { RunsGridRow } from './RunsGridRow';
import { StopAllAction } from './StopAllAction';
import { RUNS_GRID_COLUMNS } from './runsGridColumns';
import { useRunVerbPress } from './useRunVerbPress';
import { useRunsFolds } from './useRunsFolds';

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
  const stateGroups = useMemo(() => runGroupsOf({ runs }), [runs]);
  const branchGroups = useMemo(() => branchGroupsOf({ runs, mounts }), [runs, mounts]);
  const folds = useRunsFolds({ groupBy, runs, branchGroups });
  const { rowReturn, revealRun } = folds;

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
            openGroups={folds.openGroups}
            onToggleGroup={folds.toggleGroup}
            onOpenBranch={openBranch}
            onRevealRun={revealRun}
            renderRow={renderRow}
          />
        ) : (
          <RunsByState
            groups={stateGroups}
            isEarlierShown={folds.isEarlierShown}
            isArchivedShown={folds.isArchivedShown}
            onToggleEarlier={folds.toggleEarlier}
            onToggleArchived={folds.toggleArchived}
            onOpenBranch={openBranch}
            renderRow={renderRow}
          />
        )}
      </ListGrid>
    </div>
  );
};
