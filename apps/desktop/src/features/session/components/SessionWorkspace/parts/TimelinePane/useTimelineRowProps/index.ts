import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useCopyLink } from '@goodboy/ui';
import type { OpenQuestion, Session, SessionId } from '@goodboy/types';
import {
  useAppStore,
  useMountDiffStats,
  sessionPlace,
  branchPlace,
} from '../../../../../../../store';
import { useSessionRoleModels } from '../../../../../../../shared/hooks/useSessionRoleModels';
import { usePendingAction } from '../../../../../../../shared/hooks/usePendingAction';
import { useAdvanceWorkflowAgent } from '../../../../../../workflows/useAdvanceWorkflowAgent';
import { useOpenQuestions } from '../../../../../../context/components/QuestionsTab/useOpenQuestions';
import { useOpenAgentQuestion } from '../../../../../../context/hooks/useOpenAgentQuestion';
import type {
  TimelineRowItem,
  TimelineStreamItem,
} from '../../../../../timeline/buildTimelineStream';
import type { ExplodeGroups } from '../../../../../hooks/useExplodeGroups';
import { useAgentTouchedWorktrees } from '../../../../../hooks/useAgentTouchedWorktrees';
import { useTimelineOpen } from '../../../../../hooks/useTimelineOpen';
import { RAIL_COUNT_RADIUS, railInsetOf } from '../../../../../../workTreeModel/railGeometry';
import type { TimelineEntryRowHandlers } from '../TimelineEntryRow';
import type { TimelineLaneControl, TimelineLaneTarget } from '../TimelineRail';
import type { TimelineRowProps } from '../TimelineRow';
import type { TimelineRowAction } from '../TimelineStreamRow';
import type { NeedsYouOwner } from '../../../../../timeline/needsYou';
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
  readonly openNeedsYou: (params: { readonly owner: NeedsYouOwner }) => void;
};

export const useTimelineRowProps = ({ session, explode, rows }: Params): RowPropsControl => {
  const sessionId: SessionId = session.id;
  const navigate = useAppStore((s) => s.navigate);
  const openMountDiff = useAppStore((s) => s.openMountDiff);
  const continueStoppedAgent = useAppStore((s) => s.continueStoppedAgent);
  const openContextDrawer = useAppStore((s) => s.openContextDrawer);
  const focusQuestion = useOpenQuestions((s) => s.focusQuestion);
  const openAgentQuestion = useOpenAgentQuestion({ sessionId });
  const openTargetFor = useTimelineOpen({ sessionId });
  const advanceAgent = useAdvanceWorkflowAgent({ sessionId });
  const pending = usePendingAction({ sessionId });
  const diffStats = useMountDiffStats(sessionId);
  const touchedWorktrees = useAgentTouchedWorktrees(sessionId);
  const roleModels = useSessionRoleModels({ sessionId });
  const { copiedKey, failedKey, copy } = useCopyLink();
  const sessionProvider = session.providerPreference?.defaultProvider ?? null;
  const sessionEffort = session.effort ?? null;
  const { worktrees, laneRuns, stream } = rows;

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

  const answerAction = ({
    question,
    isAskerOffScreen,
  }: {
    readonly question: OpenQuestion | null;
    readonly isAskerOffScreen: boolean;
  }): TimelineRowAction => ({
    label: 'Answer',
    variant: 'secondary',
    onAct: () => {
      if (question != null && isAskerOffScreen) {
        openAgentQuestion({ question });
        return;
      }
      if (question != null) {
        focusQuestion(question.id);
      }
      navigate({ to: sessionPlace({ sessionId, lens: 'questions' }) });
    },
  });

  const actionFor = ({ item }: { readonly item: TimelineRowItem }): TimelineRowAction | null => {
    const { entry } = item;
    if (entry.kind === 'event') {
      if (entry.event.kind === 'issue_unlinked') {
        const target = openTargetFor({ entry });
        if (target == null) {
          return null;
        }
        return { label: target.label, onAct: target.open };
      }
    }
    const mountPath = mountPathFor({ item });
    if (mountPath != null) {
      const stat = diffStatFor({ item });
      if (stat != null && (stat.additions > 0 || stat.deletions > 0)) {
        return {
          label: 'View diff',
          onAct: () => openMountDiff(sessionId, mountPath),
        };
      }
      return {
        label:
          copiedKey === mountPath
            ? 'Copied'
            : failedKey === mountPath
              ? 'Copy failed'
              : 'Copy path',
        onAct: () => void copy({ text: mountPath }),
      };
    }
    const { ask } = item.rowState;
    if (ask == null) {
      return null;
    }
    switch (ask.kind) {
      case 'answer':
        return answerAction({ question: ask.question, isAskerOffScreen: entry.kind === 'run' });
      case 'restartStep': {
        const target = openTargetFor({ entry });
        if (target == null) {
          return null;
        }
        return { label: 'Restart the step', onAct: target.open };
      }
      case 'runStep': {
        const { agent } = ask;
        return {
          label: `Start ${ask.step.name}`,
          isBusy: pending.pendingKeys.has(agent.id),
          onAct: () =>
            void pending.run({
              key: agent.id,
              failureTitle: "The next step didn't start",
              task: () => advanceAgent({ agent }),
            }),
        };
      }
      case 'continue': {
        const { agent } = ask;
        return {
          label: agent.stoppedBy === 'app' ? 'Resume' : 'Continue',
          isBusy: pending.pendingKeys.has(agent.id),
          onAct: () =>
            void pending.run({
              key: agent.id,
              failureTitle: "Couldn't continue the agent",
              task: () => continueStoppedAgent({ sessionId, agentId: agent.id }),
            }),
        };
      }
      case 'reviewComment':
      case 'groupChild':
        return null;
      default: {
        const exhaustive: never = ask;
        return exhaustive;
      }
    }
  };

  const latestActionFor = useRef(actionFor);
  useLayoutEffect(() => {
    latestActionFor.current = actionFor;
  });

  const runAction = useCallback(({ item }: { readonly item: TimelineRowItem }) => {
    latestActionFor.current({ item })?.onAct();
  }, []);

  const openDecisionInContext = useCallback(
    ({ numbers }: { readonly numbers: ReadonlyArray<number> }) =>
      openContextDrawer({ sessionId, tab: 'decisions', highlight: numbers }),
    [openContextDrawer, sessionId],
  );

  const handlers = useMemo(
    (): TimelineEntryRowHandlers => ({
      openTargetFor,
      runAction,
      openDecisionInContext,
      toggleExpanded: rows.toggleExpanded,
      setGroupExpanded: explode.set,
    }),
    [explode.set, openDecisionInContext, openTargetFor, rows.toggleExpanded, runAction],
  );

  const openNeedsYou = useCallback(
    ({ owner }: { readonly owner: NeedsYouOwner }) => {
      if (owner.kind === 'batch') {
        navigate({ to: branchPlace({ sessionId, tab: 'comments' }) });
        return;
      }
      if (owner.kind === 'question') {
        if (owner.question !== null) {
          focusQuestion(owner.question.id);
        }
        navigate({ to: sessionPlace({ sessionId, lens: 'questions' }) });
        return;
      }
      if (owner.question !== null) {
        openAgentQuestion({ question: owner.question });
        return;
      }
      if (owner.item !== null) {
        openTargetFor({ entry: owner.item.entry })?.open();
      }
    },
    [focusQuestion, navigate, openAgentQuestion, openTargetFor, sessionId],
  );

  const isGroupExpanded = ({ id }: { readonly id: string }): boolean =>
    explode.expandedIds.has(id) && !explode.leavingIds.has(id);

  const rowPropsFor = ({ item, index }: RowParams): TimelineRowProps | null => {
    const rail = rows.rail.rows[index];
    if (rail === undefined) {
      return null;
    }
    const railWidth = railInsetOf({
      rail,
      markerRadius: item.kind === 'count' ? RAIL_COUNT_RADIUS : undefined,
    });
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
    const action = entry.kind === 'resolveBatch' ? null : actionFor({ item });
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
      actionLabel: action === null ? null : action.label,
      actionVariant: action?.variant ?? null,
      actionBusy: action?.isBusy === true,
      diffStat: diffStatFor({ item }),
      worktrees: agentId === null ? NO_WORKTREES : (touchedWorktrees.get(agentId) ?? NO_WORKTREES),
      step: stepId == null ? null : (rows.stepById.get(stepId) ?? null),
      costUsd:
        entry.kind === 'agent'
          ? (rows.spendByAgentId.get(entry.agent.id) ?? 0)
          : entry.kind === 'run'
            ? (rows.spendByRunId.get(entry.run.id) ?? 0)
            : entry.kind === 'resolveFile'
              ? entry.agentIds.reduce((total, id) => total + (rows.spendByAgentId.get(id) ?? 0), 0)
              : 0,
      groupTotals: rows.groupTotals.get(item.id) ?? null,
      isExpanded: rows.expandedRows.has(item.id),
      isBranchExpanded:
        item.branches?.some((branch) => isGroupExpanded({ id: branch.expandId })) === true,
      decisionDetail: rows.decisionDetails.get(item.id) ?? null,
      roleModels,
      sessionProvider,
      sessionEffort,
    };
  };

  return { rowPropsFor, openNeedsYou };
};
