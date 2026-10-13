import type { ResolveCandidate } from '@goodboy/types';

type Params = {
  readonly candidates: ReadonlyArray<ResolveCandidate>;
};

export const pendingCandidateShas = ({ candidates }: Params): ReadonlySet<string> =>
  new Set(
    candidates.flatMap((candidate) =>
      candidate.state === 'ready' ? [candidate.candidateSha] : [],
    ),
  );
