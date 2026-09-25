import type { TimelineTopLevelEntry } from './buildTimelineGroups';
import type { TimelineStreamItem } from './buildTimelineStream';

type RootsParams = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
};

export const needsYouRootIds = ({ items }: RootsParams): ReadonlySet<string> => {
  const roots = new Set<string>();
  for (const item of items) {
    if (item.kind === 'row' && item.rowState.ask != null) {
      roots.add(item.familyId ?? item.id);
    }
  }
  return roots;
};

type FirstRowParams = RootsParams;

export const firstNeedsYouRowId = ({ items }: FirstRowParams): string | null =>
  items.find((item) => item.kind === 'row' && item.rowState.ask != null)?.id ?? null;

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
