import { describe, expect, it } from 'vitest';
import {
  autoBudgetLabel,
  autoBudgetOf,
  autoBudgetPromptLine,
  autoBudgetUsedUsd,
  autoRemainingForGates,
  autoTreeSpendOf,
  capTextOf,
} from './budget';

describe('auto budget facts', () => {
  it('rounds to cents once, so the prompt and the screen show the same numbers', () => {
    const facts = autoBudgetOf({
      spend: {
        capUsd: 5,
        settledUsd: 0.7449999,
        liveUsd: 0,
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
      spend: {
        capUsd: 1,
        settledUsd: 1.2,
        liveUsd: 0,
        reservedUsd: 0,
        remainingUsd: -0.2,
        estimatedUsd: 0.5,
      },
    });
    expect(facts.remainingUsd).toBe(0);
    expect(facts.hasEstimate).toBe(true);
    expect(autoBudgetLabel({ facts })).toBe('1.20 USD of 1.00 USD, estimated');
  });

  it('counts what running children spent so far as spent', () => {
    const facts = autoBudgetOf({
      spend: autoTreeSpendOf({
        capUsd: 50,
        settledUsd: 1.25,
        liveUsd: 4.1,
        reservedUsd: 0,
        estimatedUsd: 0,
      }),
    });
    expect(facts.spentUsd).toBe(5.35);
    expect(facts.remainingUsd).toBe(44.65);
  });

  it('writes the same figures into the prompt line and speaks of no reserved money', () => {
    const facts = autoBudgetOf({
      spend: autoTreeSpendOf({
        capUsd: 5,
        settledUsd: 0.75,
        liveUsd: 1.5,
        reservedUsd: 0,
        estimatedUsd: 0,
      }),
    });
    expect(autoBudgetLabel({ facts })).toBe('2.25 USD of 5.00 USD');
    expect(autoBudgetPromptLine({ facts, turnReservedUsd: 0 })).toBe(
      'Budget for this conversation: 5.00 USD. Spent 2.25 USD. Left 2.75 USD.',
    );
  });

  it('names the limit and the used amount from the same facts', () => {
    const facts = autoBudgetOf({
      spend: {
        capUsd: 5,
        settledUsd: 3.82,
        liveUsd: 0,
        reservedUsd: 0.5,
        remainingUsd: 0.68,
        estimatedUsd: 0,
      },
    });
    expect(capTextOf({ facts })).toBe('Limit $5.00');
    expect(autoBudgetUsedUsd({ facts })).toBe(4.32);
  });

  it('says No cap and never prints a left when the cap is missing', () => {
    const facts = autoBudgetOf({
      spend: {
        capUsd: null,
        settledUsd: 3.82,
        liveUsd: 0,
        reservedUsd: 0,
        remainingUsd: null,
        estimatedUsd: 0,
      },
    });
    expect(facts).toMatchObject({ capUsd: null, remainingUsd: null });
    expect(capTextOf({ facts })).toBe('No cap');
    expect(autoBudgetLabel({ facts })).toBe('3.82 USD, no cap');
    expect(autoBudgetPromptLine({ facts, turnReservedUsd: 0 })).toBe(
      'Budget for this conversation: no cap. Spent 3.82 USD.',
    );
  });

  it('lets the gates pass a missing cap and stop a missing tree', () => {
    expect(
      autoRemainingForGates({
        spend: {
          capUsd: null,
          settledUsd: 9,
          liveUsd: 0,
          reservedUsd: 0,
          remainingUsd: null,
          estimatedUsd: 0,
        },
      }),
    ).toBe(Number.POSITIVE_INFINITY);
    expect(autoRemainingForGates({ spend: null })).toBe(0);
  });

  it('counts the hold of the answer the line is delivered with, and names it', () => {
    const facts = autoBudgetOf({
      spend: autoTreeSpendOf({
        capUsd: 5,
        settledUsd: 3.82,
        liveUsd: 0,
        reservedUsd: 0.5,
        estimatedUsd: 0,
      }),
    });
    expect(autoBudgetPromptLine({ facts, turnReservedUsd: 0.5 })).toBe(
      'Budget for this conversation: 5.00 USD. Spent 3.82 USD. Held 0.50 USD for this answer. Left 0.68 USD.',
    );
  });

  it('computes what is left from cap, spent, live and held in one place', () => {
    expect(
      autoTreeSpendOf({
        capUsd: 10,
        settledUsd: 0.27,
        liveUsd: 3,
        reservedUsd: 0.5,
        estimatedUsd: 0,
      }),
    ).toEqual({
      capUsd: 10,
      settledUsd: 0.27,
      liveUsd: 3,
      reservedUsd: 0.5,
      remainingUsd: 10 - 0.27 - 3 - 0.5,
      estimatedUsd: 0,
    });
  });

  it('leaves no remainder for a missing cap in the one formula', () => {
    expect(
      autoTreeSpendOf({
        capUsd: null,
        settledUsd: 0.27,
        liveUsd: 3,
        reservedUsd: 0.5,
        estimatedUsd: 0,
      }).remainingUsd,
    ).toBeNull();
  });
});
