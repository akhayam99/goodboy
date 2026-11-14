// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AUTO_BLOCK_TEXT } from '@goodboy/core/auto';
import type { AutoPhase } from '@goodboy/db';
import { aPlanRow, aView } from './testing/autoViewFixtures';
import { autoTreeWordOf } from './autoTreeWordOf';

type PhaseParams = {
  readonly phase: AutoPhase;
  readonly isWork?: boolean;
};

const wordOf = ({ phase, isWork = false }: PhaseParams) =>
  autoTreeWordOf({ view: aView({ phase }), rootTurn: null, isWork });

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
    expect(wordOf({ phase })).toMatchObject({ state, word });
  });

  it.each([
    ['stopping', 'stopping', 'Stopped'],
    ['stopped', 'stopped', 'Stopped'],
    ['finished', 'done', 'Finished'],
    ['blocked', 'failed', 'Waits for you'],
    ['done', 'idle', 'Resting'],
    ['answering', 'idle', 'Resting'],
    ['deciding', 'running', 'Working'],
    ['waiting', 'running', 'Working'],
  ] as const)(
    'with Work on reads the phase %s as the state %s and the Lead word %s',
    (phase, state, word) => {
      expect(wordOf({ phase, isWork: true })).toMatchObject({ state, word });
    },
  );

  it('never says Stuck or Blocked for an Auto that stopped replying: it failed', () => {
    const tree = wordOf({ phase: 'blocked' });

    expect(tree.word).toBe('Failed');
    expect(tree.node).toBe('failed');
    expect(tree.isLive).toBe(false);
  });

  it('says Stopping for the moment after Stop, not Running', () => {
    expect(wordOf({ phase: 'stopping' }).isLive).toBe(false);
  });

  it('reads a plan that waits as Needs you, and as Waits for you with the reason plan ready', () => {
    const view = aView({ phase: 'waiting', artifacts: [aPlanRow()] });

    expect(autoTreeWordOf({ view, rootTurn: null, isWork: false })).toMatchObject({
      state: 'asking',
      word: 'Needs you',
    });
    expect(autoTreeWordOf({ view, rootTurn: null, isWork: true })).toMatchObject({
      state: 'asking',
      word: 'Waits for you',
      lead: { stop: 'waitsForYou', reason: 'planReady' },
    });
  });

  it.each([
    ['the budget', AUTO_BLOCK_TEXT.budget],
    ['the wall clock', AUTO_BLOCK_TEXT.limit_wall_clock],
  ])('reads a tree blocked by %s as Paused, not Failed', (_name, blockedReason) => {
    const view = aView({ phase: 'blocked' });

    expect(
      autoTreeWordOf({
        view: { ...view, tree: { ...view.tree, blockedReason } },
        rootTurn: null,
        isWork: false,
      }),
    ).toMatchObject({ state: 'paused', word: 'Paused', node: 'budget' });
  });

  it('reads a tree blocked by the no progress gate as Failed', () => {
    const view = aView({ phase: 'blocked' });
    const blockedReason = AUTO_BLOCK_TEXT.limit_no_progress;

    expect(
      autoTreeWordOf({
        view: { ...view, tree: { ...view.tree, blockedReason } },
        rootTurn: null,
        isWork: false,
      }),
    ).toMatchObject({ state: 'failed', word: 'Failed' });
  });

  it('reads a spent limit as Paused, a state of its own', () => {
    const tree = autoTreeWordOf({
      view: aView({ phase: 'waiting', capUsd: 10, spentUsd: 10 }),
      rootTurn: null,
      isWork: false,
    });

    expect(tree).toMatchObject({ state: 'paused', word: 'Paused', node: 'budget' });
  });
});
