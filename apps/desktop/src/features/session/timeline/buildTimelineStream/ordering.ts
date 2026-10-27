import type { SessionEventKind } from '@goodboy/types';
import type { TimelineQuestionEntry } from '../buildTimelineGroups';
import type { RailGroupInput } from '../../../workTreeModel/railGeometry';
import type { TimelineRowGrade } from '../../../workTreeModel/timelineRhythm';
import type { DraftRow, Draft } from './streamTypes';

export const eventRank = ({ kind }: { readonly kind: SessionEventKind }): number => {
  if (kind === 'worktree_created') {
    return -2;
  }
  if (kind === 'branch_created') {
    return -1;
  }
  return 0;
};

export const laneIdOf = ({ entryId }: { readonly entryId: string }): string => `lane:${entryId}`;

export const outputsLaneIdOf = ({ entryId }: { readonly entryId: string }): string =>
  `outputs-lane:${entryId}`;

export const dayKeyOf = ({ at }: { readonly at: string }): string => new Date(at).toDateString();

type Sortable = {
  readonly at: string | null;
  readonly sortOrdinal: number;
  readonly id: string;
};

export const compareNewestFirst = ({
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

export const questionGradeOf = ({
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

export const withExecutionOrder = ({
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

export const withPendingAtFamilyHead = ({
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

export const groupDepthOf = ({
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

export const withMembersAboveOrigin = ({
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

export const foldedSlotIndexOf = ({
  drafts,
  slotAt,
  originIndex,
}: {
  readonly drafts: ReadonlyArray<Draft>;
  readonly slotAt: string | undefined;
  readonly originIndex: number;
}): number => {
  if (slotAt === undefined || originIndex === -1) {
    return originIndex;
  }
  const olderIndex = drafts.findIndex(
    (draft) => draft.kind === 'row' && draft.at !== null && draft.at.localeCompare(slotAt) < 0,
  );
  return olderIndex === -1 ? originIndex : Math.min(olderIndex, originIndex);
};
