// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { firstSentenceOf } from './firstSentenceOf';

describe('firstSentenceOf', () => {
  it('cuts at the first sentence end and drops the period', () => {
    expect(firstSentenceOf({ text: 'Found 2 doc mismatches. The second is in payouts.' })).toBe(
      'Found 2 doc mismatches',
    );
  });

  it('keeps the first non empty line', () => {
    expect(firstSentenceOf({ text: '\n  Wrote the retry tests\nmore' })).toBe(
      'Wrote the retry tests',
    );
  });

  it('cuts a chained summary at the first arrow', () => {
    expect(firstSentenceOf({ text: 'apply fix -> verify tsc -> lint -> ready for push' })).toBe(
      'apply fix',
    );
    expect(firstSentenceOf({ text: 'Rebase onto main → resolve ledger-core conflict' })).toBe(
      'Rebase onto main',
    );
  });

  it('keeps an arrow that has no step before it', () => {
    expect(firstSentenceOf({ text: 'a->b stays' })).toBe('a->b stays');
  });

  it('takes the first done line of the orchestrator recap', () => {
    const recap = JSON.stringify({
      done: ['Batched the row reads in payments-api. Faster.', 'Wrote notes'],
      left: [{ text: 'Stream rows to CSV', role: 'implementer' }],
    });

    expect(firstSentenceOf({ text: recap })).toBe('Batched the row reads in payments-api');
  });

  it('returns null for a recap with no done line and for JSON it does not know', () => {
    expect(
      firstSentenceOf({ text: JSON.stringify({ done: [], left: ['Stream rows'] }) }),
    ).toBeNull();
    expect(firstSentenceOf({ text: '{"other":1}' })).toBeNull();
    expect(firstSentenceOf({ text: '{"done": [' })).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(firstSentenceOf({ text: null })).toBeNull();
    expect(firstSentenceOf({ text: '   ' })).toBeNull();
  });
});
