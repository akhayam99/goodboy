// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AutoPhase } from '@goodboy/db';
import { aPlanRow, aView } from './testing/autoViewFixtures';
import { autoTreeWordOf } from './autoTreeWordOf';

const wordOf = (phase: AutoPhase) => autoTreeWordOf({ view: aView({ phase }), rootTurn: null });

describe('autoTreeWordOf', () => {
  it.each([
    ['stopping', 'stopping', 'Stopping'],
    ['stopped', 'stopped', 'Stopped'],
    ['finished', 'done', 'Done'],
    ['blocked', 'failed', 'Failed'],
    ['done', 'idle', 'Idle'],
    ['deciding', 'running', 'Running'],
    ['delegating', 'running', 'Running'],
  ] as const)('reads the phase %s as the state %s and the word %s', (phase, state, word) => {
    expect(wordOf(phase)).toMatchObject({ state, word });
  });

  it('never says Stuck or Blocked for an Auto that stopped replying: it failed', () => {
    const tree = wordOf('blocked');

    expect(tree.word).toBe('Failed');
    expect(tree.node).toBe('failed');
    expect(tree.isLive).toBe(false);
  });

  it('says Stopping for the moment after Stop, not Running', () => {
    expect(wordOf('stopping').isLive).toBe(false);
  });

  it('reads a plan that waits as Needs you', () => {
    const tree = autoTreeWordOf({
      view: aView({ phase: 'waiting', artifacts: [aPlanRow()] }),
      rootTurn: null,
    });

    expect(tree).toMatchObject({ state: 'asking', word: 'Needs you' });
  });

  it('reads a spent limit as Paused, a state of its own', () => {
    const tree = autoTreeWordOf({
      view: aView({ phase: 'waiting', capUsd: 10, spentUsd: 10 }),
      rootTurn: null,
    });

    expect(tree).toMatchObject({ state: 'paused', word: 'Paused', node: 'budget' });
  });
});
