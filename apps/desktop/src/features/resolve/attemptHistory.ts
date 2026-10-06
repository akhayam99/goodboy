import type { ResolveAttempt } from '@goodboy/types';
import { attemptFailureSentence } from './failureSentence';

export type PreviousAttempt = {
  readonly id: string;
  readonly number: number;
  readonly provider: string;
  readonly model: string;
  readonly effort: string | null;
  readonly outcome: 'failed' | 'stopped' | 'finished';
  readonly reason: string | null;
};

type Params = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly threadId: string;
  readonly activeAttemptId: string | null;
};

const outcomeOf = ({
  attempt,
}: {
  readonly attempt: ResolveAttempt;
}): PreviousAttempt['outcome'] => {
  if (attempt.phase === 'cancelled') {
    return 'stopped';
  }
  return attempt.phase === 'failed' || attempt.error !== null || attempt.failureCause != null
    ? 'failed'
    : 'finished';
};

const threadAttempts = ({
  attempts,
  threadId,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly threadId: string;
}): ReadonlyArray<ResolveAttempt> =>
  attempts
    .filter((attempt) => attempt.threadIds.includes(threadId))
    .sort((left, right) => left.createdAt - right.createdAt);

export const previousAttemptsOf = ({
  attempts,
  threadId,
  activeAttemptId,
}: Params): ReadonlyArray<PreviousAttempt> =>
  threadAttempts({ attempts, threadId }).flatMap(
    (attempt, index): ReadonlyArray<PreviousAttempt> => {
      if (attempt.id === activeAttemptId) {
        return [];
      }
      const outcome = outcomeOf({ attempt });
      return [
        {
          id: attempt.id,
          number: index + 1,
          provider: attempt.provider,
          model: attempt.model,
          effort: attempt.effort,
          outcome,
          reason: outcome === 'finished' ? null : attemptFailureSentence({ attempt }),
        },
      ];
    },
  );

export const attemptNumberOf = ({
  attempts,
  threadId,
  attemptId,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly threadId: string;
  readonly attemptId: string;
}): number =>
  threadAttempts({ attempts, threadId }).findIndex((attempt) => attempt.id === attemptId) + 1;
