import { describe, expect, it } from 'vitest';
import { FAN_OUT_MAX_CHILDREN } from '../roles';
import {
  AUTO_ATTEMPT_CEILING_USD,
  AUTO_BATCH_MAX_CHILDREN,
  AUTO_BATCH_MIN_CHILDREN,
  AUTO_AUX_RESERVATION_USD,
  AUTO_GATES,
  AUTO_GRANT_ALLOWANCE,
  AUTO_LEDGER_CHAR_BUDGET,
  AUTO_LEDGER_MAX_ARTIFACTS,
  AUTO_MAX_GRANTS_PER_TREE,
  AUTO_MAX_OPEN_CHILDREN,
  AUTO_TREE_DEPTH,
  AUTO_TREE_LIMITS,
  AUTO_TURN_CEILING_USD,
  attemptCeilingUsd,
  effectiveTreeLimits,
} from './limits';
import { AUTO_DELEGATION_ROLES } from './roles';

describe('Auto limits', () => {
  it('keeps delegation switched off', () => {
    expect(AUTO_GATES).toEqual({ isDelegationEnabled: false });
  });

  it('gives every delegable role one positive attempt ceiling and no other role', () => {
    expect(Object.keys(AUTO_ATTEMPT_CEILING_USD).sort()).toEqual([...AUTO_DELEGATION_ROLES].sort());
    for (const ceiling of Object.values(AUTO_ATTEMPT_CEILING_USD)) {
      expect(ceiling).toBeGreaterThan(0);
    }
    expect(AUTO_ATTEMPT_CEILING_USD.implementer).toBeGreaterThan(AUTO_ATTEMPT_CEILING_USD.scout);
  });

  it('holds the tree lifetime counters of the design', () => {
    expect(AUTO_TREE_LIMITS).toEqual({
      autoTurns: 30,
      delegations: 12,
      attempts: 20,
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
    expect(AUTO_TREE_DEPTH).toBe(1);
  });

  it('lets a user grant a fixed allowance, three times at most', () => {
    expect(AUTO_GRANT_ALLOWANCE).toEqual({ autoTurns: 6, delegations: 4, attempts: 4 });
    expect(AUTO_MAX_GRANTS_PER_TREE).toBe(3);
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

describe('effectiveTreeLimits', () => {
  it('is the base counters before any grant', () => {
    expect(effectiveTreeLimits({ grants: 0 })).toMatchObject({
      autoTurns: 30,
      delegations: 12,
      attempts: 20,
      delegateCallsPerTurn: 6,
      refusals: 10,
    });
  });

  it('adds the fixed allowance once per grant and nothing else', () => {
    expect(effectiveTreeLimits({ grants: 2 })).toMatchObject({
      autoTurns: 42,
      delegations: 20,
      attempts: 28,
      delegateCallsPerTurn: 6,
      refusals: 10,
      questionCyclesPerDelegation: 3,
    });
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
