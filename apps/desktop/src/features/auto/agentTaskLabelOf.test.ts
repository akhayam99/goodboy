import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { aDelegation, aView } from './testing/autoViewFixtures';
import { agentTaskLabelOf } from './agentTaskLabelOf';

const TESTER = brandId<AgentId>({ value: 'agent-tester' });

const LONG_TASK =
  'Read only, change nothing unless a check is red. Branch hl/fix-duplicate-credit in payments-api.';

describe('agentTaskLabelOf', () => {
  it('names an Auto child by its role and the first sentence of its task, never the raw prompt', () => {
    const delegation = {
      ...aDelegation({ key: 'tester', role: 'tester', state: 'settled', outcome: 'completed' }),
      request: { task: LONG_TASK, reason: 'checks the retry path' },
    };

    expect(
      agentTaskLabelOf({ views: [aView({ delegations: [delegation] })], agentId: TESTER }),
    ).toEqual({
      kind: 'tester',
      role: 'Tester',
      title: 'Read only, change nothing unless a check is red',
    });
  });

  it('reads the first delegation of the child when Auto sent it twice', () => {
    const first = {
      ...aDelegation({ key: 'tester', role: 'tester', state: 'settled' }),
      request: { task: 'Run the retry tests of payments-api.' },
      createdAt: 1,
    };
    const second = { ...first, request: { task: 'Run them again.' }, createdAt: 2 };

    expect(
      agentTaskLabelOf({ views: [aView({ delegations: [second, first] })], agentId: TESTER })
        ?.title,
    ).toBe('Run the retry tests of payments-api');
  });

  it('has no label for an agent Auto did not start', () => {
    expect(agentTaskLabelOf({ views: [aView()], agentId: TESTER })).toBeNull();
    expect(agentTaskLabelOf({ views: undefined, agentId: TESTER })).toBeNull();
  });
});
