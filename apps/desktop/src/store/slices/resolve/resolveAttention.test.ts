import { describe, expect, it } from 'vitest';
import type { ResolveAttempt, ResolveThread, SessionId } from '@goodboy/types';
import { resolveAttentionNotices, resolveAttentionOf } from './resolveAttention';

const SESSION = 'session-1' as SessionId;

type Thread = Pick<ResolveThread, 'state' | 'stateReason' | 'activeAttemptId'>;
type Attempt = Pick<ResolveAttempt, 'id' | 'failureCause' | 'phase'>;

const thread = ({
  state,
  attemptId = null,
  stateReason = null,
}: {
  readonly state: ResolveThread['state'];
  readonly attemptId?: string | null;
  readonly stateReason?: string | null;
}): Thread => ({ state, stateReason, activeAttemptId: attemptId });

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

    expect(attention).toEqual({ needsYou: 1, couldntFix: 1 });
  });

  it('does not raise attention for a run you stopped or a push that failed', () => {
    const attention = resolveAttentionOf({
      threads: [
        thread({ state: 'failed', attemptId: 'a1' }),
        thread({ state: 'failed', attemptId: 'a2', stateReason: 'publication_failed:{}' }),
      ],
      attempts: [attempt({ id: 'a1', cause: 'stopped' }), attempt({ id: 'a2', cause: null })],
    });

    expect(attention).toEqual({ needsYou: 0, couldntFix: 0 });
  });
});

describe('resolveAttentionNotices', () => {
  const NONE = { needsYou: 0, couldntFix: 0 };

  it('tells you once when a comment starts to need you', () => {
    const notices = resolveAttentionNotices({
      before: NONE,
      after: { needsYou: 1, couldntFix: 0 },
      sessionId: SESSION,
    });

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      title: 'A fix run needs you',
      body: '1 comment waits for your answer.',
      sessionId: SESSION,
      action: { kind: 'open-activity', sessionId: SESSION },
    });
  });

  it('tells you when comments could not be fixed, with the count', () => {
    const notices = resolveAttentionNotices({
      before: NONE,
      after: { needsYou: 0, couldntFix: 3 },
      sessionId: SESSION,
    });

    expect(notices.map((notice) => notice.title)).toEqual(["A fix run couldn't fix 3 comments"]);
  });

  it('says both when both rose and nothing when nothing rose', () => {
    expect(
      resolveAttentionNotices({
        before: NONE,
        after: { needsYou: 1, couldntFix: 1 },
        sessionId: SESSION,
      }),
    ).toHaveLength(2);
    expect(
      resolveAttentionNotices({
        before: { needsYou: 2, couldntFix: 1 },
        after: { needsYou: 2, couldntFix: 0 },
        sessionId: SESSION,
      }),
    ).toEqual([]);
  });
});
