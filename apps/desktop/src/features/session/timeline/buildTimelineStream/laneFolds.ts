import { isAgentSettled } from '@goodboy/core';
import type {
  TimelineAgentEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from '../buildTimelineGroups';
import { decisionCountsText, isEmptyDecisionDiff } from '../sessionEventPresentation';
import {
  addDecisionTotals,
  answeredCountOf,
  contextPayloadOf,
  laneRootOf,
  type DecisionTotals,
} from '../laneFacts';
import { stepsGroupSummary, type GroupSummary } from '../groupSummary';
import { subagentsExpandId } from '../subagentSummary';
import type { TimelineExplodeSlot } from './streamTypes';
import {
  isArtifactShown,
  stepAgentsOf,
  isRunFinished,
  isBranchSettled,
  subagentsFoldOf,
  type EmitContext,
  type BranchFold,
} from './agentRows';
import { runStateOf } from './runRows';

export type LaneFacts = {
  readonly rows: number;
  readonly answered: number;
  readonly hasOpen: boolean;
  readonly contextTotals: DecisionTotals;
  readonly newestAt: string | null;
};

export const NO_LANE_FACTS: LaneFacts = {
  rows: 0,
  answered: 0,
  hasOpen: false,
  contextTotals: {},
  newestAt: null,
};

const newerOf = ({
  first,
  second,
}: {
  readonly first: string | null;
  readonly second: string | null;
}): string | null => {
  if (first === null) {
    return second;
  }
  if (second === null) {
    return first;
  }
  return first.localeCompare(second) >= 0 ? first : second;
};

export const NO_LANES: ReadonlyMap<string, LaneFacts> = new Map();

export const NO_RUN_FOLDS: ReadonlyMap<string, RunFold> = new Map();

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

export const laneFactsByRootId = ({
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
    const isShown = isLaneEntryShown({ entry, context });
    facts.set(root, {
      rows: current.rows + (isShown ? 1 : 0),
      newestAt: isShown ? newerOf({ first: current.newestAt, second: entry.at }) : current.newestAt,
      answered: current.answered + answeredCountOf({ entry }),
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

export type RunFold = BranchFold & {
  readonly summary: GroupSummary;
  readonly newestAt: string | null;
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
  const shownChildren = entry.children.filter((child) => isRunChildShown({ child, context }));
  const rows = shownChildren.length + lane.rows;
  if (rows === 0) {
    return null;
  }
  const newestAt = shownChildren.reduce<string | null>(
    (newest, child) => newerOf({ first: newest, second: child.at }),
    lane.newestAt,
  );
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
    newestAt,
  };
};

export const isTreeSettled = ({ entry }: { readonly entry: TimelineAgentEntry }): boolean =>
  isAgentSettled({ agent: entry.agent }) &&
  entry.children.every((child) => isTreeSettled({ entry: child }));

type LaneRoot = {
  readonly isOpen: boolean;
  readonly slot: TimelineExplodeSlot | null;
};

const OPEN_LANE: LaneRoot = { isOpen: true, slot: null };

export const laneRootsOf = ({
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

export const runFoldsOf = ({
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
