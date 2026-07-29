import type { ResolverThreadOutcome } from '../../store/types';

type Params = {
  readonly threadIds: ReadonlyArray<string>;
  readonly outcomes: Readonly<Record<string, ResolverThreadOutcome>>;
  readonly pendingResolutions: ReadonlyArray<{
    readonly threadId: string;
    readonly commitSha: string;
  }>;
  readonly reportedSha?: string | null;
};

export const resolverCommitSha = ({
  threadIds,
  outcomes,
  pendingResolutions,
  reportedSha = null,
}: Params): string | null => {
  const queued = pendingResolutions.find((resolution) => threadIds.includes(resolution.threadId));
  if (queued != null) {
    return queued.commitSha;
  }
  if (reportedSha !== null) {
    return reportedSha;
  }
  for (const threadId of threadIds) {
    const outcome = outcomes[threadId];
    if (outcome?.kind === 'resolved') {
      return outcome.commitSha;
    }
  }
  return null;
};
