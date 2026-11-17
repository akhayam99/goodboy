import type { ResolveAttemptPhase, ResolveFailureCause } from '@goodboy/types';

type Params = {
  readonly hasSilentThread: boolean;
  readonly hasNeedsRun: boolean;
  readonly isWaiting: boolean;
};

export type TurnAttemptPhase = {
  readonly phase: ResolveAttemptPhase;
  readonly error: string | null;
  readonly failureCause: ResolveFailureCause | null;
};

export const turnAttemptPhase = ({
  hasSilentThread,
  hasNeedsRun,
  isWaiting,
}: Params): TurnAttemptPhase => {
  if (hasSilentThread) {
    return { phase: 'failed', error: 'No result from the run', failureCause: 'no_result' };
  }
  if (hasNeedsRun) {
    return {
      phase: 'failed',
      error: 'The fix agent found work bigger than one change',
      failureCause: 'needs_a_run',
    };
  }
  return { phase: isWaiting ? 'waiting' : 'finished', error: null, failureCause: null };
};
