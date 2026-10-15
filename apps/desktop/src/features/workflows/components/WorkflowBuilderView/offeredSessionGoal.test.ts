// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { offeredSessionGoal } from './offeredSessionGoal';

const SLOTS = [
  { key: 'goal', value: '  Retry payments through ledger-core  ', enabled: true },
  { key: 'notes', value: 'Harborline', enabled: true },
];

const NO_GOAL = [{ key: 'notes', value: 'Harborline', enabled: true }];

describe('offeredSessionGoal', () => {
  it('offers the trimmed goal of a session that has one', () => {
    expect(offeredSessionGoal({ slots: SLOTS, isKickoff: false })).toBe(
      'Retry payments through ledger-core',
    );
  });

  it('offers nothing when the session has no goal slot', () => {
    expect(offeredSessionGoal({ slots: NO_GOAL, isKickoff: false })).toBe('');
    expect(offeredSessionGoal({ slots: [], isKickoff: false })).toBe('');
  });

  it('offers nothing on the New session page, even when a goal slot is present', () => {
    expect(offeredSessionGoal({ slots: SLOTS, isKickoff: true })).toBe('');
  });
});
