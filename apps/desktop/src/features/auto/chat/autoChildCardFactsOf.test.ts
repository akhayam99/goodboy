import { describe, expect, it } from 'vitest';
import type { AutoDelegation } from '@goodboy/db';
import { aDelegation } from '../testing/autoViewFixtures';
import { autoChildCardFactsOf } from './autoChildCardFactsOf';
import { delegationCardOf } from './delegationCardOf';

type FactsParams = {
  readonly delegation: AutoDelegation;
};

const factsOf = ({ delegation }: FactsParams) =>
  autoChildCardFactsOf({ card: delegationCardOf({ delegation, childAgent: null }) });

describe('autoChildCardFactsOf', () => {
  it('says Running in the running tone', () => {
    const facts = factsOf({
      delegation: aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
    });

    expect(facts).toEqual({ word: 'Running', tone: 'info' });
  });

  it('shows a queued child in the idle tone', () => {
    const facts = factsOf({
      delegation: aDelegation({ key: 'impl', role: 'implementer', state: 'accepted' }),
    });

    expect(facts).toMatchObject({ word: 'Queued', tone: 'neutral' });
  });

  it('paints a child that needs you in the waiting tone', () => {
    const facts = factsOf({
      delegation: aDelegation({ key: 'planner', role: 'planner', state: 'awaiting_confirm' }),
    });

    expect(facts).toMatchObject({ word: 'Needs you', tone: 'warning' });
  });

  it('says Stopping while the child is stopping', () => {
    const facts = factsOf({
      delegation: {
        ...aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
        isStopping: true,
      },
    });

    expect(facts.word).toBe('Stopping');
  });
});
