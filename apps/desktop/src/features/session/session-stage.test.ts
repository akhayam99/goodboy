// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionAttentionReason, SessionStageInfo } from '@goodboy/types';
import {
  ATTENTION_REASON_META,
  attentionWordsOf,
  describeSessionStage,
  describeStageBucket,
  otherAttentionLinesOf,
} from './session-stage';
import { stateDescription } from '../../shared/utils/statePresentation';

const REASONS = Object.keys(ATTENTION_REASON_META) as ReadonlyArray<SessionAttentionReason>;

const info = (over: Partial<SessionStageInfo>): SessionStageInfo => ({
  stage: 'building',
  reason: '',
  addsFact: true,
  attention: null,
  prState: null,
  ...over,
});

describe('describeSessionStage', () => {
  it('separates an approval from a failure the user must repair', () => {
    const approved = describeSessionStage(info({ stage: 'attention', attention: 'pr-approved' }));
    const errored = describeSessionStage(info({ stage: 'attention', attention: 'agent-error' }));

    expect(approved.tone).toBe('success');
    expect(errored.tone).toBe('danger');
    expect(approved.icon).not.toBe(errored.icon);
    expect(approved.reason).not.toBe(errored.reason);
  });

  it('describes a session in the merge queue as in review, in its own calm tone and words', () => {
    const queued = describeSessionStage(
      info({ stage: 'review', attention: 'pr-queued', reason: 'PR #327 in the merge queue' }),
    );

    expect(queued).toMatchObject({
      label: 'in review',
      reason: 'PR #327 in the merge queue',
      tone: 'primary',
    });
    expect(attentionWordsOf({ reason: 'pr-queued' })).toBe('In merge queue');
    expect(ATTENTION_REASON_META['pr-queued']).toMatchObject({ mark: 'queue', tone: 'primary' });
    expect(queued.tone).not.toBe(
      describeSessionStage(info({ stage: 'attention', attention: 'pr-approved' })).tone,
    );
  });

  it('stops a closed pull request from reading as an integrated one', () => {
    const merged = describeSessionStage(info({ stage: 'done', prState: 'merged' }));
    const closed = describeSessionStage(info({ stage: 'done', prState: 'closed' }));

    expect(merged.tone).toBe('merged');
    expect(closed.tone).toBe('neutral');
    expect(merged.icon).not.toBe(closed.icon);
  });

  it('keeps the caller reason when the caller has a more specific one', () => {
    const described = describeSessionStage(
      info({ stage: 'done', reason: 'PR #12 closed', prState: 'closed' }),
    );

    expect(described.reason).toBe('PR #12 closed');
    expect(stateDescription({ presentation: described })).toBe('done, PR #12 closed');
  });

  it('falls back to the stage reason when the caller has none', () => {
    expect(describeSessionStage(info({ stage: 'building' })).reason).toBe(
      'Work in progress, nothing to review yet',
    );
  });

  it('gives every attention reason its own explanation', () => {
    const explanations = new Set(REASONS.map((reason) => ATTENTION_REASON_META[reason].reason));

    expect(explanations.size).toBe(REASONS.length);
    for (const reason of REASONS) {
      expect(ATTENTION_REASON_META[reason].reason.length, reason).toBeGreaterThan(0);
    }
  });
});

describe('describeStageBucket', () => {
  it('describes a stage column with no session behind it', () => {
    const done = describeStageBucket({ stage: 'done' });

    expect(done.label).toBe('done');
    expect(done.reason).toBe('Nothing left to do here');
    expect(done.tone).toBe('merged');
  });

  it('matches the session describer whenever there is nothing to distinguish', () => {
    expect(describeStageBucket({ stage: 'review' })).toEqual(
      describeSessionStage(info({ stage: 'review' })),
    );
  });
});

describe('the reason table', () => {
  it('draws red only for an agent error, a push that failed and failing checks', () => {
    expect(REASONS.filter((reason) => ATTENTION_REASON_META[reason].tone === 'danger')).toEqual([
      'agent-error',
      'push-failed',
      'ci-failed',
    ]);
  });

  it.each<[SessionAttentionReason, string, string, string]>([
    ['agent-error', '!', 'danger', 'An agent stopped on an error'],
    ['push-failed', '!', 'danger', "1 comment didn't go out"],
    ['ci-failed', '!', 'danger', 'Checks failing'],
    ['open-question', '?', 'warning', '1 question for you'],
    ['fix-needs-you', '?', 'warning', '1 comment needs you'],
    ['needs-approval', 'approval', 'warning', 'Waiting for your approval'],
    ['plan-approval', 'approval', 'warning', 'The plan waits for your approval'],
    ['changes-requested', '!', 'warning', 'Changes requested'],
    ['fix-couldnt-fix', '!', 'warning', "1 comment it couldn't fix"],
    ['pr-approved', 'approved', 'success', 'Approved, ready to merge'],
    ['unread-reply', 'none', 'info', 'New reply'],
  ])('gives %s the mark %s in %s with the words "%s"', (reason, mark, tone, words) => {
    expect(ATTENTION_REASON_META[reason]).toMatchObject({ mark, tone, words, reason: words });
  });
});

describe('attentionWordsOf', () => {
  it('pluralises from the count', () => {
    expect(attentionWordsOf({ reason: 'open-question', counts: { openQuestionCount: 1 } })).toBe(
      '1 question for you',
    );
    expect(attentionWordsOf({ reason: 'open-question', counts: { openQuestionCount: 4 } })).toBe(
      '4 questions for you',
    );
    expect(attentionWordsOf({ reason: 'fix-needs-you', counts: { fixNeedsYouCount: 3 } })).toBe(
      '3 comments need you',
    );
    expect(attentionWordsOf({ reason: 'fix-couldnt-fix', counts: { fixCouldntFixCount: 2 } })).toBe(
      "2 comments it couldn't fix",
    );
  });

  it('never says zero when the count is missing', () => {
    expect(attentionWordsOf({ reason: 'open-question' })).toBe('1 question for you');
    expect(attentionWordsOf({ reason: 'fix-needs-you', counts: { fixNeedsYouCount: 0 } })).toBe(
      '1 comment needs you',
    );
  });

  it('names the plan version when it is known and the plan otherwise', () => {
    expect(attentionWordsOf({ reason: 'plan-approval', planVersion: 2 })).toBe(
      'Plan v2 waits for your approval',
    );
    expect(attentionWordsOf({ reason: 'plan-approval' })).toBe('The plan waits for your approval');
  });
});

describe('otherAttentionLinesOf', () => {
  it('lists the facts behind the winner with their tone and words', () => {
    const lines = otherAttentionLinesOf({
      info: info({
        stage: 'attention',
        attention: 'pr-approved',
        otherReasons: ['open-question', 'ci-failed'],
        openQuestionCount: 2,
      }),
    });

    expect(lines).toEqual([
      { reason: 'open-question', tone: 'warning', words: '2 questions for you' },
      { reason: 'ci-failed', tone: 'danger', words: 'Checks failing' },
    ]);
  });

  it('lists nothing for a session without other facts', () => {
    expect(otherAttentionLinesOf({ info: info({}) })).toEqual([]);
  });
});
