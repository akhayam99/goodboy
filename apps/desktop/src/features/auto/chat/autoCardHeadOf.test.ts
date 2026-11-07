import { describe, expect, it } from 'vitest';
import type { AutoDelegation, AutoOutcome } from '@goodboy/db';
import { aDelegation } from '../testing/autoViewFixtures';
import { autoCardHeadOf } from './autoCardHeadOf';

const OUTCOMES: ReadonlyArray<{ outcome: AutoOutcome; word: string }> = [
  { outcome: 'failed', word: 'Failed' },
  { outcome: 'blocked', word: 'Blocked' },
  { outcome: 'stopped', word: 'Stopped' },
  { outcome: 'timed_out', word: 'Failed' },
];
const ASKS: ReadonlyArray<AutoDelegation['state']> = ['paused', 'awaiting_confirm'];

describe('autoCardHeadOf', () => {
  it('names a planner only card Plan', () => {
    expect(
      autoCardHeadOf({
        delegations: [
          aDelegation({ key: 'planner', role: 'planner', state: 'settled', outcome: 'completed' }),
        ],
      }),
    ).toEqual({ name: 'Plan', meta: '1 agent', word: 'Done', isOpen: false });
  });
  it('names a card with a writer Build', () => {
    expect(
      autoCardHeadOf({
        delegations: [
          aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
          aDelegation({ key: 'test', role: 'tester', state: 'settled', outcome: 'completed' }),
        ],
      }),
    ).toEqual({ name: 'Build', meta: '2 agents', word: 'Running', isOpen: true });
  });
  it.each(['ci-fixer', 'docs', 'scribe'])('names a %s batch Build', (role) => {
    expect(
      autoCardHeadOf({
        delegations: [aDelegation({ key: role, role, state: 'settled', outcome: 'completed' })],
      }).name,
    ).toBe('Build');
  });
  it('names a reviewer card Review', () => {
    expect(
      autoCardHeadOf({
        delegations: [
          aDelegation({ key: 'review', role: 'reviewer', state: 'settled', outcome: 'completed' }),
        ],
      }).name,
    ).toBe('Review');
  });
  it.each(OUTCOMES)('says $word for $outcome', ({ outcome, word }) => {
    expect(
      autoCardHeadOf({
        delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'settled', outcome })],
      }).word,
    ).toBe(word);
  });
  it.each(ASKS)('puts Needs you before a failure and a running child for %s', (state) => {
    expect(
      autoCardHeadOf({
        delegations: [
          aDelegation({ key: 'ask', role: 'tester', state }),
          aDelegation({ key: 'failed', role: 'implementer', state: 'settled', outcome: 'failed' }),
          aDelegation({ key: 'live', role: 'reviewer', state: 'running' }),
        ],
      }).word,
    ).toBe('Needs you');
  });
  it('puts a failed child before a running one', () => {
    expect(
      autoCardHeadOf({
        delegations: [
          aDelegation({ key: 'failed', role: 'implementer', state: 'settled', outcome: 'failed' }),
          aDelegation({ key: 'live', role: 'tester', state: 'running' }),
        ],
      }).word,
    ).toBe('Failed');
  });
});
