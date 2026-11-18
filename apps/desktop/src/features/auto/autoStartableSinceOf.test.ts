import { describe, expect, it } from 'vitest';
import { aDelegation, aTree, FIXTURE_NOW } from './testing/autoViewFixtures';
import { autoStartableSinceOf } from './autoStartableSinceOf';

const QUEUED = aDelegation({ key: 'tester', role: 'tester', state: 'accepted' });

describe('autoStartableSinceOf', () => {
  it('says a queued child waits while four agents run', () => {
    expect(
      autoStartableSinceOf({
        tree: aTree({ phase: 'waiting' }),
        runSlots: { running: 4, freedAt: 0 },
        delegation: QUEUED,
      }),
    ).toBeNull();
  });

  it('starts the clock when a running agent ended', () => {
    expect(
      autoStartableSinceOf({
        tree: aTree({ phase: 'waiting' }),
        runSlots: { running: 3, freedAt: FIXTURE_NOW + 90_000 },
        delegation: QUEUED,
      }),
    ).toBe(FIXTURE_NOW + 90_000);
  });

  it('frees the slot of an attempt that ended while its delegation still waits for the batch', () => {
    expect(
      autoStartableSinceOf({
        tree: aTree({ phase: 'waiting' }),
        runSlots: { running: 0, freedAt: FIXTURE_NOW + 120_000 },
        delegation: QUEUED,
      }),
    ).toBe(FIXTURE_NOW + 120_000);
  });

  it('says a queued child waits while the Lead answers or the run is blocked', () => {
    expect(
      autoStartableSinceOf({
        tree: { ...aTree({ phase: 'deciding' }), activeRunId: 'run-harborline' },
        runSlots: { running: 0, freedAt: 0 },
        delegation: QUEUED,
      }),
    ).toBeNull();
    expect(
      autoStartableSinceOf({
        tree: aTree({ phase: 'blocked' }),
        runSlots: { running: 0, freedAt: 0 },
        delegation: QUEUED,
      }),
    ).toBeNull();
  });

  it('dates a starting child from the moment it took its slot', () => {
    const starting = { ...QUEUED, state: 'starting' as const, deadlineAt: FIXTURE_NOW + 3_600_000 };
    expect(
      autoStartableSinceOf({
        tree: aTree({ phase: 'waiting' }),
        runSlots: { running: 1, freedAt: 0 },
        delegation: starting,
      }),
    ).toBe(FIXTURE_NOW + 1_800_000);
  });
});
