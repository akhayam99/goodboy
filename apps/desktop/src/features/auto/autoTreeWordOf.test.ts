// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AUTO_BLOCK_TEXT } from '@goodboy/core/auto';
import type { AutoPhase } from '@goodboy/db';
import { aDelegation, aPlanRow, aView } from './testing/autoViewFixtures';
import { autoTreeWordOf } from './autoTreeWordOf';

type PhaseParams = {
  readonly phase: AutoPhase;
};

const wordOf = ({ phase }: PhaseParams) =>
  autoTreeWordOf({ view: aView({ phase }), rootTurn: null });

describe('autoTreeWordOf', () => {
  it.each([
    ['stopping', 'stopping', 'Stopped'],
    ['stopped', 'stopped', 'Stopped'],
    ['finished', 'done', 'Finished'],
    ['blocked', 'failed', 'Waits for you'],
    ['done', 'idle', 'Resting'],
    ['answering', 'idle', 'Resting'],
    ['deciding', 'running', 'Working'],
    ['delegating', 'running', 'Working'],
    ['waiting', 'running', 'Working'],
  ] as const)('reads the phase %s as the state %s and the Lead word %s', (phase, state, word) => {
    expect(wordOf({ phase })).toMatchObject({ state, word });
  });

  it('reads Waits for you while any agent of the run waits on you, even with others running', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
        aDelegation({ key: 'review', role: 'reviewer', state: 'awaiting_confirm' }),
      ],
    });

    expect(autoTreeWordOf({ view, rootTurn: null })).toMatchObject({
      state: 'asking',
      word: 'Waits for you',
    });
  });

  it('never says Stuck or Blocked for a Lead that stopped replying: it failed', () => {
    const tree = wordOf({ phase: 'blocked' });

    expect(tree.state).toBe('failed');
    expect(tree.lead).toMatchObject({ stop: 'waitsForYou', reason: 'failed' });
    expect(tree.node).toBe('failed');
    expect(tree.isLive).toBe(false);
  });

  it('says Stopping for the moment after Stop, not Running', () => {
    expect(wordOf({ phase: 'stopping' }).isLive).toBe(false);
  });

  it('reads a plan that waits as Waits for you with the reason plan ready', () => {
    const view = aView({ phase: 'waiting', artifacts: [aPlanRow()] });

    expect(autoTreeWordOf({ view, rootTurn: null })).toMatchObject({
      state: 'asking',
      word: 'Waits for you',
      lead: { stop: 'waitsForYou', reason: 'planReady' },
    });
  });

  it('reads a tree blocked by the budget as paused at its limit, not failed', () => {
    const view = aView({ phase: 'blocked' });
    const blockedReason = AUTO_BLOCK_TEXT.budget;

    expect(
      autoTreeWordOf({ view: { ...view, tree: { ...view.tree, blockedReason } }, rootTurn: null }),
    ).toMatchObject({ state: 'paused', node: 'budget', lead: { reason: 'limit' } });
  });

  it('reads a tree blocked by the no progress gate as failed', () => {
    const view = aView({ phase: 'blocked' });
    const blockedReason = AUTO_BLOCK_TEXT.limit_no_progress;

    expect(
      autoTreeWordOf({ view: { ...view, tree: { ...view.tree, blockedReason } }, rootTurn: null }),
    ).toMatchObject({ state: 'failed', lead: { reason: 'failed' } });
  });

  it('reads a spent limit as paused, a state of its own', () => {
    const tree = autoTreeWordOf({
      view: aView({ phase: 'waiting', capUsd: 10, spentUsd: 10 }),
      rootTurn: null,
    });

    expect(tree).toMatchObject({ state: 'paused', node: 'budget', lead: { reason: 'limit' } });
  });
});
