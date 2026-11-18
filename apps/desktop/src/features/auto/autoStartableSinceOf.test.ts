import { describe, expect, it } from 'vitest';
import { aDelegation, aTree, FIXTURE_NOW } from './testing/autoViewFixtures';
import { autoStartableSinceOf } from './autoStartableSinceOf';

const QUEUED = aDelegation({ key: 'tester', role: 'tester', state: 'accepted' });
const RUNNING = ['a', 'b', 'c', 'd'].map((key) =>
  aDelegation({ key: `scout-${key}`, role: 'scout', state: 'running' }),
);

describe('autoStartableSinceOf', () => {
  it('says a queued child waits while four agents run', () => {
    expect(
      autoStartableSinceOf({
        tree: aTree({ phase: 'waiting' }),
        delegations: [...RUNNING, QUEUED],
        delegation: QUEUED,
      }),
    ).toBeNull();
  });

  it('starts the clock when a running agent ended', () => {
    const ended = aDelegation({
      key: 'scout-e',
      role: 'scout',
      state: 'settled',
      outcome: 'completed',
      settledAt: FIXTURE_NOW + 90_000,
    });
    expect(
      autoStartableSinceOf({
        tree: aTree({ phase: 'waiting' }),
        delegations: [ended, ...RUNNING.slice(1), QUEUED],
        delegation: QUEUED,
      }),
    ).toBe(FIXTURE_NOW + 90_000);
  });

  it('says a queued child waits while the Lead answers or the run is blocked', () => {
    expect(
      autoStartableSinceOf({
        tree: { ...aTree({ phase: 'deciding' }), activeRunId: 'run-harborline' },
        delegations: [QUEUED],
        delegation: QUEUED,
      }),
    ).toBeNull();
    expect(
      autoStartableSinceOf({
        tree: aTree({ phase: 'blocked' }),
        delegations: [QUEUED],
        delegation: QUEUED,
      }),
    ).toBeNull();
  });

  it('dates a starting child from the moment it took its slot', () => {
    const starting = { ...QUEUED, state: 'starting' as const, deadlineAt: FIXTURE_NOW + 3_600_000 };
    expect(
      autoStartableSinceOf({
        tree: aTree({ phase: 'waiting' }),
        delegations: [starting],
        delegation: starting,
      }),
    ).toBe(FIXTURE_NOW + 1_800_000);
  });
});
