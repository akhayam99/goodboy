import type { ResolveAttempt, ResolveThread } from '@goodboy/types';
import { causeOfAttempt } from '../../../features/resolve/failureSentence';
import type { EmitNotificationParams } from '../notifications/emitNotification';

export type ResolveAttention = {
  readonly needsYou: number;
  readonly couldntFix: number;
};

type AttentionThread = Pick<ResolveThread, 'state' | 'stateReason' | 'activeAttemptId'>;
type AttentionAttempt = Pick<ResolveAttempt, 'id' | 'failureCause' | 'phase'>;

const isPushFailure = ({ thread }: { readonly thread: AttentionThread }): boolean =>
  thread.stateReason?.startsWith('publication_failed:') === true;

export const resolveAttentionOf = ({
  threads,
  attempts,
}: {
  readonly threads: ReadonlyArray<AttentionThread>;
  readonly attempts: ReadonlyArray<AttentionAttempt>;
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

export const resolveAttentionNotices = ({
  before,
  after,
  sessionId,
}: {
  readonly before: ResolveAttention;
  readonly after: ResolveAttention;
  readonly sessionId: NonNullable<EmitNotificationParams['sessionId']>;
}): ReadonlyArray<EmitNotificationParams> => [
  ...(after.needsYou > before.needsYou
    ? [
        {
          kind: 'error',
          severity: 'warning',
          title: 'A fix run needs you',
          body: `${after.needsYou === 1 ? '1 comment waits' : `${after.needsYou} comments wait`} for your answer.`,
          sessionId,
          action: { kind: 'open-activity', sessionId },
          coalesceKey: `fix-run-needs-you:${sessionId}`,
        } satisfies EmitNotificationParams,
      ]
    : []),
  ...(after.couldntFix > before.couldntFix
    ? [
        {
          kind: 'error',
          severity: 'warning',
          title: `A fix run couldn't fix ${after.couldntFix === 1 ? 'a comment' : `${after.couldntFix} comments`}`,
          body: 'Retry it in the run or start over from the Comments tab.',
          sessionId,
          action: { kind: 'open-activity', sessionId },
          coalesceKey: `fix-run-couldnt-fix:${sessionId}`,
        } satisfies EmitNotificationParams,
      ]
    : []),
];
