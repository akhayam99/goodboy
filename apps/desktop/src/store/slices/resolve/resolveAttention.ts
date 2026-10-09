import type { ResolveAttempt, ResolveThread } from '@goodboy/types';
import { causeOfAttempt } from '../../../features/resolve/failureSentence';
import type { EmitNotificationParams } from '../notifications/emitNotification';

export type ResolveAttention = {
  readonly needsYou: number;
  readonly couldntFix: number;
  readonly pushFailed: number;
  readonly notesNeedYou: number;
  readonly notesCouldntFix: number;
};

type AttentionThread = Pick<ResolveThread, 'state' | 'stateReason' | 'activeAttemptId'> &
  Partial<Pick<ResolveThread, 'originKind'>>;
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
  let pushFailed = 0;
  let notesNeedYou = 0;
  let notesCouldntFix = 0;
  for (const thread of threads) {
    const isNote = thread.originKind === 'diff_comment';
    if (thread.state === 'needs_answer' && isNote) {
      notesNeedYou += 1;
      continue;
    }
    if (thread.state === 'needs_answer') {
      needsYou += 1;
      continue;
    }
    if (thread.state === 'failed' && isPushFailure({ thread })) {
      if (!isNote) {
        pushFailed += 1;
      }
      continue;
    }
    if (thread.state !== 'failed') {
      continue;
    }
    const attempt =
      thread.activeAttemptId === null ? null : (attemptById.get(thread.activeAttemptId) ?? null);
    if (causeOfAttempt({ attempt }) === 'stopped') {
      continue;
    }
    if (isNote) {
      notesCouldntFix += 1;
      continue;
    }
    couldntFix += 1;
  }
  return { needsYou, couldntFix, pushFailed, notesNeedYou, notesCouldntFix };
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
  ...(after.pushFailed > before.pushFailed
    ? [
        {
          kind: 'error',
          severity: 'error',
          title: 'Push failed',
          body: 'Nothing was sent. Retry from the Comments tab.',
          sessionId,
          action: { kind: 'open-activity', sessionId },
          coalesceKey: `push-failed:${sessionId}`,
        } satisfies EmitNotificationParams,
      ]
    : []),
  ...(after.notesNeedYou > before.notesNeedYou
    ? [
        {
          kind: 'error',
          severity: 'warning',
          title: 'A fix run needs you',
          body: `${after.notesNeedYou === 1 ? '1 note waits' : `${after.notesNeedYou} notes wait`} for your answer.`,
          sessionId,
          action: { kind: 'open-activity', sessionId },
          coalesceKey: `fix-run-note-needs-you:${sessionId}`,
        } satisfies EmitNotificationParams,
      ]
    : []),
  ...(after.notesCouldntFix > before.notesCouldntFix
    ? [
        {
          kind: 'error',
          severity: 'warning',
          title: `A fix run couldn't fix ${after.notesCouldntFix === 1 ? 'a note' : `${after.notesCouldntFix} notes`}`,
          body: 'Retry it in the run or start over from your notes.',
          sessionId,
          action: { kind: 'open-activity', sessionId },
          coalesceKey: `fix-run-note-couldnt-fix:${sessionId}`,
        } satisfies EmitNotificationParams,
      ]
    : []),
];
