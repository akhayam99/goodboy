import { describe, expect, it } from 'vitest';
import { briefFitOf } from './briefFitOf';

const measure = (text: string): number => text.length;

describe('briefFitOf', () => {
  it('keeps a brief that fits', () => {
    expect(briefFitOf({ text: 'Fix the stale knip cache', maxWidth: 30, measure })).toBe(
      'Fix the stale knip cache',
    );
  });

  it('cuts at a word edge and adds an ellipsis', () => {
    expect(
      briefFitOf({
        text: 'Find every caller of postCredit in payments-api',
        maxWidth: 24,
        measure,
      }),
    ).toBe('Find every caller of…');
  });

  it('never cuts inside a word', () => {
    const fit = briefFitOf({ text: 'Reproduce the double credit', maxWidth: 14, measure });
    expect(fit).toBe('Reproduce the…');
  });

  it('leaves a single long word to the css fallback', () => {
    expect(briefFitOf({ text: 'postCreditRetryGuard', maxWidth: 6, measure })).toBe(
      'postCreditRetryGuard',
    );
  });
});
