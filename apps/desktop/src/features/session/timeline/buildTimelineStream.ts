import type { Agent, OpenQuestion, SessionEventKind } from '@goodboy/types';
import { isAgentSettled } from '@goodboy/core';
import type { WorkflowAdvanceState } from '../../workflows/advanceGate';
import { isWorkflowRunComplete } from '../../workflows/isWorkflowRunComplete';
import {
  DONE_ROW_STATE,
  resolveAgentRowState,
  resolveRunRowState,
  type RowReadyStep,
  type RowState,
} from '../../workTreeModel/rowState';
import type {
  TimelineAgentEntry,
  TimelineArtifactEntry,
  TimelineBranchEntry,
  TimelineEventEntry,
  TimelineIssueEntry,
  TimelinePlanEntry,
  TimelineQuestionEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from './buildTimelineGroups';
import type { RailGroupInput, RailGroupShape } from '../../workTreeModel/railGeometry';
import type { RunIdentity } from './runIdentity';
import { oldestAgentOpenQuestion, runOpenQuestion } from './runOpenQuestion';
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
  | TimelineQuestionEntry;

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
};

export type TimelineStreamItem = TimelineNowItem | TimelineDayItem | TimelineRowItem;

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
};

type DraftDay = {
  readonly kind: 'day';
  readonly id: string;
  readonly label: string;
};

type Draft = DraftRow | DraftDay;

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

const isDecisionChangeRow = ({ draft }: { readonly draft: DraftRow }): boolean =>
  draft.groupId == null &&
  draft.entry.kind === 'event' &&
  draft.entry.event.kind === 'decisions_changed';

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

    let added = 0;
    let removed = 0;
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
      added += draft.entry.event.payload?.added ?? 0;
      removed += draft.entry.event.payload?.removed ?? 0;
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
            added,
            removed,
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
        reason: null,
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
  readonly context: EmitContext;
};

const nodeIndexOf = ({ stepLabel }: { readonly stepLabel: string | null }): string | null =>
  stepLabel == null ? null : (stepLabel.split('.').at(-1) ?? null);

const agentRows = ({
  entry,
  grade,
  identity,
  isMuted,
  familyId,
  groupId,
  showSubagents,
  readyAgentId,
  context,
}: EmitAgentParams): ReadonlyArray<DraftRow> => {
  const childLaneId = laneIdOf({ entryId: entry.id });
  const nested: DraftRow[] = [];
  if (showSubagents && entry.children.length > 0) {
    context.groups.push({
      id: childLaneId,
      parentGroupId: groupId,
      identityIndex: identity?.index ?? null,
      isMuted,
      originRowId: entry.id,
      shape: isLaneSettled({ entry }) ? 'merged' : groupId == null ? 'open' : 'rejoining',
    });
    for (const child of entry.children) {
      nested.push(
        ...agentRows({
          entry: child,
          grade: 'step',
          identity,
          isMuted,
          familyId,
          groupId: childLaneId,
          showSubagents,
          readyAgentId: null,
          context,
        }),
      );
    }
  }
  const isPending = entry.agent.status === 'pending';
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
    rowState: resolveAgentRowState({
      agent: entry.agent,
      isAsking: entry.openQuestions.length > 0,
      question: oldestAgentOpenQuestion({ entry }),
      isReadyStep: readyAgentId === entry.agent.id,
    }),
    hasUnread:
      context.unreadAgentIds.has(entry.agent.id) ||
      (!showSubagents && hasUnreadDescendant({ entry, unreadAgentIds: context.unreadAgentIds })),
    isPending,
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
    if (child.kind === 'agent' && child.agent.status === 'failed' && child.agent.doneAt == null) {
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

const runRows = ({ entry, context }: EmitRunParams): ReadonlyArray<DraftRow> => {
  const laneId = laneIdOf({ entryId: entry.id });
  const isFinished = isRunFinished({ entry });
  const advance = context.advanceByRunId.get(entry.run.id) ?? null;
  const readyStep = readyStepOf({ entry, advance });
  const isMuted = entry.run.discardedAt != null;
  const shape: RailGroupShape = isFinished ? 'merged' : 'open';
  context.groups.push({
    id: laneId,
    parentGroupId: null,
    identityIndex: entry.identity.index,
    isMuted,
    originRowId: entry.id,
    shape,
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
  const steps = stepAgentsOf({ entry });
  const rowState = resolveRunRowState({
    run: entry.run,
    advance,
    isFinished,
    isDeciding: !isFinished && context.decidingRunIds.has(entry.run.id),
    hasRunningStep: steps.some((agent) => agent.status === 'running'),
    failedStep: failedStepOf({ entry }),
    question: runOpenQuestion({ entry }),
    readyStep,
    chainedAfterTitle: chainedAfterTitleOf({ entry, context }),
  });
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
  };
  return [...nested, origin];
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
  const result: DraftRow[] = [];
  for (const draft of unanchored) {
    const familyId = draft.familyId;
    if (familyId != null) {
      const pending = pendingByFamilyId.get(familyId);
      if (pending !== undefined) {
        result.push(...pending);
        pendingByFamilyId.delete(familyId);
      }
    }
    result.push(draft);
  }
  const remaining = [...pendingByFamilyId.values()]
    .flat()
    .map((draft) => ({ ...draft, at: null }))
    .sort((first, second) => compareNewestFirst({ first, second }));
  return [...remaining, ...result];
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
}: Params): TimelineStream => {
  const chainedRunById = new Map<string, ChainedRun>();
  for (const entry of entries) {
    if (entry.kind === 'run') {
      chainedRunById.set(entry.run.id, {
        title: entry.workflow.name,
        isFinished: isRunFinished({ entry }),
      });
    }
  }
  const context: EmitContext = {
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
  };
  const rows: DraftRow[] = [];

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
          context,
        }),
      );
      continue;
    }
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
        grade: entry.lane != null ? 'step' : 'entry',
        entry,
        identity: entry.lane?.identity ?? null,
        familyId: entry.lane?.rootEntryId ?? null,
        groupId: entry.lane != null ? laneIdOf({ entryId: entry.lane.rootEntryId }) : null,
        ordinal: null,
        sortOrdinal: 0,
        rowState: questionRowStateOf({ entry }),
        hasUnread: false,
        isPending: false,
      });
      continue;
    }
    const row: DraftRow = {
      kind: 'row',
      id: entry.id,
      at: entry.at,
      grade: 'entry',
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
      drafts: mergeConsecutiveDecisionRows({ drafts: sorted }),
    }),
  });
  const withDays = withDayBreaks({
    drafts: withPendingAtFamilyHead({ drafts: merged }),
    dayLabelFor,
  });

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
  for (const draft of withDays) {
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
    const gap: TimelineGap =
      previous == null || previous.kind === 'day'
        ? 'none'
        : familyId != null && previous.familyId === familyId
          ? 'sibling'
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
      gap,
    });
    previous = draft;
  }

  return { items, groups: context.groups };
};
