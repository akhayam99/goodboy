import { useCallback, useMemo, useRef } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, useMountDiffStats } from '../../../../../../../store';
import { useSessionRoleModels } from '../../../../../../../shared/hooks/useSessionRoleModels';
import type {
  TimelineRowItem,
  TimelineStreamItem,
} from '../../../../../timeline/buildTimelineStream';
import type { ExplodeGroups } from '../../../../../hooks/useExplodeGroups';
import { useAgentTouchedWorktrees } from '../../../../../hooks/useAgentTouchedWorktrees';
import { useTimelineOpen } from '../../../../../hooks/useTimelineOpen';
import type { TimelineEntryRowHandlers } from '../TimelineEntryRow';
import type { TimelineLaneControl, TimelineLaneTarget } from '../TimelineRail';
import type { TimelineRowProps } from '../TimelineRow';
import type { TimelineRows } from '../useTimelineRows';

const NO_WORKTREES: ReadonlyArray<string> = [];

type Params = {
  readonly session: Session;
  readonly explode: ExplodeGroups;
  readonly rows: TimelineRows;
};

type RowParams = {
  readonly item: TimelineStreamItem;
  readonly index: number;
};

type RowPropsControl = {
  readonly rowPropsFor: (params: RowParams) => TimelineRowProps | null;
};

export const useTimelineRowProps = ({ session, explode, rows }: Params): RowPropsControl => {
  const sessionId: SessionId = session.id;
  const openContextDrawer = useAppStore((s) => s.openContextDrawer);
  const openTargetFor = useTimelineOpen({ sessionId });
  const diffStats = useMountDiffStats(sessionId);
  const touchedWorktrees = useAgentTouchedWorktrees(sessionId);
  const roleModels = useSessionRoleModels({ sessionId });
  const sessionProvider = session.providerPreference?.defaultProvider ?? null;
  const sessionEffort = session.effort ?? null;
  const { worktrees, laneRuns } = rows;
  const railWidth = rows.laneGutter;

  const latestLaneRuns = useRef(laneRuns);
  latestLaneRuns.current = laneRuns;

  const runLaneCache = useRef(new Map<string, TimelineLaneTarget>());

  const runLaneFor = ({ laneId }: { readonly laneId: string }): TimelineLaneTarget | null => {
    const cached = runLaneCache.current.get(laneId);
    if (cached !== undefined) {
      return cached;
    }
    const entry = latestLaneRuns.current.runByLaneId.get(laneId);
    if (entry === undefined) {
      return null;
    }
    const target: TimelineLaneTarget = {
      laneId,
      title: entry.run.title ?? entry.workflow.name,
      open: () => {
        const latest = latestLaneRuns.current.runByLaneId.get(laneId);
        if (latest !== undefined) {
          openTargetFor({ entry: latest })?.open();
        }
      },
    };
    runLaneCache.current.set(laneId, target);
    return target;
  };

  const latestRunLaneFor = useRef(runLaneFor);
  latestRunLaneFor.current = runLaneFor;

  const lanes = useMemo(
    (): TimelineLaneControl => ({
      targetFor: ({ laneId }) => latestRunLaneFor.current({ laneId }),
    }),
    [],
  );

  const mountPathByProjectId = useMemo(() => {
    const paths = new Map<string, string>();
    for (const worktree of worktrees) {
      if (worktree.projectId != null) {
        paths.set(worktree.projectId, worktree.worktreePath);
      }
    }
    return paths;
  }, [worktrees]);

  const mountPathFor = ({ item }: { readonly item: TimelineRowItem }): string | null => {
    const { entry } = item;
    if (entry.kind === 'branch') {
      return entry.worktree.worktreePath;
    }
    if (entry.kind !== 'event' || entry.event.kind !== 'project_materialized') {
      return null;
    }
    if (entry.projectRun != null) {
      return null;
    }
    const projectId = entry.event.payload?.projectId ?? null;
    if (projectId == null) {
      return null;
    }
    return mountPathByProjectId.get(projectId) ?? null;
  };

  const diffStatFor = ({ item }: { readonly item: TimelineRowItem }) => {
    const worktreePath = mountPathFor({ item });
    if (worktreePath == null) {
      return null;
    }
    return diffStats.get(worktreePath) ?? null;
  };

  const openDecisionInContext = useCallback(
    ({ numbers }: { readonly numbers: ReadonlyArray<number> }) =>
      openContextDrawer({ sessionId, section: 'decisions', highlight: numbers }),
    [openContextDrawer, sessionId],
  );

  const handlers = useMemo(
    (): TimelineEntryRowHandlers => ({
      openTargetFor,
      openDecisionInContext,
      toggleExpanded: rows.toggleExpanded,
      setDetailHeight: rows.setDetailHeight,
      setGroupExpanded: explode.set,
    }),
    [explode.set, openDecisionInContext, openTargetFor, rows.setDetailHeight, rows.toggleExpanded],
  );

  const isGroupExpanded = ({ id }: { readonly id: string }): boolean =>
    explode.expandedIds.has(id) && !explode.leavingIds.has(id);

  const rowPropsFor = ({ item, index }: RowParams): TimelineRowProps | null => {
    const rail = rows.rail.rows[index];
    if (rail === undefined) {
      return null;
    }
    const rowLaneId = item.kind === 'row' ? (laneRuns.laneIdByRowId.get(item.id) ?? null) : null;
    if (item.kind === 'now') {
      return { kind: 'now', item, rail, railWidth, sessionId, lanes };
    }
    if (item.kind === 'day') {
      return { kind: 'day', item, rail, railWidth, sessionId, lanes };
    }
    if (item.kind === 'more') {
      return {
        kind: 'more',
        item,
        rail,
        railWidth,
        sessionId,
        lanes,
        onShowAll: explode.showAll,
      };
    }
    if (item.kind === 'count') {
      return {
        kind: 'count',
        item,
        rail,
        railWidth,
        sessionId,
        lanes,
        isExpanded: isGroupExpanded({ id: item.expandId }),
        onSet: explode.set,
      };
    }
    const { entry } = item;
    const agentId = entry.kind === 'agent' ? entry.agent.id : null;
    const stepId = entry.kind === 'agent' ? entry.agent.stepId : null;
    return {
      kind: 'entry',
      item,
      rail,
      railWidth,
      sessionId,
      handlers,
      runLane: rowLaneId === null ? null : runLaneFor({ laneId: rowLaneId }),
      lanes,
      diffStat: diffStatFor({ item }),
      worktrees: agentId === null ? NO_WORKTREES : (touchedWorktrees.get(agentId) ?? NO_WORKTREES),
      step: stepId == null ? null : (rows.stepById.get(stepId) ?? null),
      costUsd:
        entry.kind === 'agent'
          ? (rows.spendByAgentId.get(entry.agent.id) ?? 0)
          : entry.kind === 'run'
            ? (rows.spendByRunId.get(entry.run.id) ?? 0)
            : 0,
      isExpanded: rows.expandedRows.has(item.id),
      isBranchExpanded:
        item.branches?.some((branch) => isGroupExpanded({ id: branch.expandId })) === true,
      decisionDetail: rows.decisionDetails.get(item.id) ?? null,
      batchDetail: rows.batchDetails.get(item.id) ?? null,
      roleModels,
      sessionProvider,
      sessionEffort,
    };
  };

  return { rowPropsFor };
};
