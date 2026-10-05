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
  TimelineResolveFileEntry,
  TimelineResolveOpenEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from './buildTimelineGroups';
import type {
  RailGroupDirection,
  RailGroupInput,
  RailGroupShape,
} from '../../workTreeModel/railGeometry';
import { runIdentity, runIdentitySeed, type RunIdentity } from './runIdentity';
import { groupResolveBatches } from './resolveBatchGroups';
import { resolveBatchFiles, resolveBatchOpen } from './resolveBatchFiles';
import { resolverRowState, type ResolveActivityFacts } from './resolveActivity';
import { resolveBatchRowState, type ResolveBatchRef } from './resolveBatchSummary';
import { decisionCountsText, isEmptyDecisionDiff } from './sessionEventPresentation';
import { countGroupSummary, stepsGroupSummary, type GroupSummary } from './groupSummary';
import {
  isSubagentAttention,
  subagentsCountSummary,
  subagentsExpandId,
  type SubagentFact,
} from './subagentSummary';
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
  | TimelineResolveFileEntry
  | TimelineResolveOpenEntry;

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
  readonly kind: 'batch' | 'subagents' | 'steps' | 'outputs';
};

type TimelineOutputEntry = TimelinePlanEntry | TimelineArtifactEntry | TimelineLearningEntry;

const outputsExpandId = ({ parentId }: { readonly parentId: string }): string =>
  `outputs:${parentId}`;

type TimelineRowBranch = {
  readonly expandId: string;
  readonly isExpanded: boolean;
};

export type TimelineRowItem = StreamRail & {
  readonly kind: 'row';
  readonly at: string | null;
  readonly grade: TimelineRowGrade;
  readonly entry: TimelineStreamEntry;
  readonly identity: RunIdentity | null;
  readonly familyId: string | null;
  readonly ordinal: string | null;
  readonly rowState: RowState;
  readonly hasUnread: boolean;
  readonly explode?: TimelineExplodeSlot;
  readonly branches?: ReadonlyArray<TimelineRowBranch>;
  readonly hasSubagentAttention?: true;
};

export type TimelineMoreItem = StreamRail & {
  readonly kind: 'more';
  readonly familyId: string | null;
  readonly hiddenCount: number;
  readonly explode: TimelineExplodeSlot;
};

export type TimelineCountItem = StreamRail & {
  readonly kind: 'count';
  readonly familyId: string | null;
  readonly branchKind: TimelineExplodeSlot['kind'];
  readonly identityIndex: number | null;
  readonly expandId: string;
  readonly isExpanded: boolean;
  readonly summary: GroupSummary;
};

export type TimelineStreamItem =
  TimelineNowItem | TimelineDayItem | TimelineRowItem | TimelineMoreItem | TimelineCountItem;

export const countRowIdOf = ({ expandId }: { readonly expandId: string }): string =>
  `count:${expandId}`;

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
  readonly branches?: ReadonlyArray<TimelineRowBranch>;
  readonly hasSubagentAttention?: true;
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

type DraftCount = {
  readonly kind: 'count';
  readonly id: string;
  readonly familyId: string | null;
  readonly branchKind: TimelineExplodeSlot['kind'];
  readonly identityIndex: number | null;
  readonly groupId: string;
  readonly expandId: string;
  readonly isExpanded: boolean;
  readonly summary: GroupSummary;
};

type Draft = DraftRow | DraftDay | DraftMore | DraftCount;

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

const outputsLaneIdOf = ({ entryId }: { readonly entryId: string }): string =>
  `outputs-lane:${entryId}`;

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

type StoppedKey = {
  readonly branch: string | null;
  readonly origin: string | null;
};

const stoppedKeyOf = ({ draft }: { readonly draft: DraftRow }): StoppedKey | null => {
  if (draft.groupId != null || draft.entry.kind !== 'event') {
    return null;
  }
  const { event } = draft.entry;
  if (event.kind !== 'history_stopped') {
    return null;
  }
  return { branch: event.payload?.branch ?? null, origin: event.payload?.origin ?? null };
};

const isSameStoppedKey = ({
  first,
  second,
}: {
  readonly first: StoppedKey;
  readonly second: StoppedKey;
}): boolean => first.branch === second.branch && first.origin === second.origin;

const mergeConsecutiveStoppedRows = ({
  drafts,
}: {
  readonly drafts: ReadonlyArray<DraftRow>;
}): ReadonlyArray<DraftRow> => {
  const merged: DraftRow[] = [];
  let index = 0;

  while (index < drafts.length) {
    const newest = drafts[index];
    if (newest === undefined) {
      break;
    }
    const key = stoppedKeyOf({ draft: newest });
    if (key === null || newest.entry.kind !== 'event') {
      merged.push(newest);
      index += 1;
      continue;
    }
    const newestDayKey = newest.at === null ? null : dayKeyOf({ at: newest.at });
    let runIndex = index + 1;
    while (runIndex < drafts.length) {
      const draft = drafts[runIndex];
      const other = draft === undefined ? null : stoppedKeyOf({ draft });
      if (
        draft === undefined ||
        other === null ||
        !isSameStoppedKey({ first: key, second: other })
      ) {
        break;
      }
      const draftDayKey = draft.at === null ? null : dayKeyOf({ at: draft.at });
      if (draftDayKey !== newestDayKey) {
        break;
      }
      runIndex += 1;
    }
    const count = runIndex - index;
    merged.push(
      count === 1 ? newest : { ...newest, entry: { ...newest.entry, repeatCount: count } },
    );
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

const isArtifactShown = ({
  entry,
  context,
}: {
  readonly entry: TimelineArtifactEntry;
  readonly context: EmitContext;
}): boolean => (entry.artifact.kind === 'report' ? context.showReports : context.showWireframes);

const stepAgentsOf = ({ entry }: { readonly entry: TimelineRunEntry }): ReadonlyArray<Agent> =>
  entry.children.flatMap((child) => (child.kind === 'agent' ? [child.agent] : []));

const SKIPPED_UNDER_CLOSED: RowState = { phase: 'skipped', reason: { kind: 'skipped' }, ask: null };

const NO_QUESTION_ROWS: ReadonlySet<string> = new Set();

const NO_RESOLVE_FACTS: ReadonlyMap<string, ResolveActivityFacts> = new Map();

const NO_RESOLVE_BATCHES: ReadonlyMap<string, ResolveBatchRef> = new Map();

const NO_FACTS: ResolveActivityFacts = { state: 'new', word: '' };

const NO_OUTPUTS: ReadonlyArray<TimelineOutputEntry> = [];

const NO_OUTPUTS_BY_AGENT: ReadonlyMap<string, ReadonlyArray<TimelineOutputEntry>> = new Map();

const isOutputEntry = (entry: TimelineTopLevelEntry): entry is TimelineOutputEntry =>
  entry.kind === 'plan' || entry.kind === 'artifact' || entry.kind === 'learning';

const outputsByAgentEntryIdOf = ({
  entries,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
}): ReadonlyMap<string, ReadonlyArray<TimelineOutputEntry>> => {
  const grouped = new Map<string, Array<TimelineOutputEntry>>();
  for (const entry of entries) {
    if (!isOutputEntry(entry) || entry.launchEntryId === undefined) {
      continue;
    }
    grouped.set(entry.launchEntryId, [...(grouped.get(entry.launchEntryId) ?? []), entry]);
  }
  return grouped.size === 0 ? NO_OUTPUTS_BY_AGENT : grouped;
};

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
  readonly outputsByAgentEntryId: ReadonlyMap<string, ReadonlyArray<TimelineOutputEntry>>;
  readonly expandedGroupIds: ReadonlySet<string>;
  readonly fullGroupIds: ReadonlySet<string>;
  readonly mores: Array<{ readonly anchorRowId: string; readonly more: DraftMore }>;
  readonly counts: Array<{ readonly count: DraftCount; readonly originRowId: string }>;
  readonly direction: RailGroupDirection;
  readonly foldsFinished: boolean;
  readonly laneFacts: ReadonlyMap<string, LaneFacts>;
  readonly runFoldById: ReadonlyMap<string, RunFold>;
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
};

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

const withSlot = ({
  rows,
  slot,
}: {
  readonly rows: ReadonlyArray<DraftRow>;
  readonly slot: TimelineExplodeSlot;
}): ReadonlyArray<DraftRow> =>
  rows.map((row) => (row.explode === undefined ? { ...row, explode: slot } : row));

type BranchFold = {
  readonly expandId: string;
  readonly isExpanded: boolean;
};

const hasOpenAsk = ({ entry }: { readonly entry: TimelineAgentEntry }): boolean =>
  (entry.openQuestions.length > 0 && !isQuestionDelegate({ agent: entry.agent })) ||
  entry.children.some((child) => hasOpenAsk({ entry: child }));

const isBranchSettled = ({ entry }: { readonly entry: TimelineAgentEntry }): boolean =>
  isTreeSettled({ entry }) && !hasOpenAsk({ entry });

const subagentsFoldOf = ({
  entry,
  lane,
  context,
}: {
  readonly entry: TimelineAgentEntry;
  readonly lane: LaneFacts;
  readonly context: EmitContext;
}): BranchFold | null => {
  if (
    !context.foldsFinished ||
    entry.children.length === 0 ||
    lane.hasOpen ||
    !isBranchSettled({ entry })
  ) {
    return null;
  }
  const expandId = subagentsExpandId({ parentId: entry.id });
  return { expandId, isExpanded: context.expandedGroupIds.has(expandId) };
};

const outputsFoldOf = ({
  entry,
  context,
}: {
  readonly entry: TimelineAgentEntry;
  readonly context: EmitContext;
}): BranchFold | null => {
  if (!context.foldsFinished || !isAgentSettled({ agent: entry.agent })) {
    return null;
  }
  const expandId = outputsExpandId({ parentId: entry.id });
  return { expandId, isExpanded: context.expandedGroupIds.has(expandId) };
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
  const branches: TimelineRowBranch[] = [];
  const hasSubagents = showSubagents && entry.children.length > 0;
  const subagentsFold = hasSubagents
    ? subagentsFoldOf({
        entry,
        lane: context.laneFacts.get(entry.id) ?? NO_LANE_FACTS,
        context,
      })
    : null;
  const isSubagentsOpen = hasSubagents && (subagentsFold === null || subagentsFold.isExpanded);
  if (hasSubagents) {
    context.groups.push({
      id: childLaneId,
      parentGroupId: groupId,
      direction: context.direction,
      identityIndex: identity?.index ?? null,
      isMuted,
      originRowId: entry.id,
      shape:
        context.direction === 'up' && groupId === null && !isBranchSettled({ entry })
          ? 'open'
          : 'merged',
    });
  }
  if (isSubagentsOpen) {
    const childRows = entry.children.flatMap((child) =>
      agentRows({
        entry: child,
        grade: 'step',
        identity,
        isMuted,
        familyId,
        groupId: childLaneId,
        showSubagents,
        readyAgentId: null,
        isParentClosed: isChildParentClosed,
        context,
      }),
    );
    nested.push(
      ...(subagentsFold === null
        ? childRows
        : withSlot({
            rows: childRows,
            slot: { groupId: subagentsFold.expandId, kind: 'subagents' },
          })),
    );
  }
  const facts: ReadonlyArray<SubagentFact> = hasSubagents
    ? entry.children.map((child) => ({
        state: entryRowStateOf({
          entry: child,
          readyAgentId: null,
          isParentClosed: isChildParentClosed,
          context,
        }).rowState,
        isAsking: child.openQuestions.length > 0 && !isQuestionDelegate({ agent: child.agent }),
      }))
    : [];
  if (subagentsFold !== null) {
    const lane = context.laneFacts.get(entry.id) ?? NO_LANE_FACTS;
    context.counts.push({
      originRowId: entry.id,
      count: {
        kind: 'count',
        id: countRowIdOf({ expandId: subagentsFold.expandId }),
        familyId,
        branchKind: 'subagents',
        identityIndex: identity?.index ?? null,
        groupId: childLaneId,
        expandId: subagentsFold.expandId,
        isExpanded: subagentsFold.isExpanded,
        summary: subagentsCountSummary({ facts, answered: lane.answered }),
      },
    });
    branches.push(subagentsFold);
  }
  const outputEntries = context.outputsByAgentEntryId.get(entry.id) ?? NO_OUTPUTS;
  const outputsFold = outputEntries.length > 0 ? outputsFoldOf({ entry, context }) : null;
  if (outputEntries.length > 0) {
    const outputsLaneId = outputsLaneIdOf({ entryId: entry.id });
    const isOutputsOpen = outputsFold === null || outputsFold.isExpanded;
    context.groups.push({
      id: outputsLaneId,
      parentGroupId: groupId,
      direction: context.direction,
      identityIndex: identity?.index ?? null,
      isMuted,
      originRowId: entry.id,
      shape: 'merged',
    });
    if (isOutputsOpen) {
      const outputRows = outputEntries.map((output): DraftRow => ({
        kind: 'row',
        id: output.id,
        at: output.at,
        grade: output.kind === 'learning' ? 'fact' : 'step',
        entry: output,
        identity,
        familyId,
        groupId: outputsLaneId,
        ordinal: null,
        sortOrdinal: 0,
        rowState: DONE_ROW_STATE,
        hasUnread: false,
        isPending: false,
      }));
      nested.push(
        ...(outputsFold === null
          ? outputRows
          : withSlot({
              rows: outputRows,
              slot: { groupId: outputsFold.expandId, kind: 'outputs' },
            })),
      );
    }
    if (outputsFold !== null) {
      context.counts.push({
        originRowId: entry.id,
        count: {
          kind: 'count',
          id: countRowIdOf({ expandId: outputsFold.expandId }),
          familyId,
          branchKind: 'outputs',
          identityIndex: identity?.index ?? null,
          groupId: outputsLaneId,
          expandId: outputsFold.expandId,
          isExpanded: outputsFold.isExpanded,
          summary: countGroupSummary({
            count: outputEntries.length,
            one: 'output',
            many: 'outputs',
          }),
        },
      });
      branches.push(outputsFold);
    }
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
      ((!showSubagents || (subagentsFold !== null && !isSubagentsOpen)) &&
        hasUnreadDescendant({ entry, unreadAgentIds: context.unreadAgentIds })),
    isPending,
    ...(branches.length === 0 ? {} : { branches }),
    ...(facts.some((fact) => isSubagentAttention({ fact })) ? { hasSubagentAttention: true } : {}),
  };
  return [...nested, origin];
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

const runLaneShape = ({
  isFinished,
  rowState,
  hasLiveWork,
}: {
  readonly isFinished: boolean;
  readonly rowState: RowState;
  readonly hasLiveWork: boolean;
}): RailGroupShape => {
  if (isFinished || rowState.reason?.kind === 'closed') {
    return 'merged';
  }
  const isHalted = rowState.phase === 'failed' || rowState.phase === 'closed';
  return isHalted && !hasLiveWork ? 'merged' : 'open';
};

const runRows = ({ entry, context }: EmitRunParams): ReadonlyArray<DraftRow> => {
  const laneId = laneIdOf({ entryId: entry.id });
  const isMuted = entry.run.discardedAt != null;
  const { isFinished, readyStep, steps, hasRunningStep, isDeciding, failedStep, rowState } =
    runStateOf({ entry, context });
  const fold = context.runFoldById.get(entry.id) ?? null;
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
    ...(fold === null
      ? {}
      : { branches: [{ expandId: fold.expandId, isExpanded: fold.isExpanded }] }),
  };
  context.groups.push({
    id: laneId,
    parentGroupId: null,
    direction: context.direction,
    identityIndex: entry.identity.index,
    isMuted,
    originRowId: entry.id,
    shape:
      context.direction === 'up'
        ? runLaneShape({ isFinished, rowState, hasLiveWork: hasRunningStep || isDeciding })
        : 'merged',
  });
  if (fold !== null) {
    context.counts.push({
      originRowId: entry.id,
      count: {
        kind: 'count',
        id: countRowIdOf({ expandId: fold.expandId }),
        familyId: entry.id,
        branchKind: 'steps',
        identityIndex: entry.identity.index,
        groupId: laneId,
        expandId: fold.expandId,
        isExpanded: fold.isExpanded,
        summary: fold.summary,
      },
    });
    if (!fold.isExpanded) {
      return [origin];
    }
  }
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
  return [
    ...(fold === null
      ? nested
      : withSlot({ rows: nested, slot: { groupId: fold.expandId, kind: 'steps' } })),
    origin,
  ];
};

type LaneFacts = {
  readonly rows: number;
  readonly answered: number;
  readonly hasOpen: boolean;
  readonly contextTotals: DecisionTotals;
};

const NO_LANE_FACTS: LaneFacts = { rows: 0, answered: 0, hasOpen: false, contextTotals: {} };

const NO_LANES: ReadonlyMap<string, LaneFacts> = new Map();

const NO_RUN_FOLDS: ReadonlyMap<string, RunFold> = new Map();

const laneRootOf = ({ entry }: { readonly entry: TimelineTopLevelEntry }): string | null => {
  if (entry.kind === 'question') {
    return entry.lane?.rootEntryId ?? null;
  }
  if (
    entry.kind === 'plan' ||
    entry.kind === 'artifact' ||
    entry.kind === 'event' ||
    entry.kind === 'learning'
  ) {
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
  if (entry.kind === 'event') {
    return !isEmptyDecisionDiff({ payload: entry.event.payload });
  }
  return entry.kind === 'learning';
};

const contextPayloadOf = ({
  entry,
}: {
  readonly entry: TimelineTopLevelEntry;
}): SessionEventPayload | null => {
  if (entry.kind === 'learning') {
    return { added: 1 };
  }
  return entry.kind === 'event' && entry.event.kind === 'decisions_changed'
    ? entry.event.payload
    : null;
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
      contextTotals: addDecisionTotals({
        totals: current.contextTotals,
        payload: contextPayloadOf({ entry }),
      }),
    });
  }
  return facts;
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

type RunFold = BranchFold & {
  readonly summary: GroupSummary;
};

const runFoldOf = ({
  entry,
  lane,
  context,
}: {
  readonly entry: TimelineRunEntry;
  readonly lane: LaneFacts;
  readonly context: EmitContext;
}): RunFold | null => {
  if (!context.foldsFinished || lane.hasOpen) {
    return null;
  }
  const { isFinished, rowState } = runStateOf({ entry, context });
  if (!isFinished || rowState.ask != null || rowState.phase === 'failed') {
    return null;
  }
  const rows =
    entry.children.filter((child) => isRunChildShown({ child, context })).length + lane.rows;
  if (rows === 0) {
    return null;
  }
  const steps = stepAgentsOf({ entry }).filter(
    (agent) => agent.status !== 'pending' && agent.status !== 'skipped',
  ).length;
  return {
    expandId: entry.id,
    isExpanded: context.expandedGroupIds.has(entry.id),
    summary: stepsGroupSummary({
      kind: 'run',
      steps,
      answered: lane.answered,
      contextText: decisionCountsText({ payload: lane.contextTotals }),
    }),
  };
};

const isTreeSettled = ({ entry }: { readonly entry: TimelineAgentEntry }): boolean =>
  isAgentSettled({ agent: entry.agent }) &&
  entry.children.every((child) => isTreeSettled({ entry: child }));

type LaneRoot = {
  readonly isOpen: boolean;
  readonly slot: TimelineExplodeSlot | null;
};

const OPEN_LANE: LaneRoot = { isOpen: true, slot: null };

const laneRootsOf = ({
  entries,
  context,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly context: EmitContext;
}): ReadonlyMap<string, LaneRoot> => {
  const roots = new Map<string, LaneRoot>();
  for (const entry of entries) {
    if (entry.kind === 'run') {
      const fold = context.runFoldById.get(entry.id);
      roots.set(
        entry.id,
        fold === undefined
          ? OPEN_LANE
          : { isOpen: fold.isExpanded, slot: { groupId: fold.expandId, kind: 'steps' } },
      );
      continue;
    }
    if (entry.kind === 'agent' && entry.chain != null) {
      const fold = subagentsFoldOf({
        entry,
        lane: context.laneFacts.get(entry.id) ?? NO_LANE_FACTS,
        context,
      });
      roots.set(
        entry.id,
        fold === null
          ? OPEN_LANE
          : { isOpen: fold.isExpanded, slot: { groupId: fold.expandId, kind: 'subagents' } },
      );
    }
  }
  return roots;
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
      return isBranchSettled({ entry }) ? [] : [subagentsExpandId({ parentId: entry.id })];
    }
    return [];
  });

const runFoldsOf = ({
  entries,
  context,
}: {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly context: EmitContext;
}): ReadonlyMap<string, RunFold> => {
  const folds = new Map<string, RunFold>();
  for (const entry of entries) {
    if (entry.kind !== 'run') {
      continue;
    }
    const fold = runFoldOf({
      entry,
      lane: context.laneFacts.get(entry.id) ?? NO_LANE_FACTS,
      context,
    });
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
    return entry.questions.some((question) => question.status === 'open') ? 'step' : 'fact';
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

type DraftGroupsParams = {
  readonly drafts: ReadonlyArray<DraftRow>;
  readonly groups: ReadonlyArray<RailGroupInput>;
};

const compareOldestFirst = ({
  first,
  second,
}: {
  readonly first: Sortable;
  readonly second: Sortable;
}): number => {
  if (first.at != null && second.at != null && first.at !== second.at) {
    return first.at.localeCompare(second.at);
  }
  if (first.at == null && second.at != null) {
    return 1;
  }
  if (first.at != null && second.at == null) {
    return -1;
  }
  return first.sortOrdinal - second.sortOrdinal || first.id.localeCompare(second.id);
};

const downGroupsOf = ({
  groups,
}: {
  readonly groups: ReadonlyArray<RailGroupInput>;
}): ReadonlyArray<RailGroupInput> => groups.filter((group) => group.direction === 'down');

const withExecutionOrder = ({
  drafts: input,
  groups,
}: DraftGroupsParams): ReadonlyArray<DraftRow> => {
  const down = downGroupsOf({ groups });
  if (down.length === 0) {
    return input;
  }
  const downIds = new Set(down.map((group) => group.id));
  const drafts = input.map((draft) =>
    draft.groupId != null && downIds.has(draft.groupId) && isPendingStep({ draft })
      ? { ...draft, at: null }
      : draft,
  );
  const draftById = new Map(drafts.map((draft) => [draft.id, draft]));
  const membersByGroupId = new Map<string, DraftRow[]>();
  for (const draft of drafts) {
    if (draft.groupId == null || !downIds.has(draft.groupId)) {
      continue;
    }
    membersByGroupId.set(draft.groupId, [...(membersByGroupId.get(draft.groupId) ?? []), draft]);
  }
  const groupsByOriginId = new Map<string, RailGroupInput[]>();
  for (const group of down) {
    groupsByOriginId.set(group.originRowId, [
      ...(groupsByOriginId.get(group.originRowId) ?? []),
      group,
    ]);
  }
  const placed = new Set<string>();
  const expand = ({ row }: { readonly row: DraftRow }): ReadonlyArray<DraftRow> => {
    placed.add(row.id);
    const rows: DraftRow[] = [row];
    for (const group of groupsByOriginId.get(row.id) ?? []) {
      const members = (membersByGroupId.get(group.id) ?? [])
        .filter((member) => !placed.has(member.id))
        .sort((first, second) => compareOldestFirst({ first, second }));
      for (const member of members) {
        rows.push(...expand({ row: member }));
      }
    }
    return rows;
  };
  const blockOf = new Map<string, ReadonlyArray<DraftRow>>();
  for (const group of down) {
    const origin = draftById.get(group.originRowId);
    if (origin === undefined || blockOf.has(origin.id)) {
      continue;
    }
    const isRoot =
      origin.groupId == null || !downIds.has(origin.groupId) || origin.groupId === group.id;
    if (isRoot) {
      blockOf.set(origin.id, expand({ row: origin }));
    }
  }
  const ordered: DraftRow[] = [];
  for (const draft of drafts) {
    const block = blockOf.get(draft.id);
    if (block !== undefined) {
      ordered.push(...block);
      continue;
    }
    if (!placed.has(draft.id)) {
      ordered.push(draft);
    }
  }
  return ordered;
};

const withPendingAtFamilyHead = ({
  drafts,
  groups,
}: DraftGroupsParams): ReadonlyArray<DraftRow> => {
  const downIds = new Set(downGroupsOf({ groups }).map((group) => group.id));
  const pendingByFamilyId = new Map<string, DraftRow[]>();
  const unanchored: DraftRow[] = [];
  for (const draft of drafts) {
    if (
      !isPendingStep({ draft }) ||
      draft.familyId == null ||
      draft.familyId === draft.id ||
      (draft.groupId != null && downIds.has(draft.groupId))
    ) {
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

const groupDepthOf = ({
  groupId,
  groupById,
}: {
  readonly groupId: string;
  readonly groupById: ReadonlyMap<string, RailGroupInput>;
}): number => {
  let depth = 0;
  let current = groupById.get(groupId);
  while (current?.parentGroupId != null && depth < groupById.size) {
    depth += 1;
    current = groupById.get(current.parentGroupId);
  }
  return depth;
};

const withMembersAboveOrigin = ({
  drafts: input,
  groups,
}: DraftGroupsParams): ReadonlyArray<DraftRow> => {
  const upGroups = groups.filter((group) => group.direction === 'up');
  if (upGroups.length === 0) {
    return input;
  }
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const byDepth = [...upGroups].sort(
    (first, second) =>
      groupDepthOf({ groupId: first.id, groupById }) -
      groupDepthOf({ groupId: second.id, groupById }),
  );
  let drafts = input;
  for (const group of byDepth) {
    const originIndex = drafts.findIndex((draft) => draft.id === group.originRowId);
    if (originIndex === -1) {
      continue;
    }
    const below = drafts.filter(
      (draft, index) => index > originIndex && draft.groupId === group.id,
    );
    if (below.length === 0) {
      continue;
    }
    const strays = new Set(below.map((draft) => draft.id));
    drafts = [
      ...drafts.slice(0, originIndex),
      ...below,
      ...drafts.slice(originIndex).filter((draft) => !strays.has(draft.id)),
    ];
  }
  return drafts;
};

const withBatchChildren = ({
  drafts,
  childrenByHeaderId,
}: {
  readonly drafts: ReadonlyArray<DraftRow>;
  readonly childrenByHeaderId: ReadonlyMap<string, ReadonlyArray<DraftRow>>;
}): ReadonlyArray<DraftRow> => {
  if (childrenByHeaderId.size === 0) {
    return drafts;
  }
  return drafts.flatMap((draft) => [...(childrenByHeaderId.get(draft.id) ?? []), draft]);
};

const withCountRows = ({
  drafts,
  counts,
  groups,
}: {
  readonly drafts: ReadonlyArray<Draft>;
  readonly counts: EmitContext['counts'];
  readonly groups: ReadonlyArray<RailGroupInput>;
}): ReadonlyArray<Draft> => {
  if (counts.length === 0) {
    return drafts;
  }
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const isInSubtree = ({
    groupId,
    rootId,
  }: {
    readonly groupId: string;
    readonly rootId: string;
  }) => {
    let current = groupById.get(groupId);
    let hops = 0;
    while (current !== undefined && hops <= groupById.size) {
      if (current.id === rootId) {
        return true;
      }
      current = current.parentGroupId === null ? undefined : groupById.get(current.parentGroupId);
      hops += 1;
    }
    return false;
  };
  const deepestFirst = [...counts].sort(
    (first, second) =>
      groupDepthOf({ groupId: second.count.groupId, groupById }) -
      groupDepthOf({ groupId: first.count.groupId, groupById }),
  );
  let placed: ReadonlyArray<Draft> = drafts;
  for (const { count, originRowId } of deepestFirst) {
    const topIndex = placed.findIndex(
      (draft) =>
        (draft.kind === 'row' || draft.kind === 'count') &&
        draft.groupId !== null &&
        isInSubtree({ groupId: draft.groupId, rootId: count.groupId }),
    );
    const anchorIndex =
      topIndex === -1 ? placed.findIndex((draft) => draft.id === originRowId) : topIndex;
    if (anchorIndex === -1) {
      continue;
    }
    placed = [...placed.slice(0, anchorIndex), count, ...placed.slice(anchorIndex)];
  }
  return placed;
};

type DayBreakParams = {
  readonly drafts: ReadonlyArray<Draft>;
  readonly dayLabelFor: (params: { readonly at: string }) => string | null;
};

const withDayBreaks = ({ drafts, dayLabelFor }: DayBreakParams): ReadonlyArray<Draft> => {
  const dated: Draft[] = [];
  let previousDayKey: string | null = null;

  for (const draft of drafts) {
    const at = draft.kind === 'row' ? draft.at : null;
    if (at == null) {
      dated.push(draft);
      continue;
    }
    const dayKey = dayKeyOf({ at });
    const label = dayLabelFor({ at });
    if (dayKey !== previousDayKey && label != null) {
      let ruleIndex = dated.length;
      while (ruleIndex > 0 && dated[ruleIndex - 1]?.kind === 'count') {
        ruleIndex -= 1;
      }
      dated.splice(ruleIndex, 0, { kind: 'day', id: `day:${dayKey}`, label });
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
    if (draft.kind === 'count') {
      const countGap: TimelineGap =
        previous == null || previous.kind === 'day'
          ? 'none'
          : familyId != null && previous.familyId === familyId
            ? 'sibling'
            : 'entry';
      items.push({
        kind: 'count',
        id: draft.id,
        familyId,
        branchKind: draft.branchKind,
        identityIndex: draft.identityIndex,
        expandId: draft.expandId,
        isExpanded: draft.isExpanded,
        summary: draft.summary,
        height: rowBoxHeight({ grade: 'count', gap: countGap }),
        topY: 0,
        markerY: markerCenterY({ grade: 'count', gap: countGap }),
        groupId: draft.groupId,
        isPending: false,
        gap: countGap,
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
      rowState: draft.rowState,
      hasUnread: draft.hasUnread,
      height: rowBoxHeight({ grade: draft.grade, gap }),
      topY: 0,
      markerY: markerCenterY({ grade: draft.grade, gap }),
      groupId: draft.groupId,
      isPending: draft.isPending,
      gap,
      ...(draft.explode === undefined ? {} : { explode: draft.explode }),
      ...(draft.branches === undefined ? {} : { branches: draft.branches }),
      ...(draft.hasSubagentAttention === undefined ? {} : { hasSubagentAttention: true }),
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
  const isLive = batch.children.some((child) => !isAgentSettled({ agent: child.agent }));
  const isOpen = isLive || batch.isExpanded;
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
    ...(isLive ? {} : { branches: [{ expandId: batch.id, isExpanded: batch.isExpanded }] }),
  };
  context.groups.push({
    id: laneId,
    parentGroupId: null,
    direction: context.direction,
    identityIndex: identity.index,
    isMuted: false,
    originRowId: batch.id,
    shape: isLive ? 'open' : 'merged',
  });
  const slot: TimelineExplodeSlot = { groupId: batch.id, kind: 'batch' };
  const files = resolveBatchFiles({
    batchEntryId: batch.id,
    prNumber: batch.prNumber,
    at: batch.at,
    members: batch.children.map((child, index) => ({
      entry: child,
      facts: batch.facts[index] ?? NO_FACTS,
    })),
  });
  if (!isLive) {
    context.counts.push({
      originRowId: batch.id,
      count: {
        kind: 'count',
        id: countRowIdOf({ expandId: batch.id }),
        familyId: batch.id,
        branchKind: 'batch',
        identityIndex: identity.index,
        groupId: laneId,
        expandId: batch.id,
        isExpanded: batch.isExpanded,
        summary: countGroupSummary({ count: files.length, one: 'file', many: 'files' }),
      },
    });
  }
  if (!isOpen) {
    return { header, children: [] };
  }
  const hiddenCount = context.fullGroupIds.has(batch.id)
    ? 0
    : Math.max(0, files.length - GROUP_VISIBLE_CHILDREN);
  const fileRows = files.slice(0, files.length - hiddenCount).map((file, index): DraftRow => ({
    kind: 'row',
    id: file.id,
    at: null,
    grade: 'step',
    entry: file,
    identity,
    familyId: batch.id,
    groupId: laneId,
    ordinal: null,
    sortOrdinal: index,
    rowState: resolverRowState({ facts: { state: file.state, word: file.word } }),
    hasUnread: false,
    isPending: false,
    ...(isLive ? {} : { explode: slot }),
  }));
  const open = resolveBatchOpen({ batchEntryId: batch.id, prNumber: batch.prNumber, at: batch.at });
  const openRow: DraftRow = {
    kind: 'row',
    id: open.id,
    at: null,
    grade: 'step',
    entry: open,
    identity,
    familyId: batch.id,
    groupId: laneId,
    ordinal: null,
    sortOrdinal: files.length + 1,
    rowState: DONE_ROW_STATE,
    hasUnread: false,
    isPending: false,
    ...(isLive ? {} : { explode: slot }),
  };
  if (hiddenCount > 0) {
    context.mores.push({
      anchorRowId: open.id,
      more: {
        kind: 'more',
        id: `more:${batch.id}`,
        familyId: batch.id,
        groupId: laneId,
        hiddenCount,
        explode: slot,
      },
    });
  }
  return { header, children: [...fileRows, openRow] };
};

export const buildTimelineStream = ({
  entries,
  unreadAgentIds,
  advanceByRunId,
  decidingRunIds,
  dayLabelFor,
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
    showWorkflowSubagents: true,
    showAgentSubagents: true,
    showPlans: true,
    showReports: true,
    showWireframes: true,
    showQuestions,
    questionRowIds: showQuestions ? openQuestionRowIds({ entries }) : NO_QUESTION_ROWS,
    resolveFactsByAgentId,
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
  const grouped = groupResolveBatches({
    entries,
    batchByAgentId: resolveBatchByAgentId,
    factsByAgentId: resolveFactsByAgentId,
    expandedBatchIds: expandedGroupIds,
  });
  const withFacts: EmitContext = foldsFinished
    ? { ...base, laneFacts: laneFactsByRootId({ entries: grouped.remaining, context: base }) }
    : base;
  const context: EmitContext = {
    ...withFacts,
    runFoldById: runFoldsOf({ entries: grouped.remaining, context: withFacts }),
  };
  const laneRoots = laneRootsOf({ entries: grouped.remaining, context });
  const childrenByHeaderId = new Map<string, ReadonlyArray<DraftRow>>();
  for (const batch of grouped.batches) {
    const { header, children } = batchRows({ batch, context, unreadAgentIds });
    rows.push(header);
    childrenByHeaderId.set(header.id, children);
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
  const merged = mergeConsecutiveStoppedRows({
    drafts: mergeConsecutiveProjectRows({
      drafts: mergeConsecutiveDecisionRows({ drafts: sorted }).filter(
        (draft) => !isEmptyDecisionRow({ draft }),
      ),
    }),
  });
  const ordered = withBatchChildren({
    drafts: withMembersAboveOrigin({
      drafts: withPendingAtFamilyHead({ drafts: merged, groups: context.groups }),
      groups: context.groups,
    }),
    childrenByHeaderId,
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
    items: streamItemsOf({
      drafts: withPendingAtFamilyHead({
        drafts: withExecutionOrder({ drafts: sorted, groups: context.groups }),
        groups: context.groups,
      }),
    }).filter((item) => item.kind !== 'now'),
    groups: context.groups,
  };
};
