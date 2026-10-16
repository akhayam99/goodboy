import { describe, expect, it } from 'vitest';
import { autoBudgetFacts, autoBudgetLabel, autoBudgetPromptLine, autoTreeSpendOf } from './budget';

describe('auto budget facts', () => {
  it('rounds to cents once, so the prompt and the screen show the same numbers', () => {
    const facts = autoBudgetFacts({
      spend: {
        capUsd: 5,
        settledUsd: 0.7449999,
        reservedUsd: 1.5,
        remainingUsd: 2.7550001,
        estimatedUsd: 0,
      },
    });
    expect(facts).toEqual({
      capUsd: 5,
      spentUsd: 0.74,
      reservedUsd: 1.5,
      remainingUsd: 2.76,
      hasEstimate: false,
    });
  });

  it('never shows a negative remainder and flags an estimated cost', () => {
    const facts = autoBudgetFacts({
      spend: { capUsd: 1, settledUsd: 1.2, reservedUsd: 0, remainingUsd: -0.2, estimatedUsd: 0.5 },
    });
    expect(facts.remainingUsd).toBe(0);
    expect(facts.hasEstimate).toBe(true);
    expect(autoBudgetLabel({ facts })).toBe('1.20 USD of 1.00 USD, estimated');
  });

  it('writes the same figures into the prompt line', () => {
    const facts = autoBudgetFacts({
      spend: { capUsd: 5, settledUsd: 0.75, reservedUsd: 1.5, remainingUsd: 2.75, estimatedUsd: 0 },
    });
    expect(autoBudgetLabel({ facts })).toBe('0.75 USD of 5.00 USD');
    expect(autoBudgetPromptLine({ facts, turnReservedUsd: 0 })).toBe(
      'Budget for this conversation: 5.00 USD. Spent 0.75 USD. Reserved for running agents 1.50 USD. Left 2.75 USD.',
    );
  });

  it('counts the reservation of the answer the line is delivered with, and names it', () => {
    const facts = autoBudgetFacts({
      spend: autoTreeSpendOf({ capUsd: 5, settledUsd: 3.82, reservedUsd: 0.5, estimatedUsd: 0 }),
    });
    expect(autoBudgetPromptLine({ facts, turnReservedUsd: 0.5 })).toBe(
      'Budget for this conversation: 5.00 USD. Spent 3.82 USD. Reserved 0.50 USD, of which 0.50 USD for this answer. Left 0.68 USD.',
    );
  });

  it('computes what is left from cap, spent and reserved in one place', () => {
    expect(
      autoTreeSpendOf({ capUsd: 10, settledUsd: 0.27, reservedUsd: 4.5, estimatedUsd: 0 }),
    ).toEqual({
      capUsd: 10,
      settledUsd: 0.27,
      reservedUsd: 4.5,
      remainingUsd: 10 - 0.27 - 4.5,
      estimatedUsd: 0,
    });
  });
});
