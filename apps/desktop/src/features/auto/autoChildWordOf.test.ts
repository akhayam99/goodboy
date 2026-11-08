import { describe, expect, it } from 'vitest';
import type { AutoOutcome } from '@goodboy/db';
import { anAgent } from '@goodboy/types/testing';
import { STATE_WORD_MEANINGS } from '../../shared/utils/stateWordMeanings';
import { autoChildLive } from '../live-state/adapters/autoChildLive';
import { autoChildWordOf } from './autoChildWordOf';
import { autoGroupOf } from './autoGroupOf';
import { autoSettledStateOf } from './autoSettledStateOf';
import { delegationCardOf } from './chat/delegationCardOf';
import { aDelegation, aView, FIXTURE_NOW, FIXTURE_ROOT } from './testing/autoViewFixtures';

const WORDS = STATE_WORD_MEANINGS.map((meaning) => meaning.word);

const OUTCOMES: ReadonlyArray<AutoOutcome> = [
  'completed',
  'failed',
  'timed_out',
  'blocked',
  'stopped',
];

const EXPECTED: Readonly<Record<AutoOutcome, ReadonlyArray<string>>> = {
  completed: ['Done', 'Done'],
  failed: ['Failed', 'Failed'],
  timed_out: ['Failed', 'Failed'],
  blocked: ['Idle', 'Done'],
  stopped: ['Stopped', 'Stopped'],
};

describe('autoChildWordOf', () => {
  it.each(OUTCOMES)('reads %s as one word the state table defines', (outcome) => {
    const [open, replaced] = EXPECTED[outcome];

    expect(autoChildWordOf({ state: autoSettledStateOf({ outcome, isReplaced: false }) })).toBe(
      open,
    );
    expect(autoChildWordOf({ state: autoSettledStateOf({ outcome, isReplaced: true }) })).toBe(
      replaced === undefined ? open : replaced,
    );
    expect(WORDS).toContain(open);
  });

  it.each(OUTCOMES)('gives %s the same word on the group row and on the agent card', (outcome) => {
    const delegation = {
      ...aDelegation({ key: 'scout', role: 'scout', state: 'settled', outcome }),
      reason: null,
    };
    const group = autoGroupOf({
      view: aView({ phase: 'waiting', delegations: [delegation] }),
      agents: [anAgent({ id: FIXTURE_ROOT })],
      now: FIXTURE_NOW,
    });
    const card = delegationCardOf({ delegation, childAgent: null });
    const child = group?.children[0];

    expect(child === undefined ? null : autoChildWordOf({ state: child.state })).toBe(
      card.status.word,
    );
  });

  it.each(OUTCOMES)('writes no raw code in the tail of a settled %s child', (outcome) => {
    const facts = autoChildLive({
      delegation: { state: 'settled', outcome, reason: 'some_new_code', result: null },
      isReplaced: false,
      turn: null,
      agent: anAgent({ status: 'completed' }),
      lastTool: null,
      project: null,
    });

    expect(facts?.phrase ?? '').not.toContain('_');
  });
});
