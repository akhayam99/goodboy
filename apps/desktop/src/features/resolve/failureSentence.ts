import type { ResolveAttempt, ResolveFailureCause } from '@goodboy/types';

const FAILURE_CAUSE_SENTENCE: Readonly<Record<ResolveFailureCause, string>> = {
  start_failed: "The fix didn't start",
  provider_error: 'The model provider stopped the run',
  spend_cap: 'Every provider is over its spend cap',
  stopped: 'You stopped it',
  app_closed: 'The app closed while it was working',
  accept_conflict: 'It conflicts with a fix you accepted before',
  worktree_missing: 'The worktree for this comment is no longer available',
  capture_failed: "The fix couldn't be saved from its copy of the branch",
};

const UNRECORDED_CAUSE_SENTENCE = 'Cause not recorded';

export const causeOfAttempt = ({
  attempt,
}: {
  readonly attempt: Pick<ResolveAttempt, 'failureCause' | 'phase'> | null;
}): ResolveFailureCause | null => {
  if (attempt === null) {
    return null;
  }
  if (attempt.failureCause != null) {
    return attempt.failureCause;
  }
  return attempt.phase === 'cancelled' ? 'stopped' : null;
};

export const failureSentence = ({
  cause,
}: {
  readonly cause: ResolveFailureCause | null;
}): string => (cause === null ? UNRECORDED_CAUSE_SENTENCE : FAILURE_CAUSE_SENTENCE[cause]);

export const attemptFailureSentence = ({
  attempt,
}: {
  readonly attempt: Pick<ResolveAttempt, 'failureCause' | 'phase'> | null;
}): string => failureSentence({ cause: causeOfAttempt({ attempt }) });
