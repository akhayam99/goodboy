import type { ResolvePublication } from '@goodboy/types';

type Params = {
  readonly publications: ReadonlyArray<ResolvePublication>;
};

export const failedPushPublication = ({ publications }: Params): ResolvePublication | null => {
  const latest = publications.reduce<ResolvePublication | null>(
    (best, candidate) =>
      candidate.phase === 'cancelled' || (best !== null && best.createdAt > candidate.createdAt)
        ? best
        : candidate,
    null,
  );
  const isPushFailure =
    latest !== null &&
    latest.phase === 'failed' &&
    latest.error !== null &&
    latest.requiresPush &&
    latest.pushedHead === null;
  return isPushFailure ? latest : null;
};
