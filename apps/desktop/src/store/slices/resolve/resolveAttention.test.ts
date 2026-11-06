import { describe, expect, it } from 'vitest';
import {
  brandId,
  type MountId,
  type ProjectId,
  type ResolveAttempt,
  type ResolveThread,
  type SessionId,
} from '@goodboy/types';
import {
  pushFailuresByMountOf,
  resolveAttentionNotices,
  resolveAttentionOf,
} from './resolveAttention';

const SESSION = brandId<SessionId>({ value: 'session-1' });

type Thread = Pick<ResolveThread, 'state' | 'stateReason' | 'activeAttemptId' | 'originKind'>;
type Attempt = Pick<ResolveAttempt, 'id' | 'failureCause' | 'phase'>;

const thread = ({
  state,
  attemptId = null,
  stateReason = null,
  originKind = 'review_comment',
}: {
  readonly state: ResolveThread['state'];
  readonly attemptId?: string | null;
  readonly stateReason?: string | null;
  readonly originKind?: ResolveThread['originKind'];
}): Thread => ({ state, stateReason, activeAttemptId: attemptId, originKind });

const attempt = ({
  id,
  cause,
}: {
  readonly id: string;
  readonly cause: ResolveAttempt['failureCause'];
}): Attempt => ({ id, phase: 'failed', failureCause: cause });

describe('resolveAttentionOf', () => {
  it('counts the comments that wait for an answer and the ones that could not be fixed', () => {
    const attention = resolveAttentionOf({
      threads: [
        thread({ state: 'needs_answer' }),
        thread({ state: 'failed', attemptId: 'a1' }),
        thread({ state: 'fixed' }),
        thread({ state: 'working' }),
      ],
      attempts: [attempt({ id: 'a1', cause: 'provider_error' })],
    });

    expect(attention).toEqual({
      needsYou: 1,
      couldntFix: 1,
      pushFailed: 0,
      notesNeedYou: 0,
      notesCouldntFix: 0,
    });
  });

  it('counts a note that waits or could not be fixed apart from the comments', () => {
    const attention = resolveAttentionOf({
      threads: [
        thread({ state: 'needs_answer' }),
        thread({ state: 'needs_answer', originKind: 'diff_comment' }),
        thread({ state: 'failed', attemptId: 'a1', originKind: 'diff_comment' }),
      ],
      attempts: [attempt({ id: 'a1', cause: 'provider_error' })],
    });

    expect(attention).toEqual({
      needsYou: 1,
      couldntFix: 0,
      pushFailed: 0,
      notesNeedYou: 1,
      notesCouldntFix: 1,
    });
  });

  it('counts a push that failed as a push failure and never as a comment it could not fix', () => {
    const attention = resolveAttentionOf({
      threads: [
        thread({ state: 'failed', attemptId: 'a2', stateReason: 'publication_failed:{}' }),
        thread({
          state: 'failed',
          attemptId: 'a2',
          stateReason: 'publication_failed:{}',
          originKind: 'diff_comment',
        }),
      ],
      attempts: [attempt({ id: 'a2', cause: null })],
    });

    expect(attention).toEqual({
      needsYou: 0,
      couldntFix: 0,
      pushFailed: 1,
      notesNeedYou: 0,
      notesCouldntFix: 0,
    });
  });

  it('does not raise attention for a run you stopped', () => {
    const attention = resolveAttentionOf({
      threads: [thread({ state: 'failed', attemptId: 'a1' })],
      attempts: [attempt({ id: 'a1', cause: 'stopped' })],
    });

    expect(attention).toEqual({
      needsYou: 0,
      couldntFix: 0,
      pushFailed: 0,
      notesNeedYou: 0,
      notesCouldntFix: 0,
    });
  });
});

describe('resolveAttentionNotices', () => {
  const NONE = { needsYou: 0, couldntFix: 0, pushFailed: 0, notesNeedYou: 0, notesCouldntFix: 0 };

  it('tells you once when a comment starts to need you', () => {
    const notices = resolveAttentionNotices({
      before: NONE,
      after: { ...NONE, needsYou: 1 },
      sessionId: SESSION,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      title: 'A fix run needs you',
      body: '1 comment waits for your answer.',
      sessionId: SESSION,
      action: { kind: 'open-place', sessionId: SESSION, reason: 'fix-needs-you', mountId: null },
    });
  });

  it('tells you apart when a note starts to need you or could not be fixed', () => {
    const notices = resolveAttentionNotices({
      before: NONE,
      after: { ...NONE, notesNeedYou: 2, notesCouldntFix: 1 },
      sessionId: SESSION,
    });

    expect(notices.map((notice) => notice.body)).toEqual([
      '2 notes wait for your answer.',
      'Retry it in the run or start over from your notes.',
    ]);
    expect(notices.map((notice) => notice.title)).toEqual([
      'A fix run needs you',
      "A fix run couldn't fix a note",
    ]);
  });

  it('tells you when comments could not be fixed, with the count', () => {
    const notices = resolveAttentionNotices({
      before: NONE,
      after: { ...NONE, couldntFix: 3 },
      sessionId: SESSION,
    });

    expect(notices.map((notice) => notice.title)).toEqual(["A fix run couldn't fix 3 comments"]);
  });

  it('tells you once, in red, when a push fails, and not again while it stays failed', () => {
    const notices = resolveAttentionNotices({
      before: NONE,
      after: { ...NONE, pushFailed: 2 },
      sessionId: SESSION,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      severity: 'error',
      title: 'Push failed',
      body: 'Nothing was sent. Retry from the Comments tab.',
      action: { kind: 'open-place', sessionId: SESSION, reason: 'push-failed', mountId: null },
      coalesceKey: `push-failed:${SESSION}`,
    });
    expect(
      resolveAttentionNotices({
        before: { ...NONE, pushFailed: 2 },
        after: { ...NONE, pushFailed: 2 },
        sessionId: SESSION,
      }),
    ).toEqual([]);
  });

  it('says both when both rose and nothing when nothing rose', () => {
    expect(
      resolveAttentionNotices({
        before: NONE,
        after: { ...NONE, needsYou: 1, couldntFix: 1 },
        sessionId: SESSION,
      }),
    ).toHaveLength(2);
    expect(
      resolveAttentionNotices({
        before: { ...NONE, needsYou: 2, couldntFix: 1 },
        after: { ...NONE, needsYou: 2 },
        sessionId: SESSION,
      }),
    ).toEqual([]);
  });
});

describe('resolveAttentionNotices keep what the notice is about', () => {
  const NONE = { needsYou: 0, couldntFix: 0, pushFailed: 0, notesNeedYou: 0, notesCouldntFix: 0 };
  const MOUNT_A = brandId<MountId>({ value: 'mount-ledger-core' });
  const MOUNT_B = brandId<MountId>({ value: 'mount-notify-relay' });
  const PROJECT_A = brandId<ProjectId>({ value: 'project-ledger-core' });
  const PROJECT_B = brandId<ProjectId>({ value: 'project-notify-relay' });

  it('says note on a note notice and comment on a comment notice', () => {
    const notices = resolveAttentionNotices({
      before: NONE,
      after: { ...NONE, needsYou: 1, notesNeedYou: 1, couldntFix: 1, notesCouldntFix: 1 },
      sessionId: SESSION,
    });

    expect(notices.map((notice) => notice.action)).toMatchObject([
      { reason: 'fix-needs-you', subject: 'comment' },
      { reason: 'fix-couldnt-fix', subject: 'comment' },
      { reason: 'fix-needs-you', subject: 'note' },
      { reason: 'fix-couldnt-fix', subject: 'note' },
    ]);
  });

  it('names the mount whose push failed, one notice per mount', () => {
    const mountOf = ({ thread }: { readonly thread: { readonly projectId?: ProjectId | null } }) =>
      thread.projectId === PROJECT_B ? MOUNT_B : MOUNT_A;
    const failed = (projectId: ProjectId) => ({
      ...thread({ state: 'failed', attemptId: 'a1', stateReason: 'publication_failed:{}' }),
      projectId,
    });
    const pushBefore = pushFailuresByMountOf({ threads: [failed(PROJECT_A)], mountOf });
    const pushAfter = pushFailuresByMountOf({
      threads: [failed(PROJECT_A), failed(PROJECT_B)],
      mountOf,
    });

    const notices = resolveAttentionNotices({
      before: { ...NONE, pushFailed: 1 },
      after: { ...NONE, pushFailed: 2 },
      sessionId: SESSION,
      pushBefore,
      pushAfter,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      action: { kind: 'open-place', reason: 'push-failed', mountId: MOUNT_B },
      coalesceKey: `push-failed:${SESSION}:${MOUNT_B}`,
    });
  });

  it('counts a note push failure under no mount', () => {
    expect(
      pushFailuresByMountOf({
        threads: [
          thread({
            state: 'failed',
            attemptId: 'a1',
            stateReason: 'publication_failed:{}',
            originKind: 'diff_comment',
          }),
        ],
        mountOf: () => MOUNT_A,
      }).size,
    ).toBe(0);
  });
});
