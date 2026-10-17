// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SESSION_TITLE_MAX_LENGTH } from '@goodboy/types';
import { clampTitle } from './titleLimit';

describe('clampTitle', () => {
  it('keeps a title within the limit as typed, trimmed', () => {
    expect(clampTitle('  Fix the auth redirect  ')).toBe('Fix the auth redirect');
  });

  it('keeps a title of exactly 120 characters whole', () => {
    const title = 'x'.repeat(120);
    expect(SESSION_TITLE_MAX_LENGTH).toBe(120);
    expect(clampTitle(title)).toBe(title);
  });

  it('cuts a long title at a word and marks the cut', () => {
    const title = clampTitle(
      '[ACME-412] Checkout fails when the promo code field is left empty and the user taps Pay, then the cart resets and the order is lost',
    );
    expect(title).toBe(
      '[ACME-412] Checkout fails when the promo code field is left empty and the user taps Pay, then the cart resets and the…',
    );
    expect(title.length).toBeLessThanOrEqual(SESSION_TITLE_MAX_LENGTH);
  });

  it('cuts unbroken text at the limit', () => {
    const title = clampTitle('x'.repeat(200));
    expect(title).toBe(`${'x'.repeat(SESSION_TITLE_MAX_LENGTH - 1)}…`);
  });
});
