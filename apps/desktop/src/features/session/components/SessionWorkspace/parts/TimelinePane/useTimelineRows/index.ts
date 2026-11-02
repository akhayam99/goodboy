import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { EMPTY_ARRAY, useAppStore } from '../../../../../../../store';
import { runSpendUsd } from '../../../../../../../store/slices/workflows/runSpendUsd';
import { useSessionWorkModel } from '../../../../../central/useSessionWorkModel';
import { entriesOfView, type EntriesView } from '../../../../../timeline/activityView';
import { logEntriesMatching } from '../../../../../timeline/logSearch';
import { agentSpendById } from '../../../../../timeline/agentSpendById';
import type { TimelineTopLevelEntry } from '../../../../../timeline/buildTimelineGroups';
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
import type { NeedsYouOwner } from '../../../../../timeline/needsYou';
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
  const work = useSessionWorkModel({ session });
  const {
    agents,
    worktrees,
    events,
    workflows,
    autoTrees,
    advanceByRunId,
    decidingRunIds,
    unreadAgentIds,
    liveAgentIds,
    owners,
    settledStopIds,
    turnByAgentId,
    autoFactsByAgentId,
    resolveFactsByAgentId,
    jobFactsByAgentId,
    isLoaded,
  } = work;
  const modelEntries = work.entries;
  const areAgentsLoaded = liveAgentIds !== undefined;
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

  const viewEntries = useMemo(() => {
    const inView = entriesOfView({
      entries: modelEntries,
      events,
      view,
      liveAgentIds,
      settledStopIds,
    });
    return view !== 'activity' ? logEntriesMatching({ entries: inView, query }) : inView;
  }, [events, liveAgentIds, modelEntries, query, settledStopIds, view]);

  const stream = useMemo(
    () =>
      buildTimelineStream({
        entries: viewEntries,
        unreadAgentIds,
        advanceByRunId,
        decidingRunIds,
        dayLabelFor: dayLabel,
        showQuestions: view !== 'activity',
        resolveFactsByAgentId,
        jobFactsByAgentId,
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
      jobFactsByAgentId,
      resolveFactsByAgentId,
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
            resolveFactsByAgentId,
            jobFactsByAgentId,
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
      jobFactsByAgentId,
      resolveFactsByAgentId,
      turnByAgentId,
      unreadAgentIds,
      view,
      viewEntries,
    ],
  );

  const { keepOpen } = explode;
  const liveRootKey = useMemo(
    () => liveFoldRootIds({ entries: modelEntries }).join(' '),
    [modelEntries],
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
    entries: modelEntries,
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
