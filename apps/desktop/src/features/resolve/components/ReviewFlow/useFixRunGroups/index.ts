import { useMemo } from 'react';
import { fixRunOf, type FixRun } from '../../../fixRun';
import { heldLaunchIdOf } from '../../../../../store/slices/resolve/launchTurns';
import { fixRunReadyOf, type FixRunReady } from '../../../fixRunReady';
import type { LaneStatus } from '../../../laneStatus';
import type { ReviewEntry, ReviewGroup } from '../useReviewEntries';

type Params = {
  readonly lane: LaneStatus | null;
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly groups: ReadonlyArray<ReviewGroup>;
};

type FixRunGroups = {
  readonly run: FixRun | null;
  readonly groups: ReadonlyArray<ReviewGroup>;
  readonly fixRunReady: FixRunReady | null;
  readonly isRunLive: boolean;
};

export const useFixRunGroups = ({ lane, entries, groups }: Params): FixRunGroups => {
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
  const grouped = useMemo((): ReadonlyArray<ReviewGroup> => {
    if (run === null || fixRunReady === null) {
      return groups;
    }
    const members = new Set(run.threadIds);
    const inRun = groups.flatMap(({ entries: shown }) =>
      shown.filter((entry) => members.has(entry.threadId)),
    );
    if (inRun.length === 0) {
      return groups;
    }
    return [
      { group: 'needs_you', isRun: true, entries: inRun },
      ...groups
        .map(({ group, entries: shown }) => ({
          group,
          entries: shown.filter((entry) => !members.has(entry.threadId)),
        }))
        .filter((rest) => rest.entries.length > 0),
    ];
  }, [fixRunReady, groups, run]);
  return { run, groups: grouped, fixRunReady, isRunLive };
};
