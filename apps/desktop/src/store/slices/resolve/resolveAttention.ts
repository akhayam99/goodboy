import type { MountId, ResolveAttempt, ResolveThread } from '@goodboy/types';
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
  Partial<Pick<ResolveThread, 'originKind' | 'projectId'>>;

export type PushFailuresByMount = ReadonlyMap<MountId | null, number>;

type MountOfParams = {
  readonly thread: AttentionThread;
};

export type MountOfThread = (params: MountOfParams) => MountId | null;

type PushFailuresParams = {
  readonly threads: ReadonlyArray<AttentionThread>;
  readonly mountOf: MountOfThread;
};

type PushNoticesParams = {
  readonly before: PushFailuresByMount;
  readonly after: PushFailuresByMount;
  readonly sessionId: NonNullable<EmitNotificationParams['sessionId']>;
};

type AttentionNoticesParams = {
  readonly before: ResolveAttention;
  readonly after: ResolveAttention;
  readonly sessionId: NonNullable<EmitNotificationParams['sessionId']>;
  readonly pushBefore?: PushFailuresByMount;
  readonly pushAfter?: PushFailuresByMount;
};
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

export const pushFailuresByMountOf = ({
  threads,
  mountOf,
}: PushFailuresParams): PushFailuresByMount => {
  const counts = new Map<MountId | null, number>();
  for (const thread of threads) {
    if (thread.state !== 'failed' || !isPushFailure({ thread })) {
      continue;
    }
    if (thread.originKind === 'diff_comment') {
      continue;
    }
    const mountId = mountOf({ thread });
    counts.set(mountId, (counts.get(mountId) ?? 0) + 1);
  }
  return counts;
};

const pushFailedNotices = ({
  before,
  after,
  sessionId,
}: PushNoticesParams): ReadonlyArray<EmitNotificationParams> => {
  const notices: Array<EmitNotificationParams> = [];
  for (const [mountId, count] of after) {
    if (count <= (before.get(mountId) ?? 0)) {
      continue;
    }
    notices.push({
      kind: 'error',
      severity: 'error',
      title: 'Push failed',
      body: 'Nothing was sent. Retry from the Comments tab.',
      sessionId,
      action: { kind: 'open-place', sessionId, reason: 'push-failed', mountId, subject: 'comment' },
      coalesceKey:
        mountId === null ? `push-failed:${sessionId}` : `push-failed:${sessionId}:${mountId}`,
    });
  }
  return notices;
};

export const resolveAttentionNotices = ({
  before,
  after,
  sessionId,
  pushBefore = new Map<MountId | null, number>([[null, before.pushFailed]]),
  pushAfter = new Map<MountId | null, number>([[null, after.pushFailed]]),
}: AttentionNoticesParams): ReadonlyArray<EmitNotificationParams> => [
  ...(after.needsYou > before.needsYou
    ? [
        {
          kind: 'error',
          severity: 'warning',
          title: 'A fix run needs you',
          body: `${after.needsYou === 1 ? '1 comment waits' : `${after.needsYou} comments wait`} for your answer.`,
          sessionId,
          action: {
            kind: 'open-place',
            sessionId,
            reason: 'fix-needs-you',
            mountId: null,
            subject: 'comment',
          },
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
          action: {
            kind: 'open-place',
            sessionId,
            reason: 'fix-couldnt-fix',
            mountId: null,
            subject: 'comment',
          },
          coalesceKey: `fix-run-couldnt-fix:${sessionId}`,
        } satisfies EmitNotificationParams,
      ]
    : []),
  ...pushFailedNotices({ before: pushBefore, after: pushAfter, sessionId }),
  ...(after.notesNeedYou > before.notesNeedYou
    ? [
        {
          kind: 'error',
          severity: 'warning',
          title: 'A fix run needs you',
          body: `${after.notesNeedYou === 1 ? '1 note waits' : `${after.notesNeedYou} notes wait`} for your answer.`,
          sessionId,
          action: {
            kind: 'open-place',
            sessionId,
            reason: 'fix-needs-you',
            mountId: null,
            subject: 'note',
          },
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
          action: {
            kind: 'open-place',
            sessionId,
            reason: 'fix-couldnt-fix',
            mountId: null,
            subject: 'note',
          },
          coalesceKey: `fix-run-note-couldnt-fix:${sessionId}`,
        } satisfies EmitNotificationParams,
      ]
    : []),
];
