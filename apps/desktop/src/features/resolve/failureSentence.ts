import type { ResolveAttempt, ResolveFailureCause, ResolveThread } from '@goodboy/types';
import { NEEDS_RUN_REASON } from './needsRunReason';

const FAILURE_CAUSE_SENTENCE: Readonly<Record<ResolveFailureCause, string>> = {
  start_failed: "The fix didn't start",
  provider_error: 'The provider stopped the run',
  spend_cap: 'Every provider is over its limit',
  stopped: 'You stopped it',
  app_closed: 'The app closed while it was working',
  accept_conflict: 'It conflicts with a fix you accepted before',
  worktree_missing: 'The worktree for this comment is no longer available',
  capture_failed: "The fix couldn't be saved from its copy of the branch",
  no_result: 'The agent ended without a result for this comment',
  needs_a_run: 'The fix agent stopped: this is bigger than one change',
};

const UNRECORDED_CAUSE_SENTENCE = "Goodboy didn't record why";

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

type ThreadCauseParams = {
  readonly thread: Pick<ResolveThread, 'stateReason'>;
  readonly attempt: Pick<ResolveAttempt, 'failureCause' | 'phase'> | null;
};

export const causeOfThread = ({
  thread,
  attempt,
}: ThreadCauseParams): ResolveFailureCause | null => {
  if (NEEDS_RUN_REASON.reasonOf({ stateReason: thread.stateReason }) !== null) {
    return 'needs_a_run';
  }
  return causeOfAttempt({ attempt });
};

export const threadFailureSentence = ({ thread, attempt }: ThreadCauseParams): string =>
  failureSentence({ cause: causeOfThread({ thread, attempt }) });
