import { describe, expect, it } from 'vitest';
import { FAN_OUT_MAX_CHILDREN } from '../roles';
import {
  AUTO_BATCH_MAX_CHILDREN,
  AUTO_BATCH_MIN_CHILDREN,
  AUTO_AUX_RESERVATION_USD,
  AUTO_GATES,
  AUTO_LEDGER_CHAR_BUDGET,
  AUTO_LEDGER_MAX_ARTIFACTS,
  AUTO_MAX_OPEN_CHILDREN,
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
      delegateCallsPerTurn: 6,
      refusals: 10,
      questionCyclesPerDelegation: 3,
      noProgressStreak: 3,
      wallClockHours: 24,
    });
  });

  it('batches one to four children, one level deep, like the fan-out cap', () => {
    expect(AUTO_BATCH_MIN_CHILDREN).toBe(1);
    expect(AUTO_BATCH_MAX_CHILDREN).toBe(FAN_OUT_MAX_CHILDREN);
    expect(AUTO_BATCH_MAX_CHILDREN).toBe(4);
    expect(AUTO_TREE_DEPTH).toBe(2);
    expect(AUTO_SUBSTEPS_PER_PARENT).toBe(2);
  });

  it('keeps the turn ceiling', () => {
    expect(AUTO_TURN_CEILING_USD).toBe(0.5);
  });
});

describe('registry constants', () => {
  it('keeps the open children at the batch cap and the ledger bounded', () => {
    expect(AUTO_MAX_OPEN_CHILDREN).toBe(AUTO_BATCH_MAX_CHILDREN);
    expect(AUTO_LEDGER_MAX_ARTIFACTS).toBe(20);
    expect(AUTO_LEDGER_CHAR_BUDGET).toBe(3000);
    expect(AUTO_AUX_RESERVATION_USD).toBeGreaterThan(0);
    expect(AUTO_AUX_RESERVATION_USD).toBeLessThan(AUTO_TURN_CEILING_USD);
  });
});
