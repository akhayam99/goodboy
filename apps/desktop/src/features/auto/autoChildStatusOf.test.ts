import { describe, expect, it } from 'vitest';
import { anAgent } from '@goodboy/types/testing';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent } from '@goodboy/types';
import { FIXTURE_ROOT, aDelegation, aView } from './testing/autoViewFixtures';
import { leadTreeDelegationsOf } from './tree/leadTreeDelegationsOf';
import { delegationGlanceOf } from '../session/glance/delegationGlanceOf';
import { autoChildStatusOf } from './autoChildStatusOf';

type Case = Readonly<{
  name: string;
  delegation: AutoDelegation;
  status: Agent['status'];
}>;

const CASES: ReadonlyArray<Case> = [
  {
    name: 'a done scout its agent row calls completed',
    delegation: aDelegation({
      key: 'scout',
      role: 'scout',
      state: 'settled',
      outcome: 'completed',
    }),
    status: 'completed',
  },
  {
    name: 'a paused reviewer its agent row calls running',
    delegation: aDelegation({ key: 'reviewer', role: 'reviewer', state: 'paused' }),
    status: 'running',
  },
  {
    name: 'a queued tester',
    delegation: aDelegation({ key: 'tester', role: 'tester', state: 'accepted' }),
    status: 'pending',
  },
  {
    name: 'a failed ci fixer',
    delegation: aDelegation({
      key: 'ci',
      role: 'ci-fixer',
      state: 'settled',
      outcome: 'failed',
    }),
    status: 'failed',
  },
];

describe('autoChildStatusOf', () => {
  it.each(CASES)('says the word of the Agents rail for $name', ({ delegation, status }) => {
    const agent = anAgent({ id: delegation.childAgentId, status, parentAgentId: FIXTURE_ROOT });
    const views = [aView({ delegations: [delegation] })];

    const rail = leadTreeDelegationsOf({
      delegations: [delegation],
      agents: [agent],
      ownSpendByAgentId: new Map(),
      leadAgentId: FIXTURE_ROOT,
    }).agentsById.get(agent.id);
    const shown = autoChildStatusOf({ views, agent });

    expect(shown?.word).toBe(rail?.word);
    expect(shown === null ? null : delegationGlanceOf({ status: shown }).word).toBe(rail?.word);
  });

  it('reads the last delegation of a child that was retried', () => {
    const first = aDelegation({ key: 'scout', role: 'scout', state: 'settled', outcome: 'failed' });
    const running: AutoDelegation = {
      ...aDelegation({ key: 'scout', role: 'scout', state: 'running' }),
      id: aDelegation({ key: 'retry', role: 'scout', state: 'running' }).id,
    };
    const agent = anAgent({ id: first.childAgentId, status: 'running' });

    expect(
      autoChildStatusOf({ views: [aView({ delegations: [first, running] })], agent })?.word,
    ).toBe('Running');
  });

  it('has no delegation status for the run itself or an agent outside Auto', () => {
    const views = [aView({ delegations: [] })];

    expect(autoChildStatusOf({ views, agent: anAgent({ id: FIXTURE_ROOT }) })).toBeNull();
    expect(autoChildStatusOf({ views: undefined, agent: anAgent({}) })).toBeNull();
  });
});
