import { isAgentSettled } from '@goodboy/core';
import type { AgentId } from '@goodboy/types';
import { isQuestionDelegate } from '../../../context/questionDelegate';
import { AGENT_KIND_META, type AgentKind } from '../../../session/agent-kind';
import type { TimelineAgentEntry } from '../../../session/timeline/buildTimelineGroups';
import {
  countRowIdOf,
  type TimelineCountItem,
  type TimelineRowItem,
  type TimelineStreamItem,
} from '../../../session/timeline/buildTimelineStream';
import {
  subagentsCountSummary,
  subagentsExpandId,
  type SubagentSummary,
} from '../../../session/timeline/subagentSummary';
import type { RailGroupInput } from '../../../workTreeModel/railGeometry';
import type { RowPhase } from '../../../workTreeModel/rowState';
import { markerCenterY, rowBoxHeight } from '../../../workTreeModel/timelineRhythm';

type AgentItem = TimelineRowItem & { readonly entry: TimelineAgentEntry };

type SettledSet = {
  readonly id: string;
  readonly parent: AgentItem;
  readonly children: ReadonlyArray<AgentItem>;
};

type Params = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly groups: ReadonlyArray<RailGroupInput>;
  readonly openIds: ReadonlySet<string>;
};

export type FoldedSets = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly groups: ReadonlyArray<RailGroupInput>;
  readonly liveSetIds: ReadonlyArray<string>;
  readonly childIdsBySetId: ReadonlyMap<string, ReadonlyArray<AgentId>>;
};

const LIVE_PHASES: ReadonlySet<RowPhase> = new Set<RowPhase>([
  'queued',
  'running',
  'waiting',
  'failed',
]);

const isAgentItem = (item: TimelineStreamItem): item is AgentItem =>
  item.kind === 'row' && item.entry.kind === 'agent';

const hasOpenAsk = ({ entry }: { readonly entry: TimelineAgentEntry }): boolean =>
  entry.openQuestions.length > 0 && !isQuestionDelegate({ agent: entry.agent });

const isItemSettled = ({ item }: { readonly item: AgentItem }): boolean =>
  isAgentSettled({ agent: item.entry.agent }) &&
  !hasOpenAsk({ entry: item.entry }) &&
  !LIVE_PHASES.has(item.rowState.phase);

const setsOf = ({
  items,
}: {
  readonly items: ReadonlyArray<TimelineStreamItem>;
}): ReadonlyMap<string, SettledSet> => {
  const agentItems = items.filter(isAgentItem);
  const itemByAgentId = new Map<string, AgentItem>(
    agentItems.map((item) => [item.entry.agent.id, item]),
  );
  const childrenByParentId = new Map<string, AgentItem[]>();
  for (const item of agentItems) {
    const parentAgentId = item.entry.agent.parentAgentId;
    const parent = parentAgentId == null ? undefined : itemByAgentId.get(parentAgentId);
    if (parent === undefined) {
      continue;
    }
    childrenByParentId.set(parent.id, [...(childrenByParentId.get(parent.id) ?? []), item]);
  }
  const sets = new Map<string, SettledSet>();
  for (const parent of agentItems) {
    const children = childrenByParentId.get(parent.id);
    if (children === undefined) {
      continue;
    }
    const id = subagentsExpandId({ parentId: parent.id });
    sets.set(id, { id, parent, children });
  }
  return sets;
};

const isSetSettled = ({
  set,
  sets,
  visiting = new Set<string>(),
}: {
  readonly set: SettledSet;
  readonly sets: ReadonlyMap<string, SettledSet>;
  readonly visiting?: ReadonlySet<string>;
}): boolean => {
  if (visiting.has(set.id)) {
    return true;
  }
  const inside = new Set(visiting).add(set.id);
  return set.children.every((child) => {
    if (!isItemSettled({ item: child })) {
      return false;
    }
    const nested = sets.get(subagentsExpandId({ parentId: child.id }));
    return nested === undefined || isSetSettled({ set: nested, sets, visiting: inside });
  });
};

const sharedKind = ({
  children,
}: {
  readonly children: ReadonlyArray<AgentItem>;
}): AgentKind | null => {
  const [first] = children;
  if (first === undefined) {
    return null;
  }
  const kind = first.entry.agentKind;
  return children.every((child) => child.entry.agentKind === kind) ? kind : null;
};

const summaryOf = ({ set }: { readonly set: SettledSet }): SubagentSummary => {
  const base = subagentsCountSummary({
    facts: set.children.map((child) => ({
      state: child.rowState,
      isAsking: hasOpenAsk({ entry: child.entry }),
    })),
    answered: 0,
  });
  const kind = sharedKind({ children: set.children });
  const parts = base.parts.map((part) =>
    part.state === 'total' && part.count > 1 && kind !== null && kind !== 'generic'
      ? { ...part, noun: AGENT_KIND_META[kind].pluralLabel }
      : part,
  );
  if (parts.length > 1) {
    return { ...base, parts };
  }
  return {
    ...base,
    parts: [
      ...parts,
      {
        state: 'done',
        tone: 'success',
        count: set.children.length,
        noun: 'done',
        isFailure: false,
        text: 'done',
      },
    ],
  };
};

const foldItemOf = ({
  set,
  isExpanded,
}: {
  readonly set: SettledSet;
  readonly isExpanded: boolean;
}): TimelineCountItem => {
  const { parent } = set;
  const gap = parent.familyId === null ? 'entry' : 'sibling';
  return {
    kind: 'count',
    id: countRowIdOf({ expandId: set.id }),
    familyId: parent.familyId,
    branchKind: 'subagents',
    identityIndex: parent.identity?.index ?? null,
    expandId: set.id,
    isExpanded,
    summary: summaryOf({ set }),
    height: rowBoxHeight({ grade: 'count', gap }),
    topY: 0,
    markerY: markerCenterY({ grade: 'count', gap }),
    groupId: set.children[0]?.groupId ?? null,
    isPending: false,
    gap,
  };
};

export const foldSettledSets = ({ items, groups, openIds }: Params): FoldedSets => {
  const sets = setsOf({ items });
  const settledIds = new Set<string>();
  const liveSetIds: string[] = [];
  for (const set of sets.values()) {
    if (isSetSettled({ set, sets })) {
      settledIds.add(set.id);
      continue;
    }
    liveSetIds.push(set.id);
  }
  const isFolded = ({ id }: { readonly id: string }): boolean =>
    settledIds.has(id) && !openIds.has(id);
  const hiddenIds = new Set<string>();
  const folded: TimelineStreamItem[] = [];
  const childIdsBySetId = new Map<string, ReadonlyArray<AgentId>>();
  const itemById = new Map(items.filter(isAgentItem).map((item) => [item.entry.agent.id, item]));
  for (const item of items) {
    if (isAgentItem(item)) {
      const parentAgentId = item.entry.agent.parentAgentId;
      const parent = parentAgentId == null ? undefined : itemById.get(parentAgentId);
      if (
        parent !== undefined &&
        (hiddenIds.has(parent.id) || isFolded({ id: subagentsExpandId({ parentId: parent.id }) }))
      ) {
        hiddenIds.add(item.id);
        continue;
      }
    }
    folded.push(item);
    if (!isAgentItem(item)) {
      continue;
    }
    const own = sets.get(subagentsExpandId({ parentId: item.id }));
    if (own === undefined || !settledIds.has(own.id)) {
      continue;
    }
    childIdsBySetId.set(
      own.id,
      own.children.map((child) => child.entry.agent.id),
    );
    folded.push(foldItemOf({ set: own, isExpanded: openIds.has(own.id) }));
  }
  return {
    items: folded,
    groups: groups.filter((group) => !hiddenIds.has(group.originRowId)),
    liveSetIds,
    childIdsBySetId,
  };
};
