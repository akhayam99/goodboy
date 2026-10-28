// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isSameIntent } from './isSameIntent';

describe('isSameIntent', () => {
  it('matches a planned step that restates a done step in other words', () => {
    expect(
      isSameIntent({
        left: 'Verifica check e apri PR draft per feat-patient-settings',
        right: 'Verificare check verdi, pushare e aprire la PR draft per feat-patient-settings',
      }),
    ).toBe(true);
  });

  it('keeps two different steps apart even when they share a verb', () => {
    expect(
      isSameIntent({ left: 'Verify the ledger tests', right: 'Verify the notify-relay lint' }),
    ).toBe(false);
  });

  it('never matches an empty text', () => {
    expect(isSameIntent({ left: '', right: 'Prove the batching' })).toBe(false);
  });
});
