import type { ReviewEntry } from './components/ReviewFlow/useReviewEntries';

export const fixRunAskingOf = ({
  entries,
  batchThreadIds,
}: {
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly batchThreadIds: ReadonlyArray<string>;
}): ReadonlyArray<ReviewEntry> =>
  entries.filter((entry) => entry.state === 'needs' && batchThreadIds.includes(entry.threadId));
