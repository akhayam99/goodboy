import { describe, expect, it } from 'vitest';
import { aDelegation, aView, FIXTURE_NOW } from '../../../features/auto/testing/autoViewFixtures';
import { autoClockOf } from './autoClockOf';

const WAITING = aView({
  phase: 'waiting',
  delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'accepted' })],
});
const RUNNING = aView({
  phase: 'waiting',
  delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'running' })],
});

describe('autoClockOf', () => {
  it('moves the clock in 15 second steps while a child waits to start', () => {
    expect(autoClockOf({ views: [WAITING], now: FIXTURE_NOW + 61_000, previous: 0 })).toBe(
      FIXTURE_NOW + 60_000,
    );
  });

  it('leaves the clock alone when no child waits to start, so the board does not redraw', () => {
    expect(autoClockOf({ views: [RUNNING], now: FIXTURE_NOW + 61_000, previous: 7 })).toBe(7);
  });

  it('never moves the clock back', () => {
    expect(
      autoClockOf({ views: [WAITING], now: FIXTURE_NOW, previous: FIXTURE_NOW + 30_000 }),
    ).toBe(FIXTURE_NOW + 30_000);
  });
});
