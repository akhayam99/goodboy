// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isSameIntent } from './isSameIntent';

describe('isSameIntent', () => {
  it('matches a step that repeats another one apart from case, spacing and punctuation', () => {
    expect(
      isSameIntent({
        left: 'Verify the checks, and open the draft PR for feat-settings.',
        right: '  verify the CHECKS and open the draft pr for feat settings ',
      }),
    ).toBe(true);
  });

  it('keeps a step apart when it only restates another one in other words', () => {
    expect(
      isSameIntent({
        left: 'Verifica check e apri PR draft per feat-patient-settings',
        right: 'Verificare check verdi, pushare e aprire la PR draft per feat-patient-settings',
      }),
    ).toBe(false);
  });

  it('keeps two steps apart when one word flips the meaning', () => {
    expect(
      isSameIntent({
        left: 'Add tests for valid payments',
        right: 'Add tests for invalid payments',
      }),
    ).toBe(false);
    expect(isSameIntent({ left: 'Enable logging', right: 'Disable logging' })).toBe(false);
  });

  it('keeps two different steps apart even when they share a verb', () => {
    expect(
      isSameIntent({ left: 'Verify the ledger tests', right: 'Verify the notify-relay lint' }),
    ).toBe(false);
  });

  it('never matches an empty text', () => {
    expect(isSameIntent({ left: '', right: 'Prove the batching' })).toBe(false);
    expect(isSameIntent({ left: '...', right: '' })).toBe(false);
  });
});
