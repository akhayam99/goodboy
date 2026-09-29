import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ReactNode } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, IconButton, OverflowMenu, SectionHeader, useCopyLink } from '@goodboy/ui';
import { useHistoryRowActions } from '../../../../../history/useHistoryRowActions';
import type {
  Agent,
  OpenQuestion,
  ProviderRunId,
  Session,
  SessionId,
  Step,
  TelemetryRecord,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  useAppStore,
  useMountDiffStats,
  useSessionAnsweredQuestions,
  useSessionDismissedQuestions,
  useIsSessionCollectionLoaded,
  useSessionOpenQuestions,
  type MountDiffStat,
  sessionPlace,
} from '../../../../../../store';
import { runSpendUsd } from '../../../../../../store/slices/workflows/runSpendUsd';
import { useSessionRoleModels } from '../../../../../../shared/hooks/useSessionRoleModels';
import { useAttachedWorkflowRuns } from '../../../../../workflows/useAttachedWorkflowRuns';
import { useAdvanceWorkflowAgent } from '../../../../../workflows/useAdvanceWorkflowAgent';
import { usePendingAction } from '../../../../../../shared/hooks/usePendingAction';
import { useWorkflowAdvanceStates } from '../../../../../workflows/useWorkflowAdvanceStates';
import { ObjectOverflowMenu } from '../../../../../actions/components/ObjectOverflowMenu';
import {
  activityCategoryOf,
  activityCounts,
  filterTimelineEntries,
  hiddenRowCount,
  isActivityChildShown,
} from '../../../../timeline/activityFilter';
import { agentSpendById } from '../../../../timeline/agentSpendById';
import { buildTimelineGroups } from '../../../../timeline/buildTimelineGroups';
import {
  buildTimelineStream,
  type TimelineRowItem,
} from '../../../../timeline/buildTimelineStream';
import { dayLabel } from '../../../../timeline/dayLabel';
import {
  firstNeedsYouRowId,
  hasWaitingRow,
  needsYouCount,
  needsYouEntries,
  needsYouRootIds,
} from '../../../../timeline/needsYou';
import { timelineLaneRuns } from '../../../../timeline/timelineLaneRuns';
import { shownQuestionIds } from '../../../../timeline/shownQuestionIds';
import { layoutTimelineRail } from '../../../../../workTreeModel/railGeometry';
import { useOpenQuestions } from '../../../../../context/components/QuestionsTab/useOpenQuestions';
import { useOpenAgentQuestion } from '../../../../../context/hooks/useOpenAgentQuestion';
import { useActivityFilter } from '../../../../hooks/useActivityFilter';
import { useAgentTouchedWorktrees } from '../../../../hooks/useAgentTouchedWorktrees';
import { useExplodeGroups } from '../../../../hooks/useExplodeGroups';
import { useResolveActivity } from '../../../../hooks/useResolveActivity';
import { useTimelineOpen, type TimelineOpenTarget } from '../../../../hooks/useTimelineOpen';
import { ActivityFilterPanel } from './ActivityFilterPanel';
import { NeedsYouChip } from './NeedsYouChip';
import { TimelineDayRule } from './TimelineDayRule';
import { TimelineNowRule } from './TimelineNowRule';
import { TimelineSkeleton } from './TimelineSkeleton';
import { TimelineStreamRow, type TimelineRowAction } from './TimelineStreamRow';
import { TimelineAgentStreamRow } from './TimelineAgentStreamRow';
import { TimelineGroupStreamRow } from './TimelineGroupStreamRow';
import { TimelineRunStreamRow } from './TimelineRunStreamRow';
import { WorkTimeProvider } from '../../../../../workTreeModel/components/WorkTimeProvider';
import type { TimelineLaneControl, TimelineLaneTarget } from './TimelineRail';
import { DecisionChangesDetail } from './DecisionChangesDetail';
import {
  decisionChangeDetail,
  type DecisionChangeDetail,
} from '../../../../timeline/decisionChangeLines';

const NO_WORKTREES: ReadonlyArray<string> = [];

const BATCH_CHILD_OPEN_LABEL = 'Open brief';

const openTargetOfBatchChild = ({
  item,
  target,
}: {
  readonly item: TimelineRowItem;
  readonly target: TimelineOpenTarget | null;
}): TimelineOpenTarget | null =>
  item.explode?.kind !== 'batch' || target === null
    ? target
    : { ...target, label: BATCH_CHILD_OPEN_LABEL };

const explodePhaseOf = ({
  item,
  leavingIds,
}: {
  readonly item: TimelineRowItem;
  readonly leavingIds: ReadonlySet<string>;
}): 'in' | 'out' | null => {
  if (item.explode === undefined) {
    return null;
  }
  return leavingIds.has(item.explode.groupId) ? 'out' : 'in';
};

const NO_EXPANDED_ROWS: ReadonlySet<string> = new Set();

const EMPTY_REVEALED_ROWS: ReadonlySet<string> = new Set();

type Props = {
  readonly session: Session;
  readonly actions: ReactNode;
  readonly onShownQuestionsChange?: (ids: ReadonlySet<string>) => void;
};

export const TimelinePane = ({ session, actions, onShownQuestionsChange }: Props) => {
  const sessionId: SessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const plans = useAppStore((s) => s.sessionPlans?.[sessionId] ?? EMPTY_ARRAY);
  const artifacts = useAppStore((s) => s.sessionArtifacts?.[sessionId] ?? EMPTY_ARRAY);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks?.[sessionId] ?? EMPTY_ARRAY);
  const worktrees = useAppStore((s) => s.sessionWorktreeRecords?.[sessionId] ?? EMPTY_ARRAY);
  const events = useAppStore((s) => s.sessionEvents?.[sessionId] ?? EMPTY_ARRAY);
  const areEventsLoaded = useAppStore((s) => s.sessionEvents?.[sessionId] !== undefined);
  const areAgentsLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'agents' });
  const loadSessionEvents = useAppStore((s) => s.loadSessionEvents);
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const orchestratingWorkflowRuns = useAppStore((s) => s.orchestratingWorkflowRuns);
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const navigate = useAppStore((s) => s.navigate);
  const openMountDiff = useAppStore((s) => s.openMountDiff);
  const continueStoppedAgent = useAppStore((s) => s.continueStoppedAgent);
  const focusQuestion = useOpenQuestions((s) => s.focusQuestion);
  const openAgentQuestion = useOpenAgentQuestion({ sessionId });
  const openQuestions = useSessionOpenQuestions(sessionId);
  const answeredQuestions = useSessionAnsweredQuestions(sessionId);
  const dismissedQuestions = useSessionDismissedQuestions(sessionId);
  const loadSessionAnsweredQuestions = useAppStore((s) => s.loadSessionAnsweredQuestions);
  const loadSessionDismissedQuestions = useAppStore((s) => s.loadSessionDismissedQuestions);
  const workflows = useAttachedWorkflowRuns({ session });
  const openTargetFor = useTimelineOpen({ sessionId });
  const historyRowFor = useHistoryRowActions({ sessionId });
  const openContextDrawer = useAppStore((s) => s.openContextDrawer);
  const [expandedRows, setExpandedRows] = useState<ReadonlySet<string>>(NO_EXPANDED_ROWS);
  const advanceAgent = useAdvanceWorkflowAgent({ sessionId });
  const pending = usePendingAction({ sessionId });
  const activity = useActivityFilter();
  const resolveActivity = useResolveActivity({ sessionId });
  const explode = useExplodeGroups();
  const revealedRows = useAppStore((s) => s.revealedActivityRows[sessionId] ?? EMPTY_REVEALED_ROWS);
  const diffStats = useMountDiffStats(sessionId);
  const touchedWorktrees = useAgentTouchedWorktrees(sessionId);
  const roleModels = useSessionRoleModels({ sessionId });
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const agentRunHistory = useAppStore(
    useShallow((s) => {
      const history: Record<string, ReadonlyArray<ProviderRunId>> = {};
      for (const agent of s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>)) {
        const runIds = s.agentRunHistory[agent.id];
        if (runIds != null) {
          history[agent.id] = runIds;
        }
      }
      return history;
    }),
  );
  const sessionProvider = session.providerPreference?.defaultProvider ?? null;
  const sessionEffort = session.effort ?? null;
  const { copiedKey, failedKey, copy } = useCopyLink();

  useEffect(() => {
    void loadSessionEvents({ sessionId });
  }, [loadSessionEvents, sessionId]);

  useEffect(() => {
    void loadSessionArtifacts(sessionId);
  }, [loadSessionArtifacts, sessionId]);

  useEffect(() => {
    void loadSessionAnsweredQuestions(sessionId);
    void loadSessionDismissedQuestions(sessionId);
  }, [loadSessionAnsweredQuestions, loadSessionDismissedQuestions, sessionId]);

  const questions = useMemo(
    () => [...openQuestions, ...answeredQuestions, ...dismissedQuestions],
    [answeredQuestions, dismissedQuestions, openQuestions],
  );

  const model = useMemo(
    () =>
      buildTimelineGroups({
        sessionId,
        agents,
        workflows,
        plans,
        artifacts,
        externalTasks,
        questions,
        worktrees,
        events,
        agentKindOverride,
      }),
    [
      agentKindOverride,
      agents,
      artifacts,
      events,
      externalTasks,
      plans,
      questions,
      sessionId,
      workflows,
      worktrees,
    ],
  );

  const stepById = useMemo(() => {
    const steps = new Map<string, Step>();
    for (const { workflow } of workflows) {
      for (const step of workflow.steps) {
        steps.set(step.id, step);
      }
    }
    return steps;
  }, [workflows]);

  const spendByAgentId = useMemo(
    () => agentSpendById({ records: telemetry, agents, agentRunHistory }),
    [agentRunHistory, agents, telemetry],
  );

  const spendByRunId = useMemo(() => {
    const spend = new Map<string, number>();
    for (const { run } of workflows) {
      spend.set(
        run.id,
        runSpendUsd({ records: telemetry, agents, agentRunHistory, workflowRunId: run.id }),
      );
    }
    return spend;
  }, [agentRunHistory, agents, telemetry, workflows]);

  const advanceByRunId = useWorkflowAdvanceStates({ sessionId, workflows, agents });

  const unreadAgentIds = useMemo(() => {
    const unread = new Set<string>();
    for (const agent of agents) {
      if (agentHasUnread(agent, false)) {
        unread.add(agent.id);
      }
    }
    return unread;
  }, [agents]);

  const decidingRunIds = useMemo(() => {
    const deciding = new Set<string>();
    for (const { run } of workflows) {
      if (orchestratingWorkflowRuns?.[run.id] === true) {
        deciding.add(run.id);
      }
    }
    return deciding;
  }, [orchestratingWorkflowRuns, workflows]);

  const fullStreamItems = useMemo(
    () =>
      buildTimelineStream({
        entries: model.entries,
        unreadAgentIds,
        advanceByRunId,
        decidingRunIds,
        dayLabelFor: dayLabel,
        resolveBatchByAgentId: resolveActivity.batchByAgentId,
        resolveFactsByAgentId: resolveActivity.factsByAgentId,
      }).items,
    [advanceByRunId, decidingRunIds, model.entries, resolveActivity, unreadAgentIds],
  );

  const attentionRootIds = useMemo(
    () => needsYouRootIds({ items: fullStreamItems }),
    [fullStreamItems],
  );

  const needsYouTotal = useMemo(() => needsYouCount({ items: fullStreamItems }), [fullStreamItems]);

  const { isNeedsYou } = activity;

  const visibleEntries = useMemo(
    () =>
      isNeedsYou
        ? needsYouEntries({ entries: model.entries, rootIds: attentionRootIds })
        : filterTimelineEntries({
            entries: model.entries,
            filter: activity.filter,
            revealed: revealedRows,
          }),
    [activity.filter, attentionRootIds, isNeedsYou, model.entries, revealedRows],
  );

  const stream = useMemo(
    () =>
      buildTimelineStream({
        entries: visibleEntries,
        unreadAgentIds,
        advanceByRunId,
        decidingRunIds,
        dayLabelFor: dayLabel,
        showWorkflowSubagents: isNeedsYou || activity.filter.workflowSubagents,
        showAgentSubagents: isNeedsYou || activity.filter.agentSubagents,
        showPlans: isNeedsYou || isActivityChildShown({ filter: activity.filter, toggle: 'plans' }),
        showReports:
          isNeedsYou || isActivityChildShown({ filter: activity.filter, toggle: 'reports' }),
        showWireframes:
          isNeedsYou || isActivityChildShown({ filter: activity.filter, toggle: 'wireframes' }),
        showQuestions: isNeedsYou || activity.filter.questions,
        resolveBatchByAgentId: resolveActivity.batchByAgentId,
        resolveFactsByAgentId: resolveActivity.factsByAgentId,
        expandedGroupIds: explode.expandedIds,
      }),
    [
      activity.filter,
      advanceByRunId,
      decidingRunIds,
      explode.expandedIds,
      isNeedsYou,
      resolveActivity,
      unreadAgentIds,
      visibleEntries,
    ],
  );

  const unfilteredStream = useMemo(
    () =>
      buildTimelineStream({
        entries: visibleEntries,
        unreadAgentIds,
        advanceByRunId,
        decidingRunIds,
        dayLabelFor: dayLabel,
        resolveBatchByAgentId: resolveActivity.batchByAgentId,
        resolveFactsByAgentId: resolveActivity.factsByAgentId,
        expandedGroupIds: explode.expandedIds,
      }),
    [
      advanceByRunId,
      decidingRunIds,
      explode.expandedIds,
      resolveActivity,
      unreadAgentIds,
      visibleEntries,
    ],
  );

  const hiddenChildRows = Math.max(0, unfilteredStream.items.length - stream.items.length);

  const shownQuestions = useMemo(() => shownQuestionIds({ items: stream.items }), [stream.items]);
  const shownQuestionsKey = [...shownQuestions].sort().join(' ');

  useLayoutEffect(() => {
    onShownQuestionsChange?.(shownQuestions);
  }, [onShownQuestionsChange, shownQuestionsKey]);

  const listRef = useRef<HTMLDivElement>(null);

  const revealNeedsYou = () => {
    const rowId = firstNeedsYouRowId({ items: stream.items });
    const row =
      rowId === null
        ? undefined
        : Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-row-id]') ?? []).find(
            (element) => element.dataset.rowId === rowId,
          );
    if (row === undefined) {
      activity.applyPreset({ preset: 'needsYou' });
      return;
    }
    row.scrollIntoView({ block: 'center' });
    row.querySelector<HTMLElement>('[data-testid="timeline-row-action"] button')?.focus({
      preventScroll: true,
    });
  };

  const decisionDetails = useMemo(() => {
    const details = new Map<string, DecisionChangeDetail>();
    for (const item of stream.items) {
      if (item.kind !== 'row' || item.entry.kind !== 'event') {
        continue;
      }
      if (item.entry.event.kind !== 'decisions_changed') {
        continue;
      }
      const detail = decisionChangeDetail({ payload: item.entry.event.payload });
      if (detail !== null) {
        details.set(item.id, detail);
      }
    }
    return details;
  }, [stream.items]);

  const laidOutItems = useMemo(
    () =>
      stream.items.map((item) => {
        const detail = expandedRows.has(item.id) ? decisionDetails.get(item.id) : undefined;
        return detail === undefined ? item : { ...item, height: item.height + detail.height };
      }),
    [decisionDetails, expandedRows, stream.items],
  );

  const toggleExpanded = useCallback((rowId: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
        return next;
      }
      next.add(rowId);
      return next;
    });
  }, []);

  const rail = useMemo(
    () => layoutTimelineRail({ rows: laidOutItems, groups: stream.groups }),
    [stream.groups, laidOutItems],
  );

  const [hoveredLaneId, setHoveredLaneId] = useState<string | null>(null);

  const laneRuns = useMemo(
    () => timelineLaneRuns({ items: stream.items, groups: stream.groups }),
    [stream.groups, stream.items],
  );

  const laneTargetFor = useCallback(
    ({ laneId }: { readonly laneId: string }): TimelineLaneTarget | null => {
      const entry = laneRuns.runByLaneId.get(laneId);
      if (entry === undefined) {
        return null;
      }
      const target = openTargetFor({ entry });
      if (target === null) {
        return null;
      }
      return { laneId, title: entry.run.title ?? entry.workflow.name, open: target.open };
    },
    [laneRuns, openTargetFor],
  );

  const lanes = useMemo(
    (): TimelineLaneControl => ({
      targetFor: laneTargetFor,
      hoveredLaneId,
      onHover: ({ laneId }) => setHoveredLaneId(laneId),
    }),
    [hoveredLaneId, laneTargetFor],
  );

  const runLaneFor = ({ item }: { readonly item: TimelineRowItem }): TimelineLaneTarget | null => {
    const laneId = laneRuns.laneIdByRowId.get(item.id);
    return laneId === undefined ? null : laneTargetFor({ laneId });
  };

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

  const diffStatFor = ({ item }: { readonly item: TimelineRowItem }): MountDiffStat | null => {
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
      const history = historyRowFor({ event: entry.event, events });
      if (history !== null) {
        return history.action;
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

  const menuFor = ({ item }: { readonly item: TimelineRowItem }): ReactNode => {
    const { entry } = item;
    if (entry.kind === 'event') {
      const history = historyRowFor({ event: entry.event, events });
      if (history === null || history.menu.length === 0) {
        return null;
      }
      return (
        <OverflowMenu
          items={history.menu}
          label="More for this rewrite"
          triggerClassName="size-6 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 motion-safe:transition-opacity"
        />
      );
    }
    if (entry.kind !== 'run') {
      return null;
    }
    const { run, workflow } = entry;
    return (
      <ObjectOverflowMenu
        target={{ kind: 'workflowRun', sessionId, runId: run.id }}
        label={`${run.title ?? workflow.name} workflow actions`}
        anchorKey={`activity:${item.id}`}
        triggerClassName="size-6 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100 motion-safe:transition-opacity"
      />
    );
  };

  const hasUnreadAgents = unreadAgentIds.size > 0;
  const counts = activityCounts({ entries: model.entries });
  const hiddenRows =
    hiddenRowCount({
      entries: model.entries,
      filter: activity.filter,
      revealed: revealedRows,
    }) + hiddenChildRows;
  const rowKindCount = new Set(model.entries.map((entry) => activityCategoryOf({ entry }))).size;
  const hasFilter = rowKindCount >= 2 || activity.hidden.length > 0 || isNeedsYou;
  const isLoading = (!areEventsLoaded || !areAgentsLoaded) && model.entries.length === 0;
  const emptyHint =
    areEventsLoaded && areAgentsLoaded && model.entries.length === 0
      ? 'Nothing yet. Agents, workflows and session facts land here as they happen.'
      : undefined;

  return (
    <section aria-label="Activity" className="@container/activity flex flex-col gap-2">
      <SectionHeader
        label="Activity"
        hint={emptyHint}
        meta={
          hasWaitingRow({ items: stream.items }) ? null : (
            <NeedsYouChip count={needsYouTotal} onReveal={revealNeedsYou} />
          )
        }
        action={
          <div className="flex items-center gap-1">
            {hasUnreadAgents ? (
              <IconButton
                icon={CheckCheck}
                label="Mark all seen"
                variant="ghost"
                onClick={() => void markAllAgentsSeen(sessionId)}
              />
            ) : null}
            {hasFilter ? (
              <ActivityFilterPanel
                filter={activity.filter}
                hidden={activity.hidden}
                hiddenRows={hiddenRows}
                preset={activity.preset}
                counts={counts}
                visibleCount={visibleEntries.length}
                totalCount={model.entries.length}
                onToggle={activity.setToggle}
                onPreset={activity.applyPreset}
              />
            ) : null}
            {actions}
          </div>
        }
      />
      {isLoading ? (
        <TimelineSkeleton />
      ) : model.entries.length === 0 ? null : visibleEntries.length === 0 ? (
        <div className="flex items-center gap-2 py-2">
          <p className="min-w-0 flex-1 text-label text-muted-foreground">
            {isNeedsYou
              ? 'Nothing needs you right now.'
              : 'Everything is hidden by the activity filter. Show a category to bring it back.'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => activity.applyPreset({ preset: 'everything' })}
          >
            Show everything
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <WorkTimeProvider sessionId={sessionId} workspaceId={session.workspaceId}>
            <div ref={listRef} className="@container flex flex-col">
              {laidOutItems.map((item, index) => {
                const railRow = rail.rows[index];
                if (railRow === undefined) {
                  return null;
                }
                if (item.kind === 'now') {
                  return (
                    <TimelineNowRule
                      key={item.id}
                      item={item}
                      rail={railRow}
                      railWidth={rail.width}
                      lanes={lanes}
                    />
                  );
                }
                if (item.kind === 'day') {
                  return (
                    <TimelineDayRule
                      key={item.id}
                      item={item}
                      rail={railRow}
                      railWidth={rail.width}
                      lanes={lanes}
                    />
                  );
                }
                const { entry } = item;
                if (entry.kind === 'resolveBatch' || entry.kind === 'subagentGroup') {
                  return (
                    <TimelineGroupStreamRow
                      key={item.id}
                      item={item}
                      entry={entry}
                      rail={railRow}
                      railWidth={rail.width}
                      sessionId={sessionId}
                      isExpanded={
                        explode.expandedIds.has(entry.id) && !explode.leavingIds.has(entry.id)
                      }
                      lanes={lanes}
                      onSetExpanded={explode.set}
                    />
                  );
                }
                const target = openTargetFor({ entry });
                if (entry.kind === 'agent') {
                  return (
                    <TimelineAgentStreamRow
                      key={item.id}
                      item={item}
                      entry={entry}
                      rail={railRow}
                      railWidth={rail.width}
                      sessionId={sessionId}
                      openTarget={openTargetOfBatchChild({ item, target })}
                      action={actionFor({ item })}
                      diffStat={diffStatFor({ item })}
                      worktrees={touchedWorktrees.get(entry.agent.id) ?? NO_WORKTREES}
                      isRevealed={revealedRows.has(entry.id)}
                      explodePhase={explodePhaseOf({ item, leavingIds: explode.leavingIds })}
                      lanes={lanes}
                      runLane={runLaneFor({ item })}
                      step={
                        entry.agent.stepId == null
                          ? null
                          : (stepById.get(entry.agent.stepId) ?? null)
                      }
                      roleModels={roleModels}
                      sessionProvider={sessionProvider}
                      sessionEffort={sessionEffort}
                      costUsd={spendByAgentId.get(entry.agent.id) ?? 0}
                    />
                  );
                }
                if (entry.kind === 'run') {
                  return (
                    <TimelineRunStreamRow
                      key={item.id}
                      item={item}
                      entry={entry}
                      rail={railRow}
                      railWidth={rail.width}
                      sessionId={sessionId}
                      openTarget={target}
                      action={actionFor({ item })}
                      diffStat={diffStatFor({ item })}
                      isRevealed={revealedRows.has(entry.id)}
                      lanes={lanes}
                      runLane={runLaneFor({ item })}
                      roleModels={roleModels}
                      sessionProvider={sessionProvider}
                      sessionEffort={sessionEffort}
                      costUsd={spendByRunId.get(entry.run.id) ?? 0}
                      menu={menuFor({ item })}
                    />
                  );
                }
                const decisionDetail = decisionDetails.get(item.id);
                const isExpanded = expandedRows.has(item.id);
                const detailId = `${item.id}-decision-changes`;
                return (
                  <TimelineStreamRow
                    key={item.id}
                    item={item}
                    rail={railRow}
                    railWidth={rail.width}
                    sessionId={sessionId}
                    openTarget={
                      decisionDetail === undefined
                        ? target
                        : {
                            label: isExpanded ? 'Hide changes' : 'Show changes',
                            open: () => toggleExpanded(item.id),
                          }
                    }
                    expansion={
                      decisionDetail === undefined ? null : { isExpanded, controlsId: detailId }
                    }
                    detailHeight={
                      decisionDetail !== undefined && isExpanded ? decisionDetail.height : 0
                    }
                    detail={
                      decisionDetail !== undefined && isExpanded ? (
                        <DecisionChangesDetail
                          id={detailId}
                          detail={decisionDetail}
                          onOpenInContext={() =>
                            openContextDrawer({
                              sessionId,
                              tab: 'decisions',
                              highlight: decisionDetail.numbers,
                            })
                          }
                        />
                      ) : null
                    }
                    action={actionFor({ item })}
                    diffStat={diffStatFor({ item })}
                    isRevealed={revealedRows.has(entry.id)}
                    lanes={lanes}
                    runLane={runLaneFor({ item })}
                    menu={menuFor({ item })}
                  />
                );
              })}
            </div>
          </WorkTimeProvider>
        </div>
      )}
    </section>
  );
};
