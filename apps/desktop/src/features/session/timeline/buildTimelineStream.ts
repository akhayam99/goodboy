import type {
  Agent,
  OpenQuestion,
  SessionDecisionChange,
  SessionEventKind,
  SessionEventPayload,
} from '@goodboy/types';
import { isAgentSettled, isAgentStatusHalted } from '@goodboy/core';
import type { WorkflowAdvanceState } from '../../workflows/advanceGate';
import { isWorkflowRunComplete } from '../../workflows/isWorkflowRunComplete';
import { isQuestionDelegate } from '../../context/questionDelegate';
import {
  DONE_ROW_STATE,
  resolveAgentRowState,
  resolveRunRowState,
  type RowPhase,
  type RowReadyStep,
  type RowState,
  type RowStoppedStep,
} from '../../workTreeModel/rowState';
import type {
  TimelineAgentEntry,
  TimelineArtifactEntry,
  TimelineBranchEntry,
  TimelineEventEntry,
  TimelineIssueEntry,
  TimelineLearningEntry,
  TimelinePlanEntry,
  TimelineQuestionEntry,
  TimelineResolveBatchEntry,
  TimelineRunEntry,
  TimelineSubagentGroupEntry,
  TimelineTopLevelEntry,
} from './buildTimelineGroups';
import type { RailGroupInput, RailGroupShape } from '../../workTreeModel/railGeometry';
import { runIdentity, runIdentitySeed, type RunIdentity } from './runIdentity';
import { groupResolveBatches } from './resolveBatchGroups';
import { resolverRowState, type ResolveActivityFacts } from './resolveActivity';
import { resolveBatchRowState, type ResolveBatchRef } from './resolveBatchSummary';
import { decisionDiff, isEmptyDecisionDiff } from './sessionEventPresentation';
import { stepsGroupSummary, type GroupSummary, type StepsGroupKind } from './groupSummary';
import {
  SUBAGENT_GROUP_MIN_MEMBERS,
  isSubagentAttention,
  subagentGroupEntryId,
  subagentGroupRowState,
  subagentGroupSummary,
  type SubagentFact,
} from './subagentGroups';
import {
  hasShownRunQuestion,
  oldestAgentOpenQuestion,
  runOpenQuestion,
  runShownQuestionIds,
} from './runOpenQuestion';
import {
  TIMELINE_RHYTHM,
  markerCenterY,
  rowBoxHeight,
  type TimelineGap,
  type TimelineRowGrade,
} from '../../workTreeModel/timelineRhythm';

export type TimelineStreamEntry =
  | TimelineRunEntry
  | TimelineAgentEntry
  | TimelinePlanEntry
  | TimelineArtifactEntry
  | TimelineIssueEntry
  | TimelineBranchEntry
  | TimelineEventEntry
  | TimelineLearningEntry
  | TimelineQuestionEntry
  | TimelineResolveBatchEntry
  | TimelineSubagentGroupEntry;

type StreamRail = {
  readonly id: string;
  readonly height: number;
  readonly topY: number;
  readonly markerY: number | null;
  readonly groupId: string | null;
  readonly isPending: boolean;
  readonly gap: TimelineGap;
};

export type TimelineNowItem = StreamRail & {
  readonly kind: 'now';
  readonly ruleY: number;
};

export type TimelineDayItem = StreamRail & {
  readonly kind: 'day';
  readonly label: string;
  readonly ruleY: number;
};

type TimelineExplodeSlot = {
  readonly groupId: string;
  readonly kind: 'batch' | 'subagents' | 'steps';
};

type TimelineRowFold = {
  readonly kind: StepsGroupKind;
  readonly isExpanded: boolean;
  readonly summary: GroupSummary;
};

const STEPS_GROUP_MIN_ROWS = 3;

export type TimelineRowItem = StreamRail & {
  readonly kind: 'row';
  readonly at: string | null;
  readonly grade: TimelineRowGrade;
  readonly entry: TimelineStreamEntry;
  readonly identity: RunIdentity | null;
  readonly familyId: string | null;
  readonly ordinal: string | null;
  readonly nodeIndex: string | null;
  readonly rowState: RowState;
  readonly hasUnread: boolean;
  readonly opensLane?: boolean;
  readonly explode?: TimelineExplodeSlot;
  readonly fold?: TimelineRowFold;
};

export type TimelineMoreItem = StreamRail & {
  readonly kind: 'more';
  readonly familyId: string | null;
  readonly hiddenCount: number;
  readonly explode: TimelineExplodeSlot;
};

export type TimelineStreamItem =
  TimelineNowItem | TimelineDayItem | TimelineRowItem | TimelineMoreItem;

const GROUP_VISIBLE_CHILDREN = 8;

export type TimelineStream = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly groups: ReadonlyArray<RailGroupInput>;
};

type Params = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly unreadAgentIds: ReadonlySet<string>;
  readonly advanceByRunId: ReadonlyMap<string, WorkflowAdvanceState>;
  readonly decidingRunIds: ReadonlySet<string>;
  readonly dayLabelFor: (params: { readonly at: string }) => string | null;
  readonly showWorkflowSubagents?: boolean;
  readonly showAgentSubagents?: boolean;
  readonly showPlans?: boolean;
  readonly showReports?: boolean;
  readonly showWireframes?: boolean;
  readonly showQuestions?: boolean;
  readonly resolveBatchByAgentId?: ReadonlyMap<string, ResolveBatchRef>;
  readonly resolveFactsByAgentId?: ReadonlyMap<string, ResolveActivityFacts>;
  readonly expandedGroupIds?: ReadonlySet<string>;
  readonly fullGroupIds?: ReadonlySet<string>;
  readonly foldsFinished?: boolean;
};

type DraftRow = {
  readonly kind: 'row';
  readonly id: string;
  readonly at: string | null;
  readonly grade: TimelineRowGrade;
  readonly entry: TimelineStreamEntry;
  readonly identity: RunIdentity | null;
  readonly familyId: string | null;
  readonly groupId: string | null;
  readonly ordinal: string | null;
  readonly sortOrdinal: number;
  readonly rowState: RowState;
  readonly hasUnread: boolean;
  readonly isPending: boolean;
  readonly explode?: TimelineExplodeSlot;
  readonly fold?: TimelineRowFold;
};

type DraftDay = {
  readonly kind: 'day';
  readonly id: string;
  readonly label: string;
};

type DraftMore = {
  readonly kind: 'more';
  readonly id: string;
  readonly familyId: string | null;
  readonly groupId: string;
  readonly hiddenCount: number;
  readonly explode: TimelineExplodeSlot;
};

type Draft = DraftRow | DraftDay | DraftMore;

const eventRank = ({ kind }: { readonly kind: SessionEventKind }): number => {
  if (kind === 'worktree_created') {
    return -2;
  }
  if (kind === 'branch_created') {
    return -1;
  }
  return 0;
};

const laneIdOf = ({ entryId }: { readonly entryId: string }): string => `lane:${entryId}`;

const dayKeyOf = ({ at }: { readonly at: string }): string => new Date(at).toDateString();

type Sortable = {
  readonly at: string | null;
  readonly sortOrdinal: number;
  readonly id: string;
};

const compareNewestFirst = ({
  first,
  second,
}: {
  readonly first: Sortable;
  readonly second: Sortable;
}): number => {
  if (first.at != null && second.at != null && first.at !== second.at) {
    return second.at.localeCompare(first.at);
  }
  if (first.at == null && second.at != null) {
    return -1;
  }
  if (first.at != null && second.at == null) {
    return 1;
  }
  return second.sortOrdinal - first.sortOrdinal || first.id.localeCompare(second.id);
};

type DraftParams = {
  readonly draft: DraftRow;
};

const isDecisionChangeRow = ({ draft }: DraftParams): boolean =>
  draft.groupId == null &&
  draft.entry.kind === 'event' &&
  draft.entry.event.kind === 'decisions_changed' &&
  draft.entry.event.payload?.consolidatedAfter === undefined;

const isEmptyDecisionRow = ({ draft }: DraftParams): boolean =>
  draft.entry.kind === 'event' &&
  draft.entry.event.kind === 'decisions_changed' &&
  isEmptyDecisionDiff({ payload: draft.entry.event.payload });

const DECISION_COUNT_KEYS = [
  'added',
  'removed',
  'replaced',
  'withdrawn',
  'merged',
  'restored',
] as const;

type DecisionCountKey = (typeof DECISION_COUNT_KEYS)[number];

type DecisionTotals = Partial<Record<DecisionCountKey, number>>;

const addDecisionTotals = ({
  totals,
  payload,
}: {
  readonly totals: DecisionTotals;
  readonly payload: SessionEventPayload | null;
}): DecisionTotals =>
  Object.fromEntries(
    DECISION_COUNT_KEYS.flatMap((key) => {
      const current = totals[key];
      const next = payload?.[key];
      if (current === undefined && next === undefined) {
        return [];
      }
      return [[key, (current ?? 0) + (next ?? 0)]];
    }),
  );

type MergeDecisionRowsParams = {
  readonly drafts: ReadonlyArray<DraftRow>;
};

const mergeConsecutiveDecisionRows = ({
  drafts,
}: MergeDecisionRowsParams): ReadonlyArray<DraftRow> => {
  const merged: DraftRow[] = [];
  let index = 0;

  while (index < drafts.length) {
    const newest = drafts[index];
    if (newest === undefined) {
      break;
    }
    if (!isDecisionChangeRow({ draft: newest }) || newest.entry.kind !== 'event') {
      merged.push(newest);
      index += 1;
      continue;
    }

    let totals: DecisionTotals = {};
    let changes: ReadonlyArray<SessionDecisionChange> = [];
    let runIndex = index;
    const newestDayKey = newest.at === null ? null : dayKeyOf({ at: newest.at });
    while (runIndex < drafts.length) {
      const draft = drafts[runIndex];
      if (draft === undefined || !isDecisionChangeRow({ draft }) || draft.entry.kind !== 'event') {
        break;
      }
      const draftDayKey = draft.at === null ? null : dayKeyOf({ at: draft.at });
      if (runIndex > index && draftDayKey !== newestDayKey) {
        break;
      }
      totals = addDecisionTotals({ totals, payload: draft.entry.event.payload });
      changes = [...changes, ...(draft.entry.event.payload?.decisionChanges ?? [])];
      runIndex += 1;
    }

    if (runIndex === index + 1) {
      merged.push(newest);
      index = runIndex;
      continue;
    }

    merged.push({
      ...newest,
      entry: {
        ...newest.entry,
        event: {
          ...newest.entry.event,
          payload: {
            ...newest.entry.event.payload,
            ...totals,
            ...(changes.length > 0 && { decisionChanges: changes }),
          },
        },
      },
    });
    index = runIndex;
  }

  return merged;
};

type ProjectRunPart = {
  readonly verb: 'mounted' | 'detached';
  readonly name: string;
};

const projectRunPartOf = ({ draft }: { readonly draft: DraftRow }): ProjectRunPart | null => {
  if (draft.groupId != null || draft.entry.kind !== 'event') {
    return null;
  }
  const { event } = draft.entry;
  const name = event.payload?.projectName ?? null;
  if (name == null) {
    return null;
  }
  if (event.kind === 'project_materialized') {
    return { verb: 'mounted', name };
  }
  if (event.kind === 'project_detached') {
    return { verb: 'detached', name };
  }
  return null;
};

type MergeProjectRowsParams = {
  readonly drafts: ReadonlyArray<DraftRow>;
};

const mergeConsecutiveProjectRows = ({
  drafts,
}: MergeProjectRowsParams): ReadonlyArray<DraftRow> => {
  const merged: DraftRow[] = [];
  let index = 0;

  while (index < drafts.length) {
    const newest = drafts[index];
    if (newest === undefined) {
      break;
    }
    if (projectRunPartOf({ draft: newest }) == null || newest.entry.kind !== 'event') {
      merged.push(newest);
      index += 1;
      continue;
    }

    const mounted: string[] = [];
    const detached: string[] = [];
    let runIndex = index;
    const newestDayKey = newest.at === null ? null : dayKeyOf({ at: newest.at });
    while (runIndex < drafts.length) {
      const draft = drafts[runIndex];
      if (draft === undefined) {
        break;
      }
      const part = projectRunPartOf({ draft });
      if (part == null) {
        break;
      }
      const draftDayKey = draft.at === null ? null : dayKeyOf({ at: draft.at });
      if (runIndex > index && draftDayKey !== newestDayKey) {
        break;
      }
      if (part.verb === 'mounted') {
        mounted.push(part.name);
      }
      if (part.verb === 'detached') {
        detached.push(part.name);
      }
      runIndex += 1;
    }

    if (runIndex === index + 1) {
      merged.push(newest);
      index = runIndex;
      continue;
    }

    merged.push({
      ...newest,
      entry: {
        ...newest.entry,
        event: {
          ...newest.entry.event,
          kind: mounted.length > 0 ? 'project_materialized' : 'project_detached',
        },
        projectRun: { mounted, detached },
      },
    });
    index = runIndex;
  }

  return merged;
};

const questionBucketOf = ({
  entry,
}: {
  readonly entry: TimelineQuestionEntry;
}): 'open' | 'consumed' =>
  entry.questions.every((question) => question.status === 'open') ? 'open' : 'consumed';

const questionRowStateOf = ({ entry }: { readonly entry: TimelineQuestionEntry }): RowState =>
  questionBucketOf({ entry }) === 'open'
    ? {
        phase: 'waiting',
        reason: { kind: 'openQuestions' },
        ask: { kind: 'answer', question: entry.questions[0] ?? null },
      }
    : DONE_ROW_STATE;

type MergeQuestionRowsParams = {
  readonly drafts: ReadonlyArray<DraftRow>;
};

const mergeConsecutiveQuestionRows = ({
  drafts,
}: MergeQuestionRowsParams): ReadonlyArray<DraftRow> => {
  const merged: DraftRow[] = [];
  let index = 0;

  while (index < drafts.length) {
    const newest = drafts[index];
    if (newest === undefined) {
      break;
    }
    if (newest.entry.kind !== 'question' || newest.groupId == null) {
      merged.push(newest);
      index += 1;
      continue;
    }

    const newestBucket = questionBucketOf({ entry: newest.entry });
    const newestDayKey = newest.at === null ? null : dayKeyOf({ at: newest.at });
    let runIndex = index;
    const collected: OpenQuestion[] = [];
    while (runIndex < drafts.length) {
      const draft = drafts[runIndex];
      if (draft === undefined || draft.entry.kind !== 'question') {
        break;
      }
      if (draft.groupId !== newest.groupId) {
        break;
      }
      if (questionBucketOf({ entry: draft.entry }) !== newestBucket) {
        break;
      }
      const draftDayKey = draft.at === null ? null : dayKeyOf({ at: draft.at });
      if (runIndex > index && draftDayKey !== newestDayKey) {
        break;
      }
      collected.push(...draft.entry.questions);
      runIndex += 1;
    }

    if (runIndex === index + 1) {
      merged.push(newest);
      index = runIndex;
      continue;
    }

    merged.push({
      ...newest,
      entry: {
        ...newest.entry,
        questions: collected,
      },
    });
    index = runIndex;
  }

  return merged;
};

const isArtifactShown = ({
  entry,
  context,
}: {
  readonly entry: TimelineArtifactEntry;
  readonly context: EmitContext;
}): boolean => (entry.artifact.kind === 'report' ? context.showReports : context.showWireframes);

const stepAgentsOf = ({ entry }: { readonly entry: TimelineRunEntry }): ReadonlyArray<Agent> =>
  entry.children.flatMap((child) => (child.kind === 'agent' ? [child.agent] : []));

const isLaneSettled = ({ entry }: { readonly entry: TimelineAgentEntry }): boolean =>
  entry.agent.doneAt != null ||
  (isAgentSettled({ agent: entry.agent }) &&
    entry.children.every((child) => isAgentSettled({ agent: child.agent })));

const SCHEDULED_PHASES: ReadonlySet<RowPhase> = new Set<RowPhase>(['running', 'waiting', 'queued']);

const SKIPPED_UNDER_CLOSED: RowState = { phase: 'skipped', reason: { kind: 'skipped' }, ask: null };

const NO_QUESTION_ROWS: ReadonlySet<string> = new Set();

const NO_RESOLVE_FACTS: ReadonlyMap<string, ResolveActivityFacts> = new Map();

const NO_RESOLVE_BATCHES: ReadonlyMap<string, ResolveBatchRef> = new Map();

const NO_EXPANDED_GROUPS: ReadonlySet<string> = new Set();

const agentRowStateOf = ({
  entry,
  readyAgentId,
  failedAgentId = null,
  questionRowIds = NO_QUESTION_ROWS,
}: {
  readonly entry: TimelineAgentEntry;
  readonly readyAgentId: string | null;
  readonly failedAgentId?: string | null;
  readonly questionRowIds?: ReadonlySet<string>;
}): RowState => {
  const state = resolveAgentRowState({
    agent: entry.agent,
    isAsking: entry.openQuestions.length > 0 && !isQuestionDelegate({ agent: entry.agent }),
    question: oldestAgentOpenQuestion({ entry }),
    isReadyStep: readyAgentId === entry.agent.id,
    isMissingArtifact: entry.isMissingArtifact,
  });
  const isAskedOnItsQuestionRow =
    state.ask?.kind === 'answer' &&
    entry.openQuestions.every((question) => questionRowIds.has(question.id));
  if (isAskedOnItsQuestionRow) {
    return { ...state, ask: null };
  }
  if (failedAgentId === entry.agent.id && state.ask == null) {
    return { ...state, ask: { kind: 'restartStep' } };
  }
  return state;
};

const hasScheduledChildWork = ({
  entry,
  parentState,
}: {
  readonly entry: TimelineAgentEntry;
  readonly parentState: RowState;
}): boolean => {
  if (SCHEDULED_PHASES.has(parentState.phase)) {
    return true;
  }
  return entry.children.some((child) => {
    const { phase } = agentRowStateOf({ entry: child, readyAgentId: null });
    if (phase === 'queued') {
      return parentState.phase !== 'failed';
    }
    return phase === 'running' || phase === 'waiting';
  });
};

const childLaneShape = ({
  entry,
  parentState,
  groupId,
}: {
  readonly entry: TimelineAgentEntry;
  readonly parentState: RowState;
  readonly groupId: string | null;
}): RailGroupShape => {
  if (parentState.phase === 'closed') {
    return 'closed';
  }
  if (isLaneSettled({ entry })) {
    return 'merged';
  }
  if (!hasScheduledChildWork({ entry, parentState })) {
    return 'closed';
  }
  return groupId == null ? 'open' : 'rejoining';
};

const runLaneShape = ({
  isFinished,
  rowState,
  hasLiveWork,
}: {
  readonly isFinished: boolean;
  readonly rowState: RowState;
  readonly hasLiveWork: boolean;
}): RailGroupShape => {
  if (rowState.reason?.kind === 'closed') {
    return 'closed';
  }
  if (isFinished) {
    return 'merged';
  }
  const isHalted = rowState.phase === 'failed' || rowState.phase === 'closed';
  return isHalted && !hasLiveWork ? 'closed' : 'open';
};

const isRunFinished = ({ entry }: { readonly entry: TimelineRunEntry }): boolean => {
  if (entry.run.discardedAt != null) {
    return true;
  }
  return isWorkflowRunComplete({
    run: entry.run,
    workflow: entry.workflow,
    agents: stepAgentsOf({ entry }),
  });
};

type ChainedRun = {
  readonly title: string;
  readonly isFinished: boolean;
};

type EmitContext = {
  readonly unreadAgentIds: ReadonlySet<string>;
  readonly advanceByRunId: ReadonlyMap<string, WorkflowAdvanceState>;
  readonly decidingRunIds: ReadonlySet<string>;
  readonly chainedRunById: ReadonlyMap<string, ChainedRun>;
  readonly groups: RailGroupInput[];
  readonly showWorkflowSubagents: boolean;
  readonly showAgentSubagents: boolean;
  readonly showPlans: boolean;
  readonly showReports: boolean;
  readonly showWireframes: boolean;
  readonly showQuestions: boolean;
  readonly questionRowIds: ReadonlySet<string>;
  readonly resolveFactsByAgentId: ReadonlyMap<string, ResolveActivityFacts>;
  readonly expandedGroupIds: ReadonlySet<string> | null;
  readonly fullGroupIds: ReadonlySet<string>;
  readonly mores: Array<{ readonly anchorRowId: string; readonly more: DraftMore }>;
  readonly foldByRootId: ReadonlyMap<string, TimelineRowFold>;
};

const hasUnreadDescendant = ({
  entry,
  unreadAgentIds,
}: {
  readonly entry: TimelineAgentEntry;
  readonly unreadAgentIds: ReadonlySet<string>;
}): boolean =>
  entry.children.some(
    (child) =>
      unreadAgentIds.has(child.agent.id) || hasUnreadDescendant({ entry: child, unreadAgentIds }),
  );

type EmitAgentParams = {
  readonly entry: TimelineAgentEntry;
  readonly grade: TimelineRowGrade;
  readonly identity: RunIdentity | null;
  readonly isMuted: boolean;
  readonly familyId: string | null;
  readonly groupId: string | null;
  readonly showSubagents: boolean;
  readonly readyAgentId: string | null;
  readonly failedAgentId?: string | null;
  readonly isParentClosed: boolean;
  readonly context: EmitContext;
  readonly fold?: TimelineRowFold;
};

const nodeIndexOf = ({ stepLabel }: { readonly stepLabel: string | null }): string | null =>
  stepLabel == null ? null : (stepLabel.split('.').at(-1) ?? null);

const rowStateOfAgentRow = ({
  resolved,
  reviewFacts,
  isSkippedUnderClosed,
}: {
  readonly resolved: RowState;
  readonly reviewFacts: ResolveActivityFacts | undefined;
  readonly isSkippedUnderClosed: boolean;
}): RowState => {
  if (reviewFacts !== undefined && resolved.phase !== 'closed') {
    return resolverRowState({ facts: reviewFacts });
  }
  return isSkippedUnderClosed ? SKIPPED_UNDER_CLOSED : resolved;
};

type EntryStateParams = {
  readonly entry: TimelineAgentEntry;
  readonly readyAgentId: string | null;
  readonly failedAgentId?: string | null;
  readonly isParentClosed: boolean;
  readonly context: EmitContext;
};

const entryRowStateOf = ({
  entry,
  readyAgentId,
  failedAgentId = null,
  isParentClosed,
  context,
}: EntryStateParams): { readonly rowState: RowState; readonly isSkippedUnderClosed: boolean } => {
  const resolved = agentRowStateOf({
    entry,
    readyAgentId,
    failedAgentId,
    questionRowIds: context.questionRowIds,
  });
  const isSkippedUnderClosed = isParentClosed && resolved.phase === 'queued';
  const reviewFacts = context.resolveFactsByAgentId.get(entry.agent.id);
  return {
    rowState: rowStateOfAgentRow({ resolved, reviewFacts, isSkippedUnderClosed }),
    isSkippedUnderClosed,
  };
};

const earliestChildAt = ({
  children,
}: {
  readonly children: ReadonlyArray<TimelineAgentEntry>;
}): string | null => {
  const times = children.flatMap((child) => (child.at === null ? [] : [child.at]));
  return times.length === 0
    ? null
    : times.reduce((first, second) => (first <= second ? first : second));
};

type ExplodedRowsParams = {
  readonly groupId: string;
  readonly kind: TimelineExplodeSlot['kind'];
  readonly laneId: string;
  readonly children: ReadonlyArray<TimelineAgentEntry>;
  readonly identity: RunIdentity | null;
  readonly isMuted: boolean;
  readonly familyId: string | null;
  readonly showSubagents: boolean;
  readonly isParentClosed: boolean;
  readonly context: EmitContext;
};

const explodedRows = ({
  groupId,
  kind,
  laneId,
  children,
  identity,
  isMuted,
  familyId,
  showSubagents,
  isParentClosed,
  context,
}: ExplodedRowsParams): ReadonlyArray<DraftRow> => {
  const blocks = children
    .map((child) =>
      agentRows({
        entry: child,
        grade: 'step',
        identity,
        isMuted,
        familyId,
        groupId: laneId,
        showSubagents,
        readyAgentId: null,
        isParentClosed,
        context,
      }),
    )
    .flatMap((block) => {
      const origin = block.at(-1);
      return origin === undefined ? [] : [{ origin, block }];
    })
    .sort((first, second) => compareNewestFirst({ first: first.origin, second: second.origin }));
  const hiddenCount = context.fullGroupIds.has(groupId)
    ? 0
    : Math.max(0, blocks.length - GROUP_VISIBLE_CHILDREN);
  const shown = blocks.slice(hiddenCount);
  const rows = shown
    .flatMap(({ block }) => block)
    .sort((first, second) => compareNewestFirst({ first, second }));
  const slot: TimelineExplodeSlot = { groupId, kind };
  const newest = shown[0]?.origin;
  if (hiddenCount > 0 && newest !== undefined) {
    context.mores.push({
      anchorRowId: newest.id,
      more: {
        kind: 'more',
        id: `more:${groupId}`,
        familyId,
        groupId: laneId,
        hiddenCount,
        explode: slot,
      },
    });
  }
  return rows.map((row) => (row.groupId === laneId ? { ...row, explode: slot } : row));
};

const hasSubagentGroup = ({
  entry,
  showSubagents,
  context,
}: {
  readonly entry: TimelineAgentEntry;
  readonly showSubagents: boolean;
  readonly context: EmitContext;
}): boolean =>
  showSubagents &&
  context.expandedGroupIds !== null &&
  entry.children.length >= SUBAGENT_GROUP_MIN_MEMBERS;

const subagentAttentionKeys = ({
  child,
}: {
  readonly child: TimelineAgentEntry;
}): ReadonlyArray<string> =>
  child.openQuestions.length > 0 && !isQuestionDelegate({ agent: child.agent })
    ? child.openQuestions.map((question) => question.id)
    : [child.id];

const headerSortOrdinal = ({
  parentOrdinal,
  lowestChildOrdinal,
}: {
  readonly parentOrdinal: number;
  readonly lowestChildOrdinal: number;
}): number =>
  lowestChildOrdinal > parentOrdinal
    ? (parentOrdinal + lowestChildOrdinal) / 2
    : lowestChildOrdinal - 0.5;

type SubagentGroupRowsParams = {
  readonly entry: TimelineAgentEntry;
  readonly identity: RunIdentity | null;
  readonly isMuted: boolean;
  readonly familyId: string | null;
  readonly parentLaneId: string;
  readonly isChildParentClosed: boolean;
  readonly context: EmitContext;
};

const subagentGroupRows = ({
  entry,
  identity,
  isMuted,
  familyId,
  parentLaneId,
  isChildParentClosed,
  context,
}: SubagentGroupRowsParams): ReadonlyArray<DraftRow> => {
  const facts: ReadonlyArray<SubagentFact> = entry.children.map((child) => ({
    state: entryRowStateOf({
      entry: child,
      readyAgentId: null,
      isParentClosed: isChildParentClosed,
      context,
    }).rowState,
    isAsking: child.openQuestions.length > 0 && !isQuestionDelegate({ agent: child.agent }),
  }));
  const summary = subagentGroupSummary({ facts });
  const id = subagentGroupEntryId({ parentId: entry.id });
  const group: TimelineSubagentGroupEntry = {
    kind: 'subagentGroup',
    id,
    at: earliestChildAt({ children: entry.children }) ?? entry.at,
    parentId: entry.id,
    children: entry.children,
    summary,
    attentionKeys: entry.children.flatMap((child, index) => {
      const fact = facts[index];
      return fact !== undefined && isSubagentAttention({ fact })
        ? subagentAttentionKeys({ child })
        : [];
    }),
    isExpanded: context.expandedGroupIds?.has(id) === true,
  };
  const header: DraftRow = {
    kind: 'row',
    id,
    at: group.at,
    grade: 'step',
    entry: group,
    identity,
    familyId,
    groupId: parentLaneId,
    ordinal: null,
    sortOrdinal: headerSortOrdinal({
      parentOrdinal: entry.ordinal,
      lowestChildOrdinal: Math.min(...entry.children.map((child) => child.ordinal)),
    }),
    rowState: subagentGroupRowState({ summary }),
    hasUnread: entry.children.some(
      (child) =>
        context.unreadAgentIds.has(child.agent.id) ||
        hasUnreadDescendant({ entry: child, unreadAgentIds: context.unreadAgentIds }),
    ),
    isPending: false,
  };
  if (!group.isExpanded) {
    return [header];
  }
  const laneId = laneIdOf({ entryId: id });
  context.groups.push({
    id: laneId,
    parentGroupId: parentLaneId,
    identityIndex: identity?.index ?? null,
    isMuted,
    originRowId: id,
    shape: 'merged',
  });
  return [
    ...explodedRows({
      groupId: id,
      kind: 'subagents',
      laneId,
      children: entry.children,
      identity,
      isMuted,
      familyId,
      showSubagents: true,
      isParentClosed: isChildParentClosed,
      context,
    }),
    header,
  ];
};

type SubagentRowsParams = {
  readonly entry: TimelineAgentEntry;
  readonly identity: RunIdentity | null;
  readonly isMuted: boolean;
  readonly familyId: string | null;
  readonly laneId: string;
  readonly showSubagents: boolean;
  readonly isChildParentClosed: boolean;
  readonly context: EmitContext;
};

const subagentRows = ({
  entry,
  identity,
  isMuted,
  familyId,
  laneId,
  showSubagents,
  isChildParentClosed,
  context,
}: SubagentRowsParams): ReadonlyArray<DraftRow> => {
  if (hasSubagentGroup({ entry, showSubagents, context })) {
    return subagentGroupRows({
      entry,
      identity,
      isMuted,
      familyId,
      parentLaneId: laneId,
      isChildParentClosed,
      context,
    });
  }
  return entry.children.flatMap((child) =>
    agentRows({
      entry: child,
      grade: 'step',
      identity,
      isMuted,
      familyId,
      groupId: laneId,
      showSubagents,
      readyAgentId: null,
      isParentClosed: isChildParentClosed,
      context,
    }),
  );
};

const withStepsSlot = ({
  rows,
  fold,
  groupId,
}: {
  readonly rows: ReadonlyArray<DraftRow>;
  readonly fold: TimelineRowFold | undefined;
  readonly groupId: string;
}): ReadonlyArray<DraftRow> => {
  if (fold === undefined) {
    return rows;
  }
  const slot: TimelineExplodeSlot = { groupId, kind: 'steps' };
  return rows.map((row) => (row.explode === undefined ? { ...row, explode: slot } : row));
};

const agentRows = ({
  entry,
  grade,
  identity,
  isMuted,
  familyId,
  groupId,
  showSubagents,
  readyAgentId,
  failedAgentId = null,
  isParentClosed,
  context,
  fold,
}: EmitAgentParams): ReadonlyArray<DraftRow> => {
  const { rowState, isSkippedUnderClosed } = entryRowStateOf({
    entry,
    readyAgentId,
    failedAgentId,
    isParentClosed,
    context,
  });
  const childLaneId = laneIdOf({ entryId: entry.id });
  const isChildParentClosed = rowState.phase === 'closed' || isSkippedUnderClosed;
  const nested: DraftRow[] = [];
  const isFolded = fold !== undefined && !fold.isExpanded;
  if (showSubagents && entry.children.length > 0 && !isFolded) {
    context.groups.push({
      id: childLaneId,
      parentGroupId: groupId,
      identityIndex: identity?.index ?? null,
      isMuted,
      originRowId: entry.id,
      shape: childLaneShape({ entry, parentState: rowState, groupId }),
    });
    nested.push(
      ...subagentRows({
        entry,
        identity,
        isMuted,
        familyId,
        laneId: childLaneId,
        showSubagents,
        isChildParentClosed,
        context,
      }),
    );
  }
  const isPending = entry.agent.status === 'pending' && !isSkippedUnderClosed;
  const origin: DraftRow = {
    kind: 'row',
    id: entry.id,
    at: entry.at,
    grade: isPending && grade === 'step' ? 'pending' : grade,
    entry,
    identity,
    familyId,
    groupId,
    ordinal: entry.stepLabel,
    sortOrdinal: entry.ordinal,
    rowState,
    hasUnread:
      context.unreadAgentIds.has(entry.agent.id) ||
      ((!showSubagents || isFolded) &&
        hasUnreadDescendant({ entry, unreadAgentIds: context.unreadAgentIds })),
    isPending,
    ...(fold === undefined ? {} : { fold }),
  };
  return [...withStepsSlot({ rows: nested, fold, groupId: entry.id }), origin];
};

type EmitRunParams = {
  readonly entry: TimelineRunEntry;
  readonly context: EmitContext;
};

const readyStepOf = ({
  entry,
  advance,
}: {
  readonly entry: TimelineRunEntry;
  readonly advance: WorkflowAdvanceState | null;
}): RowReadyStep | null => {
  if (advance?.kind !== 'ready') {
    return null;
  }
  for (const child of entry.children) {
    if (
      child.kind === 'agent' &&
      child.agent.stepId === advance.step.id &&
      child.agent.status === 'pending'
    ) {
      return { step: advance.step, agent: child.agent, stepLabel: child.stepLabel };
    }
  }
  return null;
};

const failedStepOf = ({ entry }: { readonly entry: TimelineRunEntry }) => {
  for (const child of entry.children) {
    if (
      child.kind === 'agent' &&
      isAgentStatusHalted({ status: child.agent.status }) &&
      child.agent.doneAt == null
    ) {
      return {
        agentId: child.agent.id,
        stepLabel: child.stepLabel,
        isBlocked: child.agent.status === 'blocked',
      };
    }
  }
  return null;
};

const stoppedStepOf = ({ entry }: { readonly entry: TimelineRunEntry }): RowStoppedStep | null => {
  for (const child of entry.children) {
    if (child.kind === 'agent' && child.agent.status === 'stopped' && child.agent.doneAt == null) {
      return { stepLabel: child.stepLabel };
    }
  }
  return null;
};

const chainedAfterTitleOf = ({
  entry,
  context,
}: {
  readonly entry: TimelineRunEntry;
  readonly context: EmitContext;
}): string | null => {
  const afterId = entry.run.chainAfterId;
  if (afterId == null) {
    return null;
  }
  const chained = context.chainedRunById.get(afterId);
  if (chained === undefined || chained.isFinished) {
    return null;
  }
  return chained.title;
};

const runStateOf = ({ entry, context }: EmitRunParams) => {
  const isFinished = isRunFinished({ entry });
  const advance = context.advanceByRunId.get(entry.run.id) ?? null;
  const readyStep = readyStepOf({ entry, advance });
  const steps = stepAgentsOf({ entry });
  const hasRunningStep = steps.some((agent) => agent.status === 'running');
  const isDeciding = !isFinished && context.decidingRunIds.has(entry.run.id);
  const failedStep = failedStepOf({ entry });
  const shownQuestionIds = runShownQuestionIds({
    entry,
    questionRowIds: context.questionRowIds,
    showSubagents: context.showWorkflowSubagents,
  });
  const rowState = resolveRunRowState({
    run: entry.run,
    advance,
    isFinished,
    isDeciding,
    hasRunningStep,
    failedStep,
    stoppedStep: stoppedStepOf({ entry }),
    question: runOpenQuestion({ entry, shownQuestionIds }),
    isQuestionShown: hasShownRunQuestion({ entry, shownQuestionIds }),
    readyStep,
    chainedAfterTitle: chainedAfterTitleOf({ entry, context }),
  });
  return { isFinished, readyStep, steps, hasRunningStep, isDeciding, failedStep, rowState };
};

const runRows = ({ entry, context }: EmitRunParams): ReadonlyArray<DraftRow> => {
  const laneId = laneIdOf({ entryId: entry.id });
  const isMuted = entry.run.discardedAt != null;
  const { isFinished, readyStep, steps, hasRunningStep, isDeciding, failedStep, rowState } =
    runStateOf({ entry, context });
  const fold = context.foldByRootId.get(entry.id);
  const isFolded = fold !== undefined && !fold.isExpanded;
  const origin: DraftRow = {
    kind: 'row',
    id: entry.id,
    at: entry.at,
    grade: 'entry',
    entry,
    identity: entry.identity,
    familyId: entry.id,
    groupId: null,
    ordinal: null,
    sortOrdinal: 0,
    rowState,
    hasUnread: steps.some((agent) => context.unreadAgentIds.has(agent.id)),
    isPending: false,
    ...(fold === undefined ? {} : { fold }),
  };
  if (isFolded) {
    return [origin];
  }
  context.groups.push({
    id: laneId,
    parentGroupId: null,
    identityIndex: entry.identity.index,
    isMuted,
    originRowId: entry.id,
    shape: runLaneShape({ isFinished, rowState, hasLiveWork: hasRunningStep || isDeciding }),
  });
  const nested: DraftRow[] = [];
  for (const child of entry.children) {
    if (child.kind === 'agent') {
      nested.push(
        ...agentRows({
          entry: child,
          grade: 'step',
          identity: entry.identity,
          isMuted,
          familyId: entry.id,
          groupId: laneId,
          showSubagents: context.showWorkflowSubagents,
          readyAgentId: readyStep?.agent.id ?? null,
          failedAgentId: failedStep?.agentId ?? null,
          isParentClosed: false,
          context,
        }),
      );
      continue;
    }
    if (child.kind === 'plan' && !context.showPlans) {
      continue;
    }
    if (child.kind === 'artifact' && !isArtifactShown({ entry: child, context })) {
      continue;
    }
    const row: DraftRow = {
      kind: 'row',
      id: child.id,
      at: child.at,
      grade: 'step',
      entry: child,
      identity: entry.identity,
      familyId: entry.id,
      groupId: laneId,
      ordinal: null,
      sortOrdinal: 0,
      rowState: DONE_ROW_STATE,
      hasUnread: false,
      isPending: false,
    };
    nested.push(row);
  }
  return [...withStepsSlot({ rows: nested, fold, groupId: entry.id }), origin];
};

type LaneFacts = {
  readonly rows: number;
  readonly answered: number;
  readonly hasOpen: boolean;
};

const NO_LANE_FACTS: LaneFacts = { rows: 0, answered: 0, hasOpen: false };

const NO_FOLDS: ReadonlyMap<string, TimelineRowFold> = new Map();

const laneRootOf = ({ entry }: { readonly entry: TimelineTopLevelEntry }): string | null => {
  if (entry.kind === 'question') {
    return entry.lane?.rootEntryId ?? null;
  }
  if (entry.kind === 'plan' || entry.kind === 'artifact') {
    return entry.lane?.rootEntryId ?? null;
  }
  return null;
};

const isLaneEntryShown = ({
  entry,
  context,
}: {
  readonly entry: TimelineTopLevelEntry;
  readonly context: EmitContext;
}): boolean => {
  if (entry.kind === 'question') {
    return context.showQuestions;
  }
  if (entry.kind === 'plan') {
    return context.showPlans;
  }
  if (entry.kind === 'artifact') {
    return isArtifactShown({ entry, context });
  }
  return false;
};

const laneFactsByRootId = ({
  entries,
  context,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly context: EmitContext;
}): ReadonlyMap<string, LaneFacts> => {
  const facts = new Map<string, LaneFacts>();
  for (const entry of entries) {
    const root = laneRootOf({ entry });
    if (root === null) {
      continue;
    }
    const current = facts.get(root) ?? NO_LANE_FACTS;
    const questions = entry.kind === 'question' ? entry.questions : [];
    facts.set(root, {
      rows: current.rows + (isLaneEntryShown({ entry, context }) ? 1 : 0),
      answered:
        current.answered + questions.filter((question) => question.status === 'answered').length,
      hasOpen: current.hasOpen || questions.some((question) => question.status === 'open'),
    });
  }
  return facts;
};

const treeAgentIds = ({ entry }: { readonly entry: TimelineAgentEntry }): ReadonlyArray<string> => [
  entry.agent.id,
  ...entry.children.flatMap((child) => treeAgentIds({ entry: child })),
];

const contextAgentIdOf = ({
  entry,
}: {
  readonly entry: TimelineTopLevelEntry;
}): { readonly agentId: string; readonly added: number } | null => {
  if (entry.kind === 'learning') {
    const agentId = entry.item.source?.agentId ?? null;
    return agentId === null ? null : { agentId, added: 1 };
  }
  if (entry.kind !== 'event' || entry.event.kind !== 'decisions_changed') {
    return null;
  }
  const agentId = entry.event.payload?.agentId ?? null;
  if (agentId === null) {
    return null;
  }
  return { agentId, added: decisionDiff({ payload: entry.event.payload }).additions };
};

const contextAddedByRunId = ({
  entries,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
}): ReadonlyMap<string, number> => {
  const runOfAgent = new Map<string, string>();
  for (const entry of entries) {
    if (entry.kind !== 'run') {
      continue;
    }
    for (const child of entry.children) {
      if (child.kind === 'agent') {
        treeAgentIds({ entry: child }).forEach((agentId) => runOfAgent.set(agentId, entry.id));
      }
    }
  }
  const added = new Map<string, number>();
  for (const entry of entries) {
    const update = contextAgentIdOf({ entry });
    const runId = update === null ? undefined : runOfAgent.get(update.agentId);
    if (update === null || runId === undefined) {
      continue;
    }
    added.set(runId, (added.get(runId) ?? 0) + update.added);
  }
  return added;
};

const isRunChildShown = ({
  child,
  context,
}: {
  readonly child: TimelineRunEntry['children'][number];
  readonly context: EmitContext;
}): boolean => {
  if (child.kind === 'plan') {
    return context.showPlans;
  }
  if (child.kind === 'artifact') {
    return isArtifactShown({ entry: child, context });
  }
  return true;
};

type FoldParams<Entry> = {
  readonly entry: Entry;
  readonly lane: LaneFacts;
  readonly context: EmitContext;
  readonly contextAdded?: number;
};

const runFoldOf = ({
  entry,
  lane,
  context,
  contextAdded = 0,
}: FoldParams<TimelineRunEntry>): TimelineRowFold | null => {
  const expanded = context.expandedGroupIds;
  if (expanded === null || lane.hasOpen) {
    return null;
  }
  const { isFinished, rowState } = runStateOf({ entry, context });
  if (!isFinished || rowState.ask != null || rowState.phase === 'failed') {
    return null;
  }
  const rows =
    entry.children.filter((child) => isRunChildShown({ child, context })).length + lane.rows;
  if (rows < STEPS_GROUP_MIN_ROWS) {
    return null;
  }
  const steps = stepAgentsOf({ entry }).filter(
    (agent) => agent.status !== 'pending' && agent.status !== 'skipped',
  ).length;
  return {
    kind: 'run',
    isExpanded: expanded.has(entry.id),
    summary: stepsGroupSummary({
      kind: 'run',
      steps,
      answered: lane.answered,
      contextAdded,
    }),
  };
};

const isTreeSettled = ({ entry }: { readonly entry: TimelineAgentEntry }): boolean =>
  isAgentSettled({ agent: entry.agent }) &&
  entry.children.every((child) => isTreeSettled({ entry: child }));

const descendantCount = ({ entry }: { readonly entry: TimelineAgentEntry }): number =>
  entry.children.reduce((total, child) => total + 1 + descendantCount({ entry: child }), 0);

const descendantRows = ({ entry }: { readonly entry: TimelineAgentEntry }): number =>
  entry.children.length >= SUBAGENT_GROUP_MIN_MEMBERS
    ? 1
    : entry.children.reduce((total, child) => total + 1 + descendantRows({ entry: child }), 0);

const chainFoldOf = ({
  entry,
  lane,
  context,
}: FoldParams<TimelineAgentEntry>): TimelineRowFold | null => {
  const expanded = context.expandedGroupIds;
  if (expanded === null || entry.chain == null || !context.showAgentSubagents || lane.hasOpen) {
    return null;
  }
  if (!isTreeSettled({ entry })) {
    return null;
  }
  const { rowState } = entryRowStateOf({
    entry,
    readyAgentId: null,
    isParentClosed: false,
    context,
  });
  if (rowState.ask != null || (rowState.phase !== 'done' && rowState.phase !== 'closed')) {
    return null;
  }
  if (descendantRows({ entry }) + lane.rows < STEPS_GROUP_MIN_ROWS) {
    return null;
  }
  return {
    kind: 'chain',
    isExpanded: expanded.has(entry.id),
    summary: stepsGroupSummary({
      kind: 'chain',
      steps: descendantCount({ entry }),
      answered: lane.answered,
    }),
  };
};

export const liveFoldRootIds = ({
  entries,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
}): ReadonlyArray<string> =>
  entries.flatMap((entry) => {
    if (entry.kind === 'run') {
      return isRunFinished({ entry }) ? [] : [entry.id];
    }
    if (entry.kind === 'agent' && entry.chain != null) {
      return isTreeSettled({ entry }) ? [] : [entry.id];
    }
    return [];
  });

const foldsOf = ({
  entries,
  context,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly context: EmitContext;
}): ReadonlyMap<string, TimelineRowFold> => {
  const lanes = laneFactsByRootId({ entries, context });
  const contextAdded = contextAddedByRunId({ entries });
  const folds = new Map<string, TimelineRowFold>();
  for (const entry of entries) {
    const lane = lanes.get(entry.id) ?? NO_LANE_FACTS;
    const fold =
      entry.kind === 'run'
        ? runFoldOf({ entry, lane, context, contextAdded: contextAdded.get(entry.id) ?? 0 })
        : entry.kind === 'agent'
          ? chainFoldOf({ entry, lane, context })
          : null;
    if (fold !== null) {
      folds.set(entry.id, fold);
    }
  }
  return folds;
};

const questionGradeOf = ({
  entry,
}: {
  readonly entry: TimelineQuestionEntry;
}): TimelineRowGrade => {
  if (entry.lane != null) {
    return 'step';
  }
  return entry.questions.some((question) => question.status === 'open') ? 'entry' : 'fact';
};

const isPendingStep = ({ draft }: { readonly draft: DraftRow }): boolean =>
  draft.isPending && draft.grade !== 'entry';

type ExecutionPathParams = {
  readonly draft: DraftRow;
};

const executionPathOf = ({ draft }: ExecutionPathParams): ReadonlyArray<number> =>
  draft.entry.kind === 'agent' && draft.entry.stepLabel != null
    ? draft.entry.stepLabel.split('.').map(Number)
    : [];

type CompareExecutionPathParams = {
  readonly first: DraftRow;
  readonly second: DraftRow;
};

const compareExecutionPathDescending = ({ first, second }: CompareExecutionPathParams): number => {
  const firstPath = executionPathOf({ draft: first });
  const secondPath = executionPathOf({ draft: second });
  const shared = Math.min(firstPath.length, secondPath.length);
  for (let index = 0; index < shared; index += 1) {
    const difference = (secondPath[index] ?? 0) - (firstPath[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  if (shared === 0) {
    return 0;
  }
  return secondPath.length - firstPath.length;
};

type HeadParams = {
  readonly drafts: ReadonlyArray<DraftRow>;
};

const withPendingAtFamilyHead = ({ drafts }: HeadParams): ReadonlyArray<DraftRow> => {
  const pendingByFamilyId = new Map<string, DraftRow[]>();
  const unanchored: DraftRow[] = [];
  for (const draft of drafts) {
    if (!isPendingStep({ draft }) || draft.familyId == null || draft.familyId === draft.id) {
      unanchored.push(draft);
      continue;
    }
    const pending = pendingByFamilyId.get(draft.familyId) ?? [];
    pending.push({ ...draft, at: null });
    pendingByFamilyId.set(draft.familyId, pending);
  }
  for (const pending of pendingByFamilyId.values()) {
    pending.sort(
      (first, second) =>
        compareExecutionPathDescending({ first, second }) ||
        second.sortOrdinal - first.sortOrdinal ||
        first.id.localeCompare(second.id),
    );
  }
  const anchored: DraftRow[] = [];
  for (const draft of unanchored) {
    const familyId = draft.familyId;
    if (familyId == null) {
      continue;
    }
    const pending = pendingByFamilyId.get(familyId);
    if (pending !== undefined) {
      anchored.push(...pending);
      pendingByFamilyId.delete(familyId);
    }
  }
  const remaining = [...pendingByFamilyId.values()]
    .flat()
    .map((draft) => ({ ...draft, at: null }))
    .sort((first, second) => compareNewestFirst({ first, second }));
  return [...remaining, ...anchored, ...unanchored];
};

type DayBreakParams = {
  readonly drafts: ReadonlyArray<DraftRow>;
  readonly dayLabelFor: (params: { readonly at: string }) => string | null;
};

const withDayBreaks = ({ drafts, dayLabelFor }: DayBreakParams): ReadonlyArray<Draft> => {
  const dated: Draft[] = [];
  let previousDayKey: string | null = null;

  for (const draft of drafts) {
    const { at } = draft;
    if (at == null) {
      dated.push(draft);
      continue;
    }
    const dayKey = dayKeyOf({ at });
    const label = dayLabelFor({ at });
    if (dayKey !== previousDayKey && label != null && dated.length > 0) {
      dated.push({ kind: 'day', id: `day:${dayKey}`, label });
    }
    previousDayKey = dayKey;
    dated.push(draft);
  }

  return dated;
};

type MoreRowsParams = {
  readonly drafts: ReadonlyArray<Draft>;
  readonly mores: EmitContext['mores'];
};

const withMoreRows = ({ drafts, mores }: MoreRowsParams): ReadonlyArray<Draft> => {
  if (mores.length === 0) {
    return drafts;
  }
  const moreByAnchorId = new Map(mores.map(({ anchorRowId, more }) => [anchorRowId, more]));
  return drafts.flatMap((draft) => {
    const more = moreByAnchorId.get(draft.id);
    return more === undefined ? [draft] : [more, draft];
  });
};

type StreamItemsParams = {
  readonly drafts: ReadonlyArray<Draft>;
};

const streamItemsOf = ({ drafts }: StreamItemsParams): ReadonlyArray<TimelineStreamItem> => {
  const items: TimelineStreamItem[] = [
    {
      kind: 'now',
      id: 'now',
      height: TIMELINE_RHYTHM.now.height,
      topY: TIMELINE_RHYTHM.now.ruleY,
      ruleY: TIMELINE_RHYTHM.now.ruleY,
      markerY: null,
      groupId: null,
      isPending: false,
      gap: 'none',
    },
  ];

  let previous: Draft | null = null;
  for (const draft of drafts) {
    if (draft.kind === 'day') {
      items.push({
        kind: 'day',
        id: draft.id,
        label: draft.label,
        height: TIMELINE_RHYTHM.day.height,
        topY: 0,
        ruleY: TIMELINE_RHYTHM.day.ruleY,
        markerY: TIMELINE_RHYTHM.day.ruleY,
        groupId: null,
        isPending: false,
        gap: 'none',
      });
      previous = draft;
      continue;
    }
    const { familyId } = draft;
    if (draft.kind === 'more') {
      const moreGap: TimelineGap = previous == null || previous.kind === 'day' ? 'none' : 'sibling';
      items.push({
        kind: 'more',
        id: draft.id,
        familyId,
        hiddenCount: draft.hiddenCount,
        explode: draft.explode,
        height: rowBoxHeight({ grade: 'fact', gap: moreGap }),
        topY: 0,
        markerY: markerCenterY({ grade: 'fact', gap: moreGap }),
        groupId: draft.groupId,
        isPending: false,
        gap: moreGap,
      });
      previous = draft;
      continue;
    }
    const gap: TimelineGap =
      previous == null || previous.kind === 'day'
        ? 'none'
        : familyId != null && previous.familyId === familyId
          ? 'sibling'
          : draft.grade === 'fact'
            ? 'fact'
            : 'entry';
    items.push({
      kind: 'row',
      id: draft.id,
      at: draft.at,
      grade: draft.grade,
      entry: draft.entry,
      identity: draft.identity,
      familyId: draft.familyId,
      ordinal: draft.ordinal,
      nodeIndex:
        draft.entry.kind === 'agent' ? nodeIndexOf({ stepLabel: draft.entry.stepLabel }) : null,
      rowState: draft.rowState,
      hasUnread: draft.hasUnread,
      height: rowBoxHeight({ grade: draft.grade, gap }),
      topY: 0,
      markerY: markerCenterY({ grade: draft.grade, gap }),
      groupId: draft.groupId,
      isPending: draft.isPending,
      opensLane:
        draft.entry.kind === 'resolveBatch' ||
        draft.entry.kind === 'subagentGroup' ||
        draft.fold !== undefined,
      gap,
      ...(draft.explode === undefined ? {} : { explode: draft.explode }),
      ...(draft.fold === undefined ? {} : { fold: draft.fold }),
    });
    previous = draft;
  }

  return items;
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

type BatchRowsParams = {
  readonly batch: TimelineResolveBatchEntry;
  readonly context: EmitContext;
  readonly unreadAgentIds: ReadonlySet<string>;
};

const batchLaneIdOf = ({ batch }: { readonly batch: TimelineResolveBatchEntry }): string =>
  laneIdOf({ entryId: batch.id });

const batchRows = ({
  batch,
  context,
  unreadAgentIds,
}: BatchRowsParams): { readonly header: DraftRow; readonly children: ReadonlyArray<DraftRow> } => {
  const identity = runIdentity({
    laneIndex: 0,
    seed: runIdentitySeed({ sessionId: batch.batchId }),
  });
  const laneId = batchLaneIdOf({ batch });
  const header: DraftRow = {
    kind: 'row',
    id: batch.id,
    at: batch.at,
    grade: 'entry',
    entry: batch,
    identity,
    familyId: batch.id,
    groupId: null,
    ordinal: null,
    sortOrdinal: Math.min(...batch.children.map((child) => child.ordinal)) - 1,
    rowState: resolveBatchRowState({ summary: batch.summary }),
    hasUnread: batch.children.some((child) => unreadAgentIds.has(child.agent.id)),
    isPending: false,
  };
  if (!batch.isExpanded) {
    return { header, children: [] };
  }
  context.groups.push({
    id: laneId,
    parentGroupId: null,
    identityIndex: identity.index,
    isMuted: false,
    originRowId: batch.id,
    shape: 'merged',
  });
  return {
    header,
    children: explodedRows({
      groupId: batch.id,
      kind: 'batch',
      laneId,
      children: batch.children,
      identity,
      isMuted: false,
      familyId: batch.id,
      showSubagents: context.showAgentSubagents,
      isParentClosed: false,
      context,
    }),
  };
};

export const buildTimelineStream = ({
  entries,
  unreadAgentIds,
  advanceByRunId,
  decidingRunIds,
  dayLabelFor,
  showWorkflowSubagents = true,
  showAgentSubagents = true,
  showPlans = true,
  showReports = true,
  showWireframes = true,
  showQuestions = true,
  resolveBatchByAgentId = NO_RESOLVE_BATCHES,
  resolveFactsByAgentId = NO_RESOLVE_FACTS,
  expandedGroupIds = NO_EXPANDED_GROUPS,
  fullGroupIds = NO_EXPANDED_GROUPS,
  foldsFinished = false,
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
    showWorkflowSubagents,
    showAgentSubagents,
    showPlans,
    showReports,
    showWireframes,
    showQuestions,
    questionRowIds: showQuestions ? openQuestionRowIds({ entries }) : NO_QUESTION_ROWS,
    resolveFactsByAgentId,
    expandedGroupIds,
    fullGroupIds,
    mores: [],
    foldByRootId: NO_FOLDS,
  };
  const rows: DraftRow[] = [];
  const grouped = groupResolveBatches({
    entries,
    batchByAgentId: resolveBatchByAgentId,
    factsByAgentId: resolveFactsByAgentId,
    expandedBatchIds: expandedGroupIds,
  });
  const context: EmitContext = foldsFinished
    ? { ...base, foldByRootId: foldsOf({ entries: grouped.remaining, context: base }) }
    : base;
  for (const batch of grouped.batches) {
    const { header, children } = batchRows({ batch, context, unreadAgentIds });
    rows.push(header, ...children);
  }

  for (const entry of grouped.remaining) {
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
          fold: context.foldByRootId.get(entry.id),
        }),
      );
      continue;
    }
    const laneRoot = laneRootOf({ entry });
    const laneFold = laneRoot === null ? undefined : context.foldByRootId.get(laneRoot);
    if (laneFold !== undefined && !laneFold.isExpanded) {
      continue;
    }
    const laneSlot: Partial<Pick<DraftRow, 'explode'>> =
      laneFold === undefined || laneRoot === null
        ? {}
        : { explode: { groupId: laneRoot, kind: 'steps' } };
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
  const merged = mergeConsecutiveQuestionRows({
    drafts: mergeConsecutiveProjectRows({
      drafts: mergeConsecutiveDecisionRows({ drafts: sorted }).filter(
        (draft) => !isEmptyDecisionRow({ draft }),
      ),
    }),
  });
  const withDays = withDayBreaks({
    drafts: withPendingAtFamilyHead({ drafts: merged }),
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
};

export const buildRunTreeStream = ({
  entry,
  unreadAgentIds,
  advance,
  isDeciding,
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
    expandedGroupIds: null,
    fullGroupIds: NO_EXPANDED_GROUPS,
    mores: [],
    foldByRootId: NO_FOLDS,
  };
  const sorted = [...runRows({ entry, context })].sort((first, second) =>
    compareNewestFirst({ first, second }),
  );
  const steps = withPendingAtFamilyHead({ drafts: sorted }).filter(
    (draft) => draft.id !== entry.id,
  );
  const laneId = laneIdOf({ entryId: entry.id });
  const root = [...steps].reverse().find((draft) => draft.groupId === laneId) ?? null;
  const groups = context.groups.map((group) =>
    group.id === laneId && root !== null ? { ...group, originRowId: root.id } : group,
  );
  const isFinished = isRunFinished({ entry });
  return {
    items: streamItemsOf({ drafts: steps }).filter((item) => !isFinished || item.kind !== 'now'),
    groups,
  };
};

type AgentTreeParams = {
  readonly entry: TimelineAgentEntry;
  readonly identity: RunIdentity | null;
  readonly unreadAgentIds: ReadonlySet<string>;
};

export const buildAgentTreeStream = ({
  entry,
  identity,
  unreadAgentIds,
}: AgentTreeParams): TimelineStream => {
  const context: EmitContext = {
    unreadAgentIds,
    advanceByRunId: new Map(),
    decidingRunIds: new Set(),
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
    expandedGroupIds: null,
    fullGroupIds: NO_EXPANDED_GROUPS,
    mores: [],
    foldByRootId: NO_FOLDS,
  };
  const rootLaneId = `tree:${entry.id}`;
  context.groups.push({
    id: rootLaneId,
    parentGroupId: null,
    identityIndex: identity?.index ?? null,
    isMuted: false,
    originRowId: entry.id,
    shape: 'merged',
  });
  const rows = agentRows({
    entry,
    grade: 'step',
    identity,
    isMuted: false,
    familyId: entry.id,
    groupId: rootLaneId,
    showSubagents: true,
    readyAgentId: null,
    isParentClosed: false,
    context,
  });
  const sorted = [...rows].sort((first, second) => compareNewestFirst({ first, second }));
  return {
    items: streamItemsOf({ drafts: withPendingAtFamilyHead({ drafts: sorted }) }).filter(
      (item) => item.kind !== 'now',
    ),
    groups: context.groups,
  };
};
