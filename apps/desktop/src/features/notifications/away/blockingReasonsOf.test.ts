import { describe, expect, it } from 'vitest';
import type { SessionAttentionReason, SessionStageInfo } from '@goodboy/types';
import { ATTENTION_REASON_META } from '../../session/session-stage';
import { blockingReasonsOf } from './blockingReasonsOf';

const infoOf = (
  attention: SessionAttentionReason | null,
  otherReasons: ReadonlyArray<SessionAttentionReason> = [],
): SessionStageInfo => ({
  stage: 'attention',
  reason: '',
  addsFact: false,
  attention,
  prState: null,
  otherReasons,
});

const isReason = (value: string): value is SessionAttentionReason => value in ATTENTION_REASON_META;

const ALL = Object.keys(ATTENTION_REASON_META).filter(
  (key): key is SessionAttentionReason => key in ATTENTION_REASON_META,
);

describe('the reasons that raise a banner', () => {
  it('lists a question, an approval, a plan approval, an agent error, a push failure and failing checks', () => {
    const blocking = ALL.filter(
      (reason) => blockingReasonsOf({ info: infoOf(reason) }).length === 1,
    );

    expect(blocking.sort()).toEqual([
      'agent-error',
      'ci-failed',
      'needs-approval',
      'open-question',
      'plan-approval',
      'push-failed',
    ]);
  });

  it('leaves a quiet reply, a queued pull request and the other waits to the badge', () => {
    for (const reason of [
      'unread-reply',
      'pr-queued',
      'pr-approved',
      'changes-requested',
      'run-waits-for-go',
      'auto-needs-you',
    ] as const) {
      expect(blockingReasonsOf({ info: infoOf(reason) })).toEqual([]);
    }
  });

  it('reads the reasons behind the first one too', () => {
    expect(
      blockingReasonsOf({ info: infoOf('changes-requested', ['open-question', 'ci-failed']) }),
    ).toEqual(['open-question', 'ci-failed']);
  });

  it('reads nothing from a session that needs nothing', () => {
    expect(blockingReasonsOf({ info: infoOf(null) })).toEqual([]);
  });
});
