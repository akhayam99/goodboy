import type { Agent, OpenQuestion, TurnState } from '@goodboy/types';
import { isAgentSettled } from '@goodboy/core';
import type { WorkflowAdvanceState } from '../../../workflows/advanceGate';
import { isWorkflowRunComplete } from '../../../workflows/isWorkflowRunComplete';
import { isQuestionDelegate } from '../../../context/questionDelegate';
import { agentStateOf } from '../../../workTreeModel/agentStateOf';
import { DONE_ROW_STATE, type RowState } from '../../../workTreeModel/rowState';
import type {
  TimelineAgentEntry,
  TimelineArtifactEntry,
  TimelineQuestionEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from '../buildTimelineGroups';
import type { RailGroupDirection, RailGroupInput } from '../../../workTreeModel/railGeometry';
import type { RunIdentity } from '../runIdentity';
import type { JobActivityFacts } from '../../../../store/slices/history/jobFactsByAgentId';
import type { AutoRowFacts } from '../../../auto/autoRowFacts';
import { jobRowState } from '../jobActivity';
import { resolverRowState, type ResolveActivityFacts } from '../resolveActivity';
import { countGroupSummary } from '../groupSummary';
import {
  isSubagentAttention,
  subagentsCountSummary,
  subagentsExpandId,
  type SubagentFact,
} from '../subagentSummary';
import type { TimelineRowGrade } from '../../../workTreeModel/timelineRhythm';
import {
  outputsExpandId,
  countRowIdOf,
  type TimelineExplodeSlot,
  type TimelineOutputEntry,
  type TimelineRowBranch,
  type DraftRow,
  type DraftMore,
  type DraftCount,
} from './streamTypes';
import { laneIdOf, outputsLaneIdOf } from './ordering';
import { NO_LANE_FACTS, isTreeSettled, type LaneFacts, type RunFold } from './laneFolds';

const questionBucketOf = ({
  entry,
}: {
  readonly entry: TimelineQuestionEntry;
}): 'open' | 'consumed' =>
  entry.questions.every((question) => question.status === 'open') ? 'open' : 'consumed';

export const questionRowStateOf = ({
  entry,
}: {
  readonly entry: TimelineQuestionEntry;
}): RowState =>
  questionBucketOf({ entry }) === 'open'
    ? {
        phase: 'waiting',
        reason: { kind: 'openQuestions' },
        ask: { kind: 'answer', question: entry.questions[0] ?? null },
      }
    : DONE_ROW_STATE;

export const isArtifactShown = ({
  entry,
  context,
}: {
  readonly entry: TimelineArtifactEntry;
  readonly context: EmitContext;
}): boolean => (entry.artifact.kind === 'report' ? context.showReports : context.showWireframes);

export const stepAgentsOf = ({
  entry,
}: {
  readonly entry: TimelineRunEntry;
}): ReadonlyArray<Agent> =>
  entry.children.flatMap((child) => (child.kind === 'agent' ? [child.agent] : []));

const SKIPPED_UNDER_CLOSED: RowState = { phase: 'skipped', reason: { kind: 'skipped' }, ask: null };

export const NO_QUESTION_ROWS: ReadonlySet<string> = new Set();

export const NO_RESOLVE_FACTS: ReadonlyMap<string, ResolveActivityFacts> = new Map();

export const NO_JOB_FACTS: ReadonlyMap<string, JobActivityFacts> = new Map();

export const NO_AUTO_FACTS: ReadonlyMap<string, AutoRowFacts> = new Map();

export const NO_TURNS: ReadonlyMap<string, TurnState> = new Map();

const NO_OPEN_QUESTIONS: ReadonlyArray<OpenQuestion> = [];

const NO_OUTPUTS: ReadonlyArray<TimelineOutputEntry> = [];

export const NO_OUTPUTS_BY_AGENT: ReadonlyMap<
  string,
  ReadonlyArray<TimelineOutputEntry>
> = new Map();

export const isOutputEntry = (entry: TimelineTopLevelEntry): entry is TimelineOutputEntry =>
  entry.kind === 'plan' || entry.kind === 'artifact' || entry.kind === 'learning';

export const outputsByAgentEntryIdOf = ({
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

export const NO_EXPANDED_GROUPS: ReadonlySet<string> = new Set();

const agentRowStateOf = ({
  entry,
  readyAgentId,
  failedAgentId = null,
  questionRowIds = NO_QUESTION_ROWS,
  turn = null,
}: {
  readonly entry: TimelineAgentEntry;
  readonly readyAgentId: string | null;
  readonly failedAgentId?: string | null;
  readonly questionRowIds?: ReadonlySet<string>;
  readonly turn?: TurnState | null;
}): RowState => {
  const state = agentStateOf({
    agent: entry.agent,
    turn,
    openQuestions: isQuestionDelegate({ agent: entry.agent })
      ? NO_OPEN_QUESTIONS
      : entry.openQuestions,
    isReadyStep: readyAgentId === entry.agent.id,
    isMissingArtifact: entry.isMissingArtifact,
  }).row;
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

export const isRunFinished = ({ entry }: { readonly entry: TimelineRunEntry }): boolean => {
  if (entry.run.discardedAt != null) {
    return true;
  }
  return isWorkflowRunComplete({
    run: entry.run,
    workflow: entry.workflow,
    agents: stepAgentsOf({ entry }),
  });
};

export type ChainedRun = {
  readonly title: string;
  readonly isFinished: boolean;
};

export type EmitContext = {
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
  readonly jobFactsByAgentId: ReadonlyMap<string, JobActivityFacts>;
  readonly autoFactsByAgentId: ReadonlyMap<string, AutoRowFacts>;
  readonly turnByAgentId: ReadonlyMap<string, TurnState>;
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
  jobFacts,
  autoFacts,
  isSkippedUnderClosed,
}: {
  readonly resolved: RowState;
  readonly reviewFacts: ResolveActivityFacts | undefined;
  readonly jobFacts: JobActivityFacts | undefined;
  readonly autoFacts: AutoRowFacts | undefined;
  readonly isSkippedUnderClosed: boolean;
}): RowState => {
  if (reviewFacts !== undefined && resolved.phase !== 'closed') {
    return resolverRowState({ facts: reviewFacts });
  }
  if (jobFacts !== undefined && resolved.phase !== 'closed') {
    return jobRowState({ facts: jobFacts, resolved });
  }
  if (autoFacts !== undefined && resolved.phase !== 'closed') {
    return {
      phase: autoFacts.phase,
      reason: { kind: 'auto', word: autoFacts.word, short: autoFacts.short },
      ask: resolved.ask?.kind === 'answer' ? resolved.ask : null,
    };
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
    turn: context.turnByAgentId.get(entry.agent.id) ?? null,
  });
  const isSkippedUnderClosed = isParentClosed && resolved.phase === 'queued';
  const reviewFacts = context.resolveFactsByAgentId.get(entry.agent.id);
  const jobFacts = context.jobFactsByAgentId.get(entry.agent.id);
  const autoFacts = context.autoFactsByAgentId.get(entry.agent.id);
  return {
    rowState: rowStateOfAgentRow({
      resolved,
      reviewFacts,
      jobFacts,
      autoFacts,
      isSkippedUnderClosed,
    }),
    isSkippedUnderClosed,
  };
};

export const withSlot = ({
  rows,
  slot,
}: {
  readonly rows: ReadonlyArray<DraftRow>;
  readonly slot: TimelineExplodeSlot;
}): ReadonlyArray<DraftRow> =>
  rows.map((row) => (row.explode === undefined ? { ...row, explode: slot } : row));

export type BranchFold = {
  readonly expandId: string;
  readonly isExpanded: boolean;
};

const hasOpenAsk = ({ entry }: { readonly entry: TimelineAgentEntry }): boolean =>
  (entry.openQuestions.length > 0 && !isQuestionDelegate({ agent: entry.agent })) ||
  entry.children.some((child) => hasOpenAsk({ entry: child }));

export const isBranchSettled = ({ entry }: { readonly entry: TimelineAgentEntry }): boolean =>
  isTreeSettled({ entry }) && !hasOpenAsk({ entry });

export const subagentsFoldOf = ({
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

export const agentRows = ({
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
        agentId: child.agent.id,
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
  const ciStages = context.jobFactsByAgentId.get(entry.agent.id)?.stages;
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
    ...(ciStages === undefined ? {} : { ciStages }),
  };
  return [...nested, origin];
};
