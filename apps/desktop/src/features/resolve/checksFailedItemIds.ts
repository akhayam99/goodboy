import type { ResolveCheckRun } from '@goodboy/types';
import type { ResolveCandidateWithItems } from '../../store/slices/resolve/state';

type Params = {
  readonly candidates: ReadonlyArray<ResolveCandidateWithItems>;
  readonly checkRuns: ReadonlyArray<ResolveCheckRun>;
};

export const checksFailedItemIds = ({ candidates, checkRuns }: Params): ReadonlySet<string> => {
  const failed = new Set<string>();
  for (const { candidate, items } of candidates) {
    if (candidate.state !== 'ready') {
      continue;
    }
    const latest = checkRuns
      .filter((run) => run.candidateId === candidate.id && run.candidateTree !== null)
      .sort((left, right) => right.createdAt - left.createdAt)[0];
    if (latest === undefined || latest.outcome === 'passed') {
      continue;
    }
    for (const item of items) {
      failed.add(item.queueItemId);
    }
  }
  return failed;
};
