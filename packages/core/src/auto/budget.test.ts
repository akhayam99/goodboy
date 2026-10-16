import { describe, expect, it } from 'vitest';
import {
  autoBudgetLabel,
  autoBudgetOf,
  autoBudgetPromptLine,
  autoBudgetUsedUsd,
  capTextOf,
} from './budget';

describe('auto budget facts', () => {
  it('rounds to cents once, so the prompt and the screen show the same numbers', () => {
    const facts = autoBudgetOf({
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
    const facts = autoBudgetOf({
      spend: { capUsd: 1, settledUsd: 1.2, reservedUsd: 0, remainingUsd: -0.2, estimatedUsd: 0.5 },
    });
    expect(facts.remainingUsd).toBe(0);
    expect(facts.hasEstimate).toBe(true);
    expect(autoBudgetLabel({ facts })).toBe('1.20 USD of 1.00 USD, estimated');
  });

  it('writes the same figures into the prompt line', () => {
    const facts = autoBudgetOf({
      spend: { capUsd: 5, settledUsd: 0.75, reservedUsd: 1.5, remainingUsd: 2.75, estimatedUsd: 0 },
    });
    expect(autoBudgetLabel({ facts })).toBe('0.75 USD of 5.00 USD');
    expect(autoBudgetPromptLine({ facts })).toBe(
      'Budget for this conversation: 5.00 USD. Spent 0.75 USD. Reserved for running agents 1.50 USD. Left 2.75 USD.',
    );
  });

  it('names the limit and the used amount from the same facts', () => {
    const facts = autoBudgetOf({
      spend: { capUsd: 5, settledUsd: 3.82, reservedUsd: 0.5, remainingUsd: 0.68, estimatedUsd: 0 },
    });
    expect(capTextOf({ facts })).toBe('Limit $5.00');
    expect(autoBudgetUsedUsd({ facts })).toBe(4.32);
  });
});
