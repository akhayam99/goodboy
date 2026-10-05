import type { ResolveAttempt, ResolveThread } from '@goodboy/types';
import { causeOfAttempt } from '../../../features/resolve/failureSentence';

export type ResolveAttention = {
  readonly needsYou: number;
  readonly couldntFix: number;
};

export const NO_RESOLVE_ATTENTION: ResolveAttention = { needsYou: 0, couldntFix: 0 };

const isPushFailure = ({ thread }: { readonly thread: ResolveThread }): boolean =>
  thread.stateReason?.startsWith('publication_failed:') === true;

export const resolveAttentionOf = ({
  threads,
  attempts,
}: {
  readonly threads: ReadonlyArray<ResolveThread>;
  readonly attempts: ReadonlyArray<ResolveAttempt>;
}): ResolveAttention => {
  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  let needsYou = 0;
  let couldntFix = 0;
  for (const thread of threads) {
    if (thread.state === 'needs_answer') {
      needsYou += 1;
      continue;
    }
    if (thread.state !== 'failed' || isPushFailure({ thread })) {
      continue;
    }
    const attempt =
      thread.activeAttemptId === null ? null : (attemptById.get(thread.activeAttemptId) ?? null);
    if (causeOfAttempt({ attempt }) !== 'stopped') {
      couldntFix += 1;
    }
  }
  return { needsYou, couldntFix };
};

export const resolveAttentionRaised = ({
  before,
  after,
}: {
  readonly before: ResolveAttention;
  readonly after: ResolveAttention;
}): { readonly needsYou: boolean; readonly couldntFix: boolean } => ({
  needsYou: after.needsYou > before.needsYou,
  couldntFix: after.couldntFix > before.couldntFix,
});
