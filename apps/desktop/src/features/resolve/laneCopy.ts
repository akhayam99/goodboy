import type { ResolveAttempt } from '@goodboy/types';

export const LANE_REBUILD_HINT =
  'An earlier fix on this branch was dropped or changed, so this fix is rebuilt on top of the branch as it is now. Start from the earlier attempt and adapt it to the current code.';

export const LANE_QUEUED_SENTENCE = 'Queued, after the current fix';

export const isLaneRebuildAttempt = ({ attempt }: { readonly attempt: ResolveAttempt }): boolean =>
  attempt.launchChoice?.hint?.includes(LANE_REBUILD_HINT) === true;

export const laneRebuildLine = ({ count }: { readonly count: number }): string =>
  count === 1
    ? '1 fix was built beside another. It is being rebuilt on top of the lane'
    : `${count} fixes were built beside others. They are being rebuilt on top of the lane`;

export const laneProgressLine = ({
  position,
  total,
  nextTitle,
}: {
  readonly position: number;
  readonly total: number;
  readonly nextTitle: string | null;
}): string => {
  const head = `Fixing ${position} of ${total}`;
  return nextTitle === null ? head : `${head} · next: ${nextTitle}`;
};

export const laneWaitingLine = ({
  total,
  queued,
}: {
  readonly total: number;
  readonly queued: number;
}): string =>
  queued === 0
    ? `Waiting for your answer · ${total === 1 ? '1 fix' : `${total} fixes`} in the lane`
    : `Waiting for your answer · ${queued} queued after it`;

export const acceptUpToLabel = ({ count }: { readonly count: number }): string =>
  count === 1 ? 'Accept' : `Accept ${count} fixes`;
