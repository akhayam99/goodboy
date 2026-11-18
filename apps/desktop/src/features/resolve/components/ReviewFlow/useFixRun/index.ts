import { useMemo } from 'react';
import { fixRunOf, type FixRun } from '../../../fixRun';
import { heldLaunchIdOf } from '../../../../../store/slices/resolve/launchTurns';
import { fixRunReadyOf, type FixRunReady } from '../../../fixRunReady';
import type { LaneStatus } from '../../../laneStatus';
import type { ReviewEntry } from '../useReviewEntries';

type Params = {
  readonly lane: LaneStatus | null;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

type FixRunView = {
  readonly run: FixRun | null;
  readonly fixRunReady: FixRunReady | null;
  readonly isRunLive: boolean;
};

export const useFixRun = ({ lane, entries }: Params): FixRunView => {
  const run = useMemo(
    () =>
      fixRunOf({
        sources: entries.map((entry) => ({
          threadId: entry.threadId,
          word: entry.resolveWord,
          attempt: entry.row.attempt,
          heldLaunchId: heldLaunchIdOf({ threadId: entry.threadId }),
        })),
      }),
    [entries],
  );
  const isRunLive = run !== null && (run.isLive || lane !== null);
  const fixRunReady = useMemo(
    () => fixRunReadyOf({ run, entries, isLive: isRunLive }),
    [entries, isRunLive, run],
  );
  return { run, fixRunReady, isRunLive };
};
