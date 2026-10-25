import type { RailGroupInput } from '../../../workTreeModel/railGeometry';
import {
  TIMELINE_RHYTHM,
  markerCenterY,
  rowBoxHeight,
  type TimelineGap,
} from '../../../workTreeModel/timelineRhythm';
import type { TimelineStreamItem, Draft } from './streamTypes';
import { dayKeyOf, groupDepthOf, foldedSlotIndexOf } from './ordering';
import type { EmitContext } from './agentRows';

export const withCountRows = ({
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
    const originIndex = placed.findIndex((draft) => draft.id === originRowId);
    const anchorIndex =
      topIndex === -1
        ? foldedSlotIndexOf({ drafts: placed, slotAt: count.slotAt, originIndex })
        : topIndex;
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

export const withDayBreaks = ({ drafts, dayLabelFor }: DayBreakParams): ReadonlyArray<Draft> => {
  const dated: Draft[] = [];
  const seenDayKeys = new Set<string>();

  for (const draft of drafts) {
    const at = draft.kind === 'row' ? draft.at : null;
    if (at == null) {
      dated.push(draft);
      continue;
    }
    const dayKey = dayKeyOf({ at });
    const label = dayLabelFor({ at });
    if (!seenDayKeys.has(dayKey) && label != null) {
      let ruleIndex = dated.length;
      while (ruleIndex > 0 && dated[ruleIndex - 1]?.kind === 'count') {
        ruleIndex -= 1;
      }
      dated.splice(ruleIndex, 0, { kind: 'day', id: `day:${dayKey}`, label });
      seenDayKeys.add(dayKey);
    }
    dated.push(draft);
  }

  return dated;
};

type MoreRowsParams = {
  readonly drafts: ReadonlyArray<Draft>;
  readonly mores: EmitContext['mores'];
};

export const withMoreRows = ({ drafts, mores }: MoreRowsParams): ReadonlyArray<Draft> => {
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

export const streamItemsOf = ({ drafts }: StreamItemsParams): ReadonlyArray<TimelineStreamItem> => {
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
      ...(draft.ciStages === undefined ? {} : { ciStages: draft.ciStages }),
    });
    previous = draft;
  }

  return items;
};
