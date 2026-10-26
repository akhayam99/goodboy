import type { TurnState } from '@goodboy/types';
import type { WorkflowAdvanceState } from '../../../workflows/advanceGate';
import { DONE_ROW_STATE } from '../../../workTreeModel/rowState';
import type { TimelineRunEntry, TimelineTopLevelEntry } from '../buildTimelineGroups';
import type { JobActivityFacts } from '../../../../store/slices/history/jobFactsByAgentId';
import type { AutoRowFacts } from '../../../auto/autoRowFacts';
import type { ResolveActivityFacts } from '../resolveActivity';
import { laneRootOf } from '../laneFacts';
import type { TimelineStream, DraftRow } from './streamTypes';
import {
  eventRank,
  laneIdOf,
  compareNewestFirst,
  questionGradeOf,
  withExecutionOrder,
  withPendingAtFamilyHead,
  withMembersAboveOrigin,
} from './ordering';
import {
  isEmptyDecisionRow,
  mergeConsecutiveDecisionRows,
  mergeConsecutiveProjectRows,
  mergeConsecutiveStoppedRows,
  mergeHistoryBatches,
} from './mergeRows';
import {
  questionRowStateOf,
  NO_QUESTION_ROWS,
  NO_RESOLVE_FACTS,
  NO_JOB_FACTS,
  NO_AUTO_FACTS,
  NO_TURNS,
  NO_OUTPUTS_BY_AGENT,
  isOutputEntry,
  outputsByAgentEntryIdOf,
  NO_EXPANDED_GROUPS,
  isRunFinished,
  agentRows,
  type ChainedRun,
  type EmitContext,
} from './agentRows';
import { runRows } from './runRows';
import { NO_LANES, NO_RUN_FOLDS, laneFactsByRootId, laneRootsOf, runFoldsOf } from './laneFolds';
import { withCountRows, withDayBreaks, withMoreRows, streamItemsOf } from './decorate';

export type {
  TimelineCountItem,
  TimelineDayItem,
  TimelineMoreItem,
  TimelineNowItem,
  TimelineRowItem,
  TimelineStream,
  TimelineStreamEntry,
  TimelineStreamItem,
} from './streamTypes';
export { countRowIdOf } from './streamTypes';
export { liveFoldRootIds } from './laneFolds';

type Params = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly unreadAgentIds: ReadonlySet<string>;
  readonly advanceByRunId: ReadonlyMap<string, WorkflowAdvanceState>;
  readonly decidingRunIds: ReadonlySet<string>;
  readonly dayLabelFor: (params: { readonly at: string }) => string | null;
  readonly showQuestions?: boolean;
  readonly resolveFactsByAgentId?: ReadonlyMap<string, ResolveActivityFacts>;
  readonly jobFactsByAgentId?: ReadonlyMap<string, JobActivityFacts>;
  readonly autoFactsByAgentId?: ReadonlyMap<string, AutoRowFacts>;
  readonly turnByAgentId?: ReadonlyMap<string, TurnState>;
  readonly expandedGroupIds?: ReadonlySet<string>;
  readonly fullGroupIds?: ReadonlySet<string>;
  readonly foldsFinished?: boolean;
  readonly shouldFoldHistoryBatches?: boolean;
};

const openQuestionRowIds = ({
  entries,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
}): ReadonlySet<string> =>
  new Set(
    entries.flatMap((entry) =>
      entry.kind === 'question'
        ? entry.questions
            .filter((question) => question.status === 'open')
            .map((question) => question.id)
        : [],
    ),
  );

export const buildTimelineStream = ({
  entries,
  unreadAgentIds,
  advanceByRunId,
  decidingRunIds,
  dayLabelFor,
  showQuestions = true,
  resolveFactsByAgentId = NO_RESOLVE_FACTS,
  jobFactsByAgentId = NO_JOB_FACTS,
  autoFactsByAgentId = NO_AUTO_FACTS,
  turnByAgentId = NO_TURNS,
  expandedGroupIds = NO_EXPANDED_GROUPS,
  fullGroupIds = NO_EXPANDED_GROUPS,
  foldsFinished = false,
  shouldFoldHistoryBatches = false,
}: Params): TimelineStream => {
  const chainedRunById = new Map<string, ChainedRun>();
  for (const entry of entries) {
    if (entry.kind === 'run') {
      chainedRunById.set(entry.run.id, {
        title: entry.run.title ?? entry.workflow.name,
        isFinished: isRunFinished({ entry }),
      });
    }
  }
  const base: EmitContext = {
    unreadAgentIds,
    advanceByRunId,
    decidingRunIds,
    chainedRunById,
    groups: [],
    showWorkflowSubagents: true,
    showAgentSubagents: true,
    showPlans: true,
    showReports: true,
    showWireframes: true,
    showQuestions,
    questionRowIds: showQuestions ? openQuestionRowIds({ entries }) : NO_QUESTION_ROWS,
    resolveFactsByAgentId,
    jobFactsByAgentId,
    autoFactsByAgentId,
    turnByAgentId,
    outputsByAgentEntryId: outputsByAgentEntryIdOf({ entries }),
    expandedGroupIds,
    fullGroupIds,
    mores: [],
    counts: [],
    direction: 'up',
    foldsFinished,
    laneFacts: NO_LANES,
    runFoldById: NO_RUN_FOLDS,
  };
  const rows: DraftRow[] = [];
  const withFacts: EmitContext = foldsFinished
    ? { ...base, laneFacts: laneFactsByRootId({ entries, context: base }) }
    : base;
  const context: EmitContext = {
    ...withFacts,
    runFoldById: runFoldsOf({ entries, context: withFacts }),
  };
  const laneRoots = laneRootsOf({ entries, context });

  for (const entry of entries) {
    if (entry.kind === 'run') {
      rows.push(...runRows({ entry, context }));
      continue;
    }
    if (entry.kind === 'agent') {
      rows.push(
        ...agentRows({
          entry,
          grade: 'entry',
          identity: entry.chain?.identity ?? null,
          isMuted: false,
          familyId: entry.id,
          groupId: null,
          showSubagents: context.showAgentSubagents,
          readyAgentId: null,
          isParentClosed: false,
          context,
        }),
      );
      continue;
    }
    if (isOutputEntry(entry) && entry.launchEntryId !== undefined) {
      continue;
    }
    const laneRoot = laneRootOf({ entry });
    const lane = laneRoot === null ? undefined : laneRoots.get(laneRoot);
    if (laneRoot !== null && (lane === undefined || !lane.isOpen)) {
      continue;
    }
    const laneSlot: Partial<Pick<DraftRow, 'explode'>> =
      lane?.slot == null ? {} : { explode: lane.slot };
    if ((entry.kind === 'plan' || entry.kind === 'artifact') && entry.lane != null) {
      rows.push({
        kind: 'row',
        id: entry.id,
        at: entry.at,
        grade: 'step',
        entry,
        identity: entry.lane.identity,
        familyId: entry.lane.rootEntryId,
        groupId: laneIdOf({ entryId: entry.lane.rootEntryId }),
        ordinal: null,
        sortOrdinal: 0,
        rowState: DONE_ROW_STATE,
        hasUnread: false,
        isPending: false,
        ...laneSlot,
      });
      continue;
    }
    if ((entry.kind === 'event' || entry.kind === 'learning') && entry.lane != null) {
      rows.push({
        kind: 'row',
        id: entry.id,
        at: entry.at,
        grade: 'fact',
        entry,
        identity: entry.lane.identity,
        familyId: entry.lane.rootEntryId,
        groupId: laneIdOf({ entryId: entry.lane.rootEntryId }),
        ordinal: null,
        sortOrdinal: entry.kind === 'event' ? eventRank({ kind: entry.event.kind }) : 0,
        rowState: DONE_ROW_STATE,
        hasUnread: false,
        isPending: false,
        ...laneSlot,
      });
      continue;
    }
    if (entry.kind === 'question') {
      if (!context.showQuestions) {
        continue;
      }
      rows.push({
        kind: 'row',
        id: entry.id,
        at: entry.at,
        grade: questionGradeOf({ entry }),
        entry,
        identity: entry.lane?.identity ?? null,
        familyId: entry.lane?.rootEntryId ?? null,
        groupId: entry.lane != null ? laneIdOf({ entryId: entry.lane.rootEntryId }) : null,
        ordinal: null,
        sortOrdinal: 0,
        rowState: questionRowStateOf({ entry }),
        hasUnread: false,
        isPending: false,
        ...laneSlot,
      });
      continue;
    }
    const row: DraftRow = {
      kind: 'row',
      id: entry.id,
      at: entry.at,
      grade: 'fact',
      entry,
      identity: null,
      familyId: null,
      groupId: null,
      ordinal: null,
      sortOrdinal: entry.kind === 'event' ? eventRank({ kind: entry.event.kind }) : 0,
      rowState: DONE_ROW_STATE,
      hasUnread: false,
      isPending: false,
    };
    rows.push(row);
  }

  const sorted = [...rows].sort((first, second) => compareNewestFirst({ first, second }));
  const unbatched = mergeConsecutiveStoppedRows({
    drafts: mergeConsecutiveProjectRows({
      drafts: mergeConsecutiveDecisionRows({ drafts: sorted }).filter(
        (draft) => !isEmptyDecisionRow({ draft }),
      ),
    }),
  });
  const merged = shouldFoldHistoryBatches ? mergeHistoryBatches({ drafts: unbatched }) : unbatched;
  const ordered = withMembersAboveOrigin({
    drafts: withPendingAtFamilyHead({ drafts: merged, groups: context.groups }),
    groups: context.groups,
  });
  const withDays = withDayBreaks({
    drafts: withCountRows({ drafts: ordered, counts: context.counts, groups: context.groups }),
    dayLabelFor,
  });

  return {
    items: streamItemsOf({ drafts: withMoreRows({ drafts: withDays, mores: context.mores }) }),
    groups: context.groups,
  };
};

type RunTreeParams = {
  readonly entry: TimelineRunEntry;
  readonly unreadAgentIds: ReadonlySet<string>;
  readonly advance: WorkflowAdvanceState | null;
  readonly isDeciding: boolean;
  readonly turnByAgentId?: ReadonlyMap<string, TurnState>;
};

export const buildRunTreeStream = ({
  entry,
  unreadAgentIds,
  advance,
  isDeciding,
  turnByAgentId = NO_TURNS,
}: RunTreeParams): TimelineStream => {
  const context: EmitContext = {
    unreadAgentIds,
    advanceByRunId: new Map(advance == null ? [] : [[entry.run.id, advance]]),
    decidingRunIds: new Set(isDeciding ? [entry.run.id] : []),
    chainedRunById: new Map(),
    groups: [],
    showWorkflowSubagents: true,
    showAgentSubagents: true,
    showPlans: false,
    showReports: false,
    showWireframes: false,
    showQuestions: false,
    questionRowIds: NO_QUESTION_ROWS,
    resolveFactsByAgentId: NO_RESOLVE_FACTS,
    jobFactsByAgentId: NO_JOB_FACTS,
    autoFactsByAgentId: NO_AUTO_FACTS,
    turnByAgentId,
    outputsByAgentEntryId: NO_OUTPUTS_BY_AGENT,
    expandedGroupIds: NO_EXPANDED_GROUPS,
    fullGroupIds: NO_EXPANDED_GROUPS,
    mores: [],
    counts: [],
    direction: 'down',
    foldsFinished: false,
    laneFacts: NO_LANES,
    runFoldById: NO_RUN_FOLDS,
  };
  const sorted = [...runRows({ entry, context })].sort((first, second) =>
    compareNewestFirst({ first, second }),
  );
  const steps = withPendingAtFamilyHead({
    drafts: withExecutionOrder({ drafts: sorted, groups: context.groups }),
    groups: context.groups,
  }).filter((draft) => draft.id !== entry.id);
  const laneId = laneIdOf({ entryId: entry.id });
  const root = steps.find((draft) => draft.groupId === laneId) ?? null;
  const groups = context.groups.map((group) =>
    group.id === laneId && root !== null ? { ...group, originRowId: root.id } : group,
  );
  return {
    items: streamItemsOf({ drafts: steps }).filter((item) => item.kind !== 'now'),
    groups,
  };
};
