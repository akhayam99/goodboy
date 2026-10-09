import type { ReviewEntry } from '../components/ReviewFlow/useReviewEntries';

export const isNoteEntry = ({ entry }: { readonly entry: ReviewEntry }): boolean =>
  entry.row.thread.originKind === 'diff_comment';

export const isOpenNoteEntry = ({ entry }: { readonly entry: ReviewEntry }): boolean =>
  isNoteEntry({ entry }) &&
  entry.row.thread.state !== 'closed' &&
  entry.row.commentThread?.head.resolved !== true;

export const fixableNoteIdsOf = ({
  entries,
}: {
  readonly entries: ReadonlyArray<ReviewEntry>;
}): ReadonlyArray<string> =>
  entries.filter((entry) => entry.isFixable).map((entry) => entry.threadId);
