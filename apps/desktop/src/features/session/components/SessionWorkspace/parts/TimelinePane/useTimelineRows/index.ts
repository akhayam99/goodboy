import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOpenStopMountIds } from '../../../../../hooks/useOpenStopMountIds';
import { useShallow } from 'zustand/react/shallow';
import type { SessionWorktree } from '@goodboy/db';
import type {
  Agent,
  ProviderRunId,
  Session,
  SessionEvent,
  SessionId,
  Step,
  TelemetryRecord,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  agentHasUnread,
  useAppStore,
  useIsSessionCollectionLoaded,
  useSessionAnsweredQuestions,
  useSessionDismissedQuestions,
  useSessionOpenQuestions,
} from '../../../../../../../store';
import { runSpendUsd } from '../../../../../../../store/slices/workflows/runSpendUsd';
import { useAttachedWorkflowRuns } from '../../../../../../workflows/useAttachedWorkflowRuns';
import { useWorkflowAdvanceStates } from '../../../../../../workflows/useWorkflowAdvanceStates';
import { useLiveAgentTurns } from '../../../../../../../shared/hooks/useLiveAgentTurns';
import { entriesOfView, type EntriesView } from '../../../../../timeline/activityView';
import { logEntriesMatching } from '../../../../../timeline/logSearch';
import { agentSpendById } from '../../../../../timeline/agentSpendById';
import {
  buildTimelineGroups,
  type TimelineTopLevelEntry,
} from '../../../../../timeline/buildTimelineGroups';
import {
  buildTimelineStream,
  liveFoldRootIds,
  type TimelineStream,
  type TimelineStreamItem,
} from '../../../../../timeline/buildTimelineStream';
import { dayLabel } from '../../../../../timeline/dayLabel';
import {
  decisionChangeDetail,
  type DecisionChangeDetail,
  type DetailHeightParams,
} from '../../../../../timeline/decisionChangeLines';
import {
  historyBatchDetailOf,
  type HistoryBatchDetail,
} from '../../../../../timeline/historyBatchDetail';
import { needsYouOwners, type NeedsYouOwner } from '../../../../../timeline/needsYou';
import { shownQuestionIds } from '../../../../../timeline/shownQuestionIds';
import { timelineLaneRuns, type TimelineLaneRuns } from '../../../../../timeline/timelineLaneRuns';
import {
  layoutTimelineRail,
  type RailLayout,
  type RailRow,
} from '../../../../../../workTreeModel/railGeometry';
import { keepEqualById } from '../../../../../../../shared/utils/keepEqualById';
import { timelineFullGutterOf } from '../timelineFullGutter';
import { timelineLaneGutterOf } from '../timelineLaneGutter';
import type { ExplodeGroups } from '../../../../../hooks/useExplodeGroups';
import { useResolveActivity } from '../../../../../hooks/useResolveActivity';
import { useJobActivity } from '../../../../../hooks/useJobActivity';
import { autoRowFacts, type AutoRowFacts } from '../../../../../../auto/autoRowFacts';
import { useAutoTrees } from '../../../../../../auto/useAutoTrees';
import { withoutAutoChildren } from '../../../../../../auto/withoutAutoChildren';

const NO_EXPANDED_ROWS: ReadonlySet<string> = new Set();

type Params = {
  readonly session: Session;
  readonly view: EntriesView;
  readonly query: string;
  readonly explode: ExplodeGroups;
};

export type TimelineRows = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly viewEntries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly worktrees: ReadonlyArray<SessionWorktree>;
  readonly isLoaded: boolean;
  readonly stream: TimelineStream;
  readonly laidOutItems: ReadonlyArray<TimelineStreamItem>;
  readonly rail: RailLayout;
  readonly laneGutter: number;
  readonly laneRuns: TimelineLaneRuns;
  readonly owners: ReadonlyArray<NeedsYouOwner>;
  readonly unreadAgentIds: ReadonlySet<string>;
  readonly liveAgentIds: ReadonlySet<string> | undefined;
  readonly shownQuestions: ReadonlySet<string>;
  readonly stepById: ReadonlyMap<string, Step>;
  readonly spendByAgentId: ReadonlyMap<string, number>;
  readonly spendByRunId: ReadonlyMap<string, number>;
  readonly decisionDetails: ReadonlyMap<string, DecisionChangeDetail>;
  readonly batchDetails: ReadonlyMap<string, HistoryBatchDetail>;
  readonly expandedRows: ReadonlySet<string>;
  readonly toggleExpanded: (rowId: string) => void;
  readonly setDetailHeight: (params: DetailHeightParams) => void;
};

export const useTimelineRows = ({ session, view, query, explode }: Params): TimelineRows => {
  const sessionId: SessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const plans = useAppStore((s) => s.sessionPlans?.[sessionId] ?? EMPTY_ARRAY);
  const artifacts = useAppStore((s) => s.sessionArtifacts?.[sessionId] ?? EMPTY_ARRAY);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks?.[sessionId] ?? EMPTY_ARRAY);
  const worktrees = useAppStore((s) => s.sessionWorktreeRecords?.[sessionId] ?? EMPTY_ARRAY);
  const events = useAppStore((s) => s.sessionEvents?.[sessionId] ?? EMPTY_ARRAY);
  const learnings = useAppStore((s) => s.sessionContextItems[sessionId] ?? EMPTY_ARRAY);
  const loadSessionContextItems = useAppStore((s) => s.loadSessionContextItems);
  const areEventsLoaded = useAppStore((s) => s.sessionEvents?.[sessionId] !== undefined);
  const areAgentsLoaded = useIsSessionCollectionLoaded({ sessionId, collection: 'agents' });
  const loadSessionEvents = useAppStore((s) => s.loadSessionEvents);
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const orchestratingWorkflowRuns = useAppStore((s) => s.orchestratingWorkflowRuns);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const answeredQuestions = useSessionAnsweredQuestions(sessionId);
  const dismissedQuestions = useSessionDismissedQuestions(sessionId);
  const loadSessionAnsweredQuestions = useAppStore((s) => s.loadSessionAnsweredQuestions);
  const loadSessionDismissedQuestions = useAppStore((s) => s.loadSessionDismissedQuestions);
  const workflows = useAttachedWorkflowRuns({ session });
  const resolveActivity = useResolveActivity({ sessionId });
  const jobActivity = useJobActivity({ sessionId });
  const autoTrees = useAutoTrees({ sessionId });
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
  const [expandedRows, setExpandedRows] = useState<ReadonlySet<string>>(NO_EXPANDED_ROWS);
  const [measuredHeights, setMeasuredHeights] = useState<ReadonlyMap<string, number>>(new Map());

  useEffect(() => {
    void loadSessionEvents({ sessionId });
  }, [loadSessionEvents, sessionId]);

  useEffect(() => {
    void loadSessionArtifacts(sessionId);
  }, [loadSessionArtifacts, sessionId]);

  useEffect(() => {
    void loadSessionContextItems({ sessionId }).catch(() => undefined);
  }, [loadSessionContextItems, sessionId]);

  useEffect(() => {
    void loadSessionAnsweredQuestions(sessionId);
    void loadSessionDismissedQuestions(sessionId);
  }, [loadSessionAnsweredQuestions, loadSessionDismissedQuestions, sessionId]);

  const questions = useMemo(
    () => [...openQuestions, ...answeredQuestions, ...dismissedQuestions],
    [answeredQuestions, dismissedQuestions, openQuestions],
  );

  const autoFactsByAgentId = useMemo(() => {
    const facts = new Map<string, AutoRowFacts>();
    for (const view of autoTrees) {
      const rowFacts = autoRowFacts({ view });
      if (rowFacts !== null) {
        facts.set(view.tree.rootAgentId, rowFacts);
      }
    }
    return facts;
  }, [autoTrees]);

  const topLevelAgents = useMemo(
    () => withoutAutoChildren({ agents, views: autoTrees }),
    [agents, autoTrees],
  );

  const model = useMemo(
    () =>
      buildTimelineGroups({
        sessionId,
        agents: topLevelAgents,
        workflows,
        plans,
        artifacts,
        externalTasks,
        questions,
        worktrees,
        events,
        learnings,
        agentKindOverride,
      }),
    [
      agentKindOverride,
      topLevelAgents,
      artifacts,
      events,
      externalTasks,
      learnings,
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

  const spendByAgentId = useMemo(() => {
    const spend = new Map(agentSpendById({ records: telemetry, agents, agentRunHistory }));
    for (const view of autoTrees) {
      if (view.budget !== null) {
        spend.set(view.tree.rootAgentId, view.budget.spentUsd);
      }
    }
    return spend;
  }, [agentRunHistory, agents, autoTrees, telemetry]);

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
  const turnByAgentId = useLiveAgentTurns({ agents });

  const unreadAgentIds = useMemo(() => {
    const unread = new Set<string>();
    for (const agent of agents) {
      if (agentHasUnread(agent, false)) {
        unread.add(agent.id);
      }
    }
    return unread;
  }, [agents]);

  const liveAgentIds = useMemo(
    () => (areAgentsLoaded ? new Set(agents.map((agent) => agent.id)) : undefined),
    [agents, areAgentsLoaded],
  );

  const settledStops = useAppStore((s) => s.settledRebaseStops[sessionId] ?? EMPTY_ARRAY);
  const settledStopIds = useMemo(() => new Set(settledStops), [settledStops]);
  const openMountIds = useOpenStopMountIds({ sessionId });

  const decidingRunIds = useMemo(() => {
    const deciding = new Set<string>();
    for (const { run } of workflows) {
      if (orchestratingWorkflowRuns?.[run.id] === true) {
        deciding.add(run.id);
      }
    }
    return deciding;
  }, [orchestratingWorkflowRuns, workflows]);

  const owners = useMemo(
    () =>
      needsYouOwners({
        items: buildTimelineStream({
          entries: model.entries,
          unreadAgentIds,
          advanceByRunId,
          decidingRunIds,
          dayLabelFor: dayLabel,
          showQuestions: false,
          resolveFactsByAgentId: resolveActivity.factsByAgentId,
          jobFactsByAgentId: jobActivity.factsByAgentId,
          autoFactsByAgentId,
          turnByAgentId,
        }).items,
        entries: model.entries,
        events,
        resolveFactsByAgentId: resolveActivity.factsByAgentId,
        liveAgentIds,
        settledStopIds,
        openMountIds,
      }),
    [
      advanceByRunId,
      autoFactsByAgentId,
      decidingRunIds,
      events,
      jobActivity,
      liveAgentIds,
      model.entries,
      openMountIds,
      resolveActivity,
      settledStopIds,
      turnByAgentId,
      unreadAgentIds,
    ],
  );

  const viewEntries = useMemo(() => {
    const inView = entriesOfView({
      entries: model.entries,
      events,
      view,
      liveAgentIds,
      settledStopIds,
    });
    return view !== 'activity' ? logEntriesMatching({ entries: inView, query }) : inView;
  }, [events, liveAgentIds, model.entries, query, settledStopIds, view]);

  const stream = useMemo(
    () =>
      buildTimelineStream({
        entries: viewEntries,
        unreadAgentIds,
        advanceByRunId,
        decidingRunIds,
        dayLabelFor: dayLabel,
        showQuestions: view !== 'activity',
        resolveFactsByAgentId: resolveActivity.factsByAgentId,
        jobFactsByAgentId: jobActivity.factsByAgentId,
        autoFactsByAgentId,
        turnByAgentId,
        expandedGroupIds: explode.expandedIds,
        fullGroupIds: explode.fullIds,
        foldsFinished: true,
        shouldFoldHistoryBatches: view === 'all',
      }),
    [
      advanceByRunId,
      autoFactsByAgentId,
      decidingRunIds,
      explode.expandedIds,
      explode.fullIds,
      jobActivity,
      resolveActivity,
      turnByAgentId,
      unreadAgentIds,
      view,
      viewEntries,
    ],
  );

  const fullGutter = useMemo(
    () =>
      timelineFullGutterOf({
        build: ({ expandedGroupIds, fullGroupIds }) =>
          buildTimelineStream({
            entries: viewEntries,
            unreadAgentIds,
            advanceByRunId,
            decidingRunIds,
            dayLabelFor: dayLabel,
            showQuestions: view !== 'activity',
            resolveFactsByAgentId: resolveActivity.factsByAgentId,
            jobFactsByAgentId: jobActivity.factsByAgentId,
            autoFactsByAgentId,
            turnByAgentId,
            expandedGroupIds,
            fullGroupIds,
            foldsFinished: true,
            shouldFoldHistoryBatches: view === 'all',
          }),
      }),
    [
      advanceByRunId,
      autoFactsByAgentId,
      decidingRunIds,
      jobActivity,
      resolveActivity,
      turnByAgentId,
      unreadAgentIds,
      view,
      viewEntries,
    ],
  );

  const isLoaded = areEventsLoaded && areAgentsLoaded;
  const { keepOpen } = explode;
  const liveRootKey = useMemo(
    () => liveFoldRootIds({ entries: model.entries }).join(' '),
    [model.entries],
  );

  useEffect(() => {
    if (!areAgentsLoaded || liveRootKey === '') {
      return;
    }
    keepOpen({ ids: liveRootKey.split(' ') });
  }, [areAgentsLoaded, keepOpen, liveRootKey]);

  const shownQuestions = useMemo(() => {
    const shown = new Set(shownQuestionIds({ items: stream.items }));
    for (const owner of owners) {
      owner.questionIds.forEach((id) => shown.add(id));
    }
    return shown;
  }, [owners, stream.items]);

  const estimatedDetails = useMemo(() => {
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

  const decisionDetails = useMemo(() => {
    const details = new Map<string, DecisionChangeDetail>();
    for (const [id, detail] of estimatedDetails) {
      const height = measuredHeights.get(id);
      details.set(id, height === undefined ? detail : { ...detail, height });
    }
    return details;
  }, [estimatedDetails, measuredHeights]);

  const batchDetails = useMemo(() => {
    const details = new Map<string, HistoryBatchDetail>();
    for (const item of stream.items) {
      if (
        item.kind !== 'row' ||
        item.entry.kind !== 'event' ||
        item.entry.historyBatch === undefined
      ) {
        continue;
      }
      const detail = historyBatchDetailOf({ batch: item.entry.historyBatch });
      const height = measuredHeights.get(item.id);
      details.set(item.id, height === undefined ? detail : { ...detail, height });
    }
    return details;
  }, [measuredHeights, stream.items]);

  const setDetailHeight = useCallback(({ rowId, height }: DetailHeightParams) => {
    setMeasuredHeights((current) => {
      if (current.get(rowId) === height) {
        return current;
      }
      return new Map(current).set(rowId, height);
    });
  }, []);

  const itemCache = useRef<ReadonlyMap<string, TimelineStreamItem>>(new Map());
  const laidOutItems = useMemo(() => {
    const next = stream.items.map((item) => {
      const detail = expandedRows.has(item.id)
        ? (decisionDetails.get(item.id) ?? batchDetails.get(item.id))
        : undefined;
      return detail === undefined ? item : { ...item, height: item.height + detail.height };
    });
    const kept = keepEqualById({ previous: itemCache.current, next });
    itemCache.current = new Map(kept.map((item) => [item.id, item]));
    return kept;
  }, [batchDetails, decisionDetails, expandedRows, stream.items]);

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

  const railCache = useRef<ReadonlyMap<string, RailRow>>(new Map());
  const rail = useMemo(() => {
    const layout = layoutTimelineRail({ rows: laidOutItems, groups: stream.groups });
    const rows = keepEqualById({ previous: railCache.current, next: layout.rows });
    railCache.current = new Map(rows.map((row) => [row.id, row]));
    return { ...layout, rows };
  }, [stream.groups, laidOutItems]);

  const laneGutter = useMemo(
    () => Math.max(fullGutter, timelineLaneGutterOf({ items: laidOutItems, rails: rail.rows })),
    [fullGutter, laidOutItems, rail.rows],
  );

  const laneRuns = useMemo(
    () => timelineLaneRuns({ items: stream.items, groups: stream.groups }),
    [stream.groups, stream.items],
  );

  return {
    entries: model.entries,
    viewEntries,
    events,
    worktrees,
    isLoaded,
    stream,
    laidOutItems,
    rail,
    laneGutter,
    laneRuns,
    owners,
    unreadAgentIds,
    liveAgentIds,
    shownQuestions,
    stepById,
    spendByAgentId,
    spendByRunId,
    decisionDetails,
    batchDetails,
    expandedRows,
    toggleExpanded,
    setDetailHeight,
  };
};
