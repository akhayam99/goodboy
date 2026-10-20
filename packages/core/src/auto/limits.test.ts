import { describe, expect, it } from 'vitest';
import { FAN_OUT_MAX_CHILDREN } from '../roles';
import {
  AUTO_ATTEMPT_CEILING_USD,
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
  attemptCeilingUsd,
} from './limits';
import { AUTO_DELEGATION_ROLES } from './roles';

describe('Auto limits', () => {
  it('ships delegation released, entry still behind the experiment switch', () => {
    expect(AUTO_GATES).toEqual({ isDelegationEnabled: true });
  });

  it('gives every delegable role one positive attempt ceiling and no other role', () => {
    expect(Object.keys(AUTO_ATTEMPT_CEILING_USD).sort()).toEqual([...AUTO_DELEGATION_ROLES].sort());
    for (const ceiling of Object.values(AUTO_ATTEMPT_CEILING_USD)) {
      expect(ceiling).toBeGreaterThan(0);
    }
    expect(AUTO_ATTEMPT_CEILING_USD.implementer).toBeGreaterThan(AUTO_ATTEMPT_CEILING_USD.scout);
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

describe('attemptCeilingUsd', () => {
  it('is the role ceiling while the tree has room', () => {
    expect(attemptCeilingUsd({ role: 'implementer', remainingUsd: 5 })).toBe(3);
    expect(attemptCeilingUsd({ role: 'scout', remainingUsd: 5 })).toBe(0.5);
  });

  it('is capped to what remains', () => {
    expect(attemptCeilingUsd({ role: 'implementer', remainingUsd: 1.25 })).toBe(1.25);
  });

  it('is zero when nothing remains, never negative', () => {
    expect(attemptCeilingUsd({ role: 'tester', remainingUsd: 0 })).toBe(0);
    expect(attemptCeilingUsd({ role: 'tester', remainingUsd: -2 })).toBe(0);
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
