import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';

export type CommentFilter = 'all' | 'notes' | 'host';

export const COMMENT_FILTERS: ReadonlyArray<CommentFilter> = ['all', 'notes', 'host'];

type EntryParams = {
  readonly entry: ReviewEntry;
};

export const isNoteEntry = ({ entry }: EntryParams): boolean =>
  entry.row.thread.originKind === 'diff_comment';

type Params = {
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly filter: CommentFilter;
};

export const filteredEntries = ({ entries, filter }: Params): ReadonlyArray<ReviewEntry> => {
  if (filter === 'all') {
    return entries;
  }
  return entries.filter((entry) => isNoteEntry({ entry }) === (filter === 'notes'));
};
