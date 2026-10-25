import { isAgentStatusHalted } from '@goodboy/core';
import type { WorkflowAdvanceState } from '../../../workflows/advanceGate';
import {
  DONE_ROW_STATE,
  resolveRunRowState,
  type RowReadyStep,
  type RowState,
  type RowStoppedStep,
} from '../../../workTreeModel/rowState';
import type { TimelineRunEntry } from '../buildTimelineGroups';
import type { RailGroupShape } from '../../../workTreeModel/railGeometry';
import { hasShownRunQuestion, runOpenQuestion, runShownQuestionIds } from '../runOpenQuestion';
import { countRowIdOf, type DraftRow } from './streamTypes';
import { laneIdOf } from './ordering';
import {
  isArtifactShown,
  stepAgentsOf,
  isRunFinished,
  withSlot,
  agentRows,
  type EmitContext,
} from './agentRows';

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

export const runStateOf = ({ entry, context }: EmitRunParams) => {
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

export const runRows = ({ entry, context }: EmitRunParams): ReadonlyArray<DraftRow> => {
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
        ...(fold.isExpanded || fold.newestAt === null ? {} : { slotAt: fold.newestAt }),
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
