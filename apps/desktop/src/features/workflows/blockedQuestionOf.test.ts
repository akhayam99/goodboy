// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { blockedQuestionOf } from './blockedQuestionOf';

const AT: IsoDateTime = JSON.parse('"2026-10-16T15:00:00.000Z"');
const RUN: ProviderRunId = JSON.parse('"mock-blocked-run"');

type ReplyParams = {
  readonly text: string;
};

const replyOf = ({ text }: ReplyParams): ReadonlyArray<TurnEvent> => [
  { kind: 'user_text', runId: RUN, text: 'Check the settings page and open the draft PR.', at: AT },
  { kind: 'assistant_text', runId: RUN, delta: text, at: AT },
  { kind: 'done', runId: RUN, at: AT },
];

describe('blockedQuestionOf', () => {
  it('returns the question the step agent closed with', () => {
    const question = blockedQuestionOf({
      events: replyOf({
        text: 'The checks are green on ledger-core.\n\nShould I push to feat-patient-settings or open a new branch?',
      }),
    });

    expect(question).toEqual({
      text: 'Should I push to feat-patient-settings or open a new branch?',
      isQuestion: true,
    });
  });

  it('falls back to the closing paragraph when the agent asked nothing in a question form', () => {
    const question = blockedQuestionOf({
      events: replyOf({
        text: 'Checked the checks.\n\nThe push is rejected by the pre-push hook in payments-api.',
      }),
    });

    expect(question).toEqual({
      text: 'The push is rejected by the pre-push hook in payments-api.',
      isQuestion: false,
    });
  });

  it('never cuts the closing paragraph in the middle of a word', () => {
    const question = blockedQuestionOf({
      events: replyOf({ text: `${'ledger '.repeat(100)}end` }),
    });

    expect(question?.isQuestion).toBe(false);
    expect(question?.text.endsWith('ledger…')).toBe(true);
    expect(question?.text.length).toBeLessThanOrEqual(501);
  });

  it('joins only the last reply, not an earlier turn of the same agent', () => {
    const earlier: ReadonlyArray<TurnEvent> = [
      {
        kind: 'assistant_text',
        runId: JSON.parse('"mock-blocked-run-earlier"'),
        delta: 'Do you want me to start?',
        at: AT,
      },
    ];
    const question = blockedQuestionOf({
      events: [...earlier, ...replyOf({ text: 'Waiting on the stale symlink in payments-api.' })],
    });

    expect(question?.text).toBe('Waiting on the stale symlink in payments-api.');
  });

  it('returns null while the agent has said nothing', () => {
    expect(blockedQuestionOf({ events: [] })).toBeNull();
  });
});
