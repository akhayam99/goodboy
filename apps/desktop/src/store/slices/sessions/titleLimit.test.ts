import { describe, expect, it } from 'vitest';
import { clampTitle, MAX_SESSION_TITLE_LENGTH } from './titleLimit';

describe('clampTitle', () => {
  it('keeps a title within the limit as typed, trimmed', () => {
    expect(clampTitle('  Fix the auth redirect  ')).toBe('Fix the auth redirect');
  });

  it('cuts a long title at a word and marks the cut', () => {
    const title = clampTitle(
      '[ACME-412] Checkout fails when the promo code field is left empty and the user taps Pay',
    );
    expect(title).toBe('[ACME-412] Checkout fails when the promo code field is left…');
    expect(title.length).toBeLessThanOrEqual(MAX_SESSION_TITLE_LENGTH);
  });

  it('cuts unbroken text at the limit', () => {
    const title = clampTitle('x'.repeat(200));
    expect(title).toBe(`${'x'.repeat(MAX_SESSION_TITLE_LENGTH - 1)}…`);
  });
});
