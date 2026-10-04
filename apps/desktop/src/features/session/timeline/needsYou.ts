import type { TimelineTopLevelEntry } from './buildTimelineGroups';
import type { TimelineRowItem, TimelineStreamItem } from './buildTimelineStream';
import { isRowNeedingYou } from '../../workTreeModel/rowState';
import { isResolveAttention } from './resolveActivity';
import { rowStateTone } from '../../workTreeModel/rowStateCopy';

type RootsParams = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
};

const attentionChildIdsOf = ({
  entry,
}: {
  readonly entry: Extract<TimelineRowItem['entry'], { readonly kind: 'resolveBatch' }>;
}): ReadonlyArray<string> =>
  entry.children.flatMap((child, index) => {
    const facts = entry.facts[index];
    return facts !== undefined && isResolveAttention({ state: facts.state }) ? [child.id] : [];
  });

const hasHiddenAttention = ({ item }: { readonly item: TimelineRowItem }): boolean =>
  item.subagents !== undefined && item.subagents.attentionKeys.length > 0;

const isItemNeedingYou = ({ item }: { readonly item: TimelineRowItem }): boolean =>
  isRowNeedingYou({ state: item.rowState }) || hasHiddenAttention({ item });

export const needsYouRootIds = ({ items }: RootsParams): ReadonlySet<string> => {
  const roots = new Set<string>();
  for (const item of items) {
    if (item.kind !== 'row' || !isItemNeedingYou({ item })) {
      continue;
    }
    if (item.entry.kind === 'resolveBatch') {
      for (const childId of attentionChildIdsOf({ entry: item.entry })) {
        roots.add(childId);
      }
      continue;
    }
    roots.add(item.familyId ?? item.id);
  }
  return roots;
};

const needKeysOf = ({ item }: { readonly item: TimelineRowItem }): ReadonlyArray<string> => {
  const { entry, rowState } = item;
  if (entry.kind === 'resolveBatch') {
    return attentionChildIdsOf({ entry });
  }
  const hidden = hasHiddenAttention({ item }) ? (item.subagents?.attentionKeys ?? []) : [];
  if (entry.kind === 'question') {
    return entry.questions.map((question) => question.id);
  }
  if (!isRowNeedingYou({ state: rowState })) {
    return hidden;
  }
  if (rowState.ask?.kind !== 'answer' || rowState.ask.question == null) {
    return [item.id, ...hidden];
  }
  if (entry.kind === 'agent') {
    return [...entry.openQuestions.map((question) => question.id), ...hidden];
  }
  return [rowState.ask.question.id];
};

export const needsYouCount = ({ items }: RootsParams): number => {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.kind === 'row' && isItemNeedingYou({ item })) {
      for (const key of needKeysOf({ item })) {
        keys.add(key);
      }
    }
  }
  return keys.size;
};

export const hasWaitingRow = ({ items }: RootsParams): boolean =>
  items.some(
    (item) =>
      item.kind === 'row' &&
      (isItemNeedingYou({ item }) ||
        (item.rowState.phase === 'waiting' &&
          rowStateTone({ state: item.rowState }) === 'warning')),
  );

type FirstRowParams = RootsParams;

export const firstNeedsYouRowId = ({ items }: FirstRowParams): string | null =>
  items.find((item) => item.kind === 'row' && isItemNeedingYou({ item }))?.id ?? null;

type EntriesParams = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly rootIds: ReadonlySet<string>;
};

const isOpenLaneQuestion = ({
  entry,
  rootIds,
}: {
  readonly entry: TimelineTopLevelEntry;
  readonly rootIds: ReadonlySet<string>;
}): boolean =>
  entry.kind === 'question' &&
  entry.lane != null &&
  rootIds.has(entry.lane.rootEntryId) &&
  entry.questions.length > 0 &&
  entry.questions.every((question) => question.status === 'open');

export const needsYouEntries = ({
  entries,
  rootIds,
}: EntriesParams): ReadonlyArray<TimelineTopLevelEntry> =>
  entries.filter((entry) => rootIds.has(entry.id) || isOpenLaneQuestion({ entry, rootIds }));
