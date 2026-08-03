import type { PendingResolution } from '@goodboy/types';
import type { ResolverThreadOutcome } from '../../store/types';

type Params = {
  readonly threadIds: ReadonlyArray<string>;
  readonly outcomes: Readonly<Record<string, ResolverThreadOutcome>>;
  readonly pendingResolutions: ReadonlyArray<PendingResolution>;
};

export const resolverThreadCommitShas = ({
  threadIds,
  outcomes,
  pendingResolutions,
}: Params): Readonly<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const threadId of threadIds) {
    const outcome = outcomes[threadId];
    if (outcome?.kind === 'resolved') {
      out[threadId] = outcome.commitSha;
      continue;
    }
    const queued = pendingResolutions.find((resolution) => resolution.threadId === threadId);
    if (queued !== undefined) {
      out[threadId] = queued.commitSha;
    }
  }
  return out;
};
