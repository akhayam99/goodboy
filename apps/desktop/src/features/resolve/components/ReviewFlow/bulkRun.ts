import type { FixRun } from '../../fixRun';
import type { ReviewEntry } from './useReviewEntries';

export type BulkRun = {
  readonly launchId: string;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

const isCouldntFix = ({ entry }: { readonly entry: ReviewEntry }): boolean =>
  entry.resolveWord === 'couldnt_fix' && entry.isFixable;

export const bulkRunOf = ({
  run,
  entries,
}: {
  readonly run: FixRun | null;
  readonly entries: ReadonlyArray<ReviewEntry>;
}): BulkRun | null => {
  if (run === null) {
    return null;
  }
  const members = new Set(run.threadIds);
  return {
    launchId: run.launchId,
    entries: entries.filter((entry) => members.has(entry.threadId)),
  };
};

export const retryableOf = ({ run }: { readonly run: BulkRun }): ReadonlyArray<ReviewEntry> =>
  run.entries.filter((entry) => isCouldntFix({ entry }));
