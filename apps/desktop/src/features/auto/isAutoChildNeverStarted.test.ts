import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { aDelegation, FIXTURE_NOW } from './testing/autoViewFixtures';
import { isAutoChildNeverStarted } from './isAutoChildNeverStarted';

const NEVER_STARTED_MS = 60_000;

const QUEUED = aDelegation({ key: 'fixer', role: 'implementer', state: 'accepted' });
const CHILD = anAgent({ id: brandId<AgentId>({ value: 'agent-fixer' }) });

describe('isAutoChildNeverStarted', () => {
  it('stays queued at 59 seconds', () => {
    expect(
      isAutoChildNeverStarted({
        delegation: QUEUED,
        childAgent: CHILD,
        now: FIXTURE_NOW + NEVER_STARTED_MS - 1000,
        startableSince: FIXTURE_NOW,
      }),
    ).toBe(false);
  });

  it('flips at 60 seconds', () => {
    expect(
      isAutoChildNeverStarted({
        delegation: QUEUED,
        childAgent: CHILD,
        now: FIXTURE_NOW + NEVER_STARTED_MS,
        startableSince: FIXTURE_NOW,
      }),
    ).toBe(true);
  });

  it('counts a child whose row was never written', () => {
    expect(
      isAutoChildNeverStarted({
        delegation: { ...QUEUED, state: 'starting' },
        childAgent: null,
        now: FIXTURE_NOW + 120_000,
        startableSince: FIXTURE_NOW,
      }),
    ).toBe(true);
  });

  it('clears when the child started at 61 seconds', () => {
    const started = anAgent({
      id: CHILD.id,
      startedAt: brandId<IsoDateTime>({ value: new Date(FIXTURE_NOW + 61_000).toISOString() }),
    });
    expect(
      isAutoChildNeverStarted({
        delegation: QUEUED,
        childAgent: started,
        now: FIXTURE_NOW + 61_000,
        startableSince: FIXTURE_NOW,
      }),
    ).toBe(false);
  });

  it('never blames a child that waits for a running agent to end', () => {
    expect(
      isAutoChildNeverStarted({
        delegation: QUEUED,
        childAgent: null,
        now: FIXTURE_NOW + 600_000,
        startableSince: null,
      }),
    ).toBe(false);
  });

  it('counts the minute from when a slot came free, not from the hand over', () => {
    expect(
      isAutoChildNeverStarted({
        delegation: QUEUED,
        childAgent: null,
        now: FIXTURE_NOW + 600_000,
        startableSince: FIXTURE_NOW + 590_000,
      }),
    ).toBe(false);
  });

  it('never blames a delegation that waits on you', () => {
    expect(
      isAutoChildNeverStarted({
        delegation: { ...QUEUED, state: 'awaiting_confirm' },
        childAgent: CHILD,
        now: FIXTURE_NOW + 600_000,
        startableSince: FIXTURE_NOW,
      }),
    ).toBe(false);
  });

  it('never blames a settled delegation', () => {
    expect(
      isAutoChildNeverStarted({
        delegation: { ...QUEUED, settledAt: FIXTURE_NOW + 1000 },
        childAgent: CHILD,
        now: FIXTURE_NOW + 600_000,
        startableSince: FIXTURE_NOW,
      }),
    ).toBe(false);
  });
});
