import { describe, expect, it } from 'vitest';
import {
  AUTO_BATCH_MIN_CHILDREN,
  AUTO_AUX_RESERVATION_USD,
  AUTO_GATES,
  AUTO_LEDGER_CHAR_BUDGET,
  AUTO_LEDGER_MAX_ARTIFACTS,
  AUTO_MAX_RUNNING_CHILDREN,
  AUTO_RETURNS_WINDOW_MS,
  AUTO_SUBSTEPS_PER_PARENT,
  AUTO_TREE_DEPTH,
  AUTO_TREE_LIMITS,
  AUTO_TURN_CEILING_USD,
} from './limits';

describe('Auto limits', () => {
  it('ships delegation released, entry still behind the experiment switch', () => {
    expect(AUTO_GATES).toEqual({ isDelegationEnabled: true });
  });
  it('holds the guards that protect the user and no fixed count of agents, runs or turns', () => {
    expect(AUTO_TREE_LIMITS).toEqual({
      questionCyclesPerDelegation: 3,
      noProgressStreak: 3,
      returnsPerDelegation: 2,
      rebriefsPerTask: 3,
      returnsPerTreeWindow: 6,
    });
    expect(AUTO_RETURNS_WINDOW_MS).toBe(30 * 60_000);
  });

  it('batches one child or more, runs four at once, one level deep', () => {
    expect(AUTO_BATCH_MIN_CHILDREN).toBe(1);
    expect(AUTO_MAX_RUNNING_CHILDREN).toBe(4);
    expect(AUTO_TREE_DEPTH).toBe(2);
    expect(AUTO_SUBSTEPS_PER_PARENT).toBe(2);
  });

  it('keeps the turn ceiling', () => {
    expect(AUTO_TURN_CEILING_USD).toBe(0.5);
  });
});

describe('registry constants', () => {
  it('keeps the ledger bounded', () => {
    expect(AUTO_LEDGER_MAX_ARTIFACTS).toBe(20);
    expect(AUTO_LEDGER_CHAR_BUDGET).toBe(3000);
    expect(AUTO_AUX_RESERVATION_USD).toBeGreaterThan(0);
    expect(AUTO_AUX_RESERVATION_USD).toBeLessThan(AUTO_TURN_CEILING_USD);
  });
});
