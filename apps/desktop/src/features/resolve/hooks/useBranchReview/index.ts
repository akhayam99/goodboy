import { useMemo } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import type { BranchStepComments } from '../../../branch/branchStepOf';
import type { FixRun } from '../../fixRun';
import type { LaneStatus } from '../../laneStatus';
import { useFixRunGroups } from '../../components/ReviewFlow/useFixRunGroups';
import {
  useReviewEntries,
  type ReviewEntry,
  type ReviewGroup,
} from '../../components/ReviewFlow/useReviewEntries';
import { useReviewPush, type ReviewPush } from '../../components/ReviewFlow/useReviewPush';
import { useLaneStatus } from '../useLaneStatus';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

type BranchReview = {
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly push: ReviewPush;
  readonly comments: BranchStepComments;
  readonly run: FixRun | null;
  readonly lane: LaneStatus | null;
};

const NO_GROUPS: ReadonlyArray<ReviewGroup> = [];
const NO_THREADS: ReadonlyArray<string> = [];

export const useBranchReview = ({ sessionId, mountId }: Params): BranchReview => {
  const { entries } = useReviewEntries({ sessionId, mountId });
  const push = useReviewPush({ sessionId, mountId });
  const { entries: branchEntries } = useReviewEntries({ sessionId, scope: 'branch', mountId });
  const lane = useLaneStatus({ sessionId, entries: branchEntries });
  const { run, fixRunReady, isRunLive } = useFixRunGroups({
    lane,
    entries: branchEntries,
    groups: NO_GROUPS,
  });
  const questionThreadId =
    branchEntries.find((entry) => entry.resolveWord === 'question')?.threadId ?? null;
  const fixableThreadIds = useMemo(
    () => branchEntries.filter((entry) => entry.isFixable).map((entry) => entry.threadId),
    [branchEntries],
  );
  const readyThreadIds = fixRunReady?.threadIds ?? NO_THREADS;
  const comments = useMemo<BranchStepComments>(
    () => ({
      facts: {
        questionThreadId,
        waitingFixes: readyThreadIds.length,
        fixable: fixableThreadIds.length,
        isFixRunLive: isRunLive,
      },
      readyThreadIds,
      fixableThreadIds,
    }),
    [fixableThreadIds, isRunLive, questionThreadId, readyThreadIds],
  );
  return { entries, push, comments, run, lane };
};
