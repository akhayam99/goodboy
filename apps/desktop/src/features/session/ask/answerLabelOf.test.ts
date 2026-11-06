import { describe, expect, it } from 'vitest';
import { answerLabelOf } from './answerLabelOf';

describe('answerLabelOf', () => {
  it('names a short question by its words', () => {
    expect(answerLabelOf({ text: 'Keep the 5 retries?', number: 2 })).toBe(
      'Answer: Keep the 5 retries?',
    );
  });

  it('cuts a long question and folds its white space', () => {
    expect(
      answerLabelOf({
        text: 'Should the webhook\nretry after the ledger-core outage ends or stop at once?',
        number: 1,
      }),
    ).toBe('Answer: Should the webhook retry after…');
  });

  it('falls back to the number when the question has no words', () => {
    expect(answerLabelOf({ text: '  ', number: 3 })).toBe('Answer question 3');
  });
});
