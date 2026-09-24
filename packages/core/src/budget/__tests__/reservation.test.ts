import { describe, expect, it } from 'vitest';
import { estimateSpendReservation } from '../reservation';

describe('estimateSpendReservation', () => {
  it('commits a positive priced estimate without presenting it as usage', () => {
    const reservation = estimateSpendReservation({
      providerId: 'codex',
      model: 'gpt-5.6-sol',
      prompt: 'implement the requested change',
    });

    expect(reservation.estimatedSpendUsd).toBeGreaterThan(0);
    expect(reservation.allowOverBudget).toBe(false);
  });

  it('uses a conservative commitment for an unpriced provider', () => {
    const reservation = estimateSpendReservation({
      providerId: 'openrouter',
      model: 'unpriced',
      prompt: 'inspect this repository',
    });

    expect(reservation.estimatedSpendUsd).toBe(0.25);
  });
});
