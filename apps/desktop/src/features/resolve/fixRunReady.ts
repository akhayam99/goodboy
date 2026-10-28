import type { FixRun } from './fixRun';
import type { ReviewEntry } from './components/ReviewFlow/useReviewEntries';

export type FixRunReady = {
  readonly threadIds: ReadonlyArray<string>;
  readonly commits: ReadonlyArray<string>;
  readonly hostThreadCount: number;
};

type Params = {
  readonly run: FixRun | null;
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly isLive: boolean;
};

type EntryParams = {
  readonly entry: ReviewEntry;
};

const isNote = ({ entry }: EntryParams): boolean => entry.row.thread.originKind === 'diff_comment';

export const fixRunReadyOf = ({ run, entries, isLive }: Params): FixRunReady | null => {
  if (run === null || isLive) {
    return null;
  }
  const members = new Set(run.threadIds);
  const ready = entries.filter(
    (entry) => members.has(entry.threadId) && entry.isAcceptable && entry.fix?.kind === 'fixed',
  );
  if (ready.length === 0) {
    return null;
  }
  return {
    threadIds: ready.map((entry) => entry.threadId),
    commits: [
      ...new Set(ready.flatMap((entry) => (entry.fix?.kind === 'fixed' ? [entry.fix.sha] : []))),
    ],
    hostThreadCount: ready.filter((entry) => !isNote({ entry })).length,
  };
};
