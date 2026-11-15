// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aDelegation } from '../testing/autoViewFixtures';
import { delegationAttemptsOf } from './delegationAttemptsOf';

describe('delegationAttemptsOf', () => {
  it('counts one attempt for a first launch', () => {
    const tester = aDelegation({ key: 'tester', role: 'tester', state: 'running' });
    expect(delegationAttemptsOf({ agentId: tester.childAgentId, delegations: [tester] })).toEqual({
      attempts: 1,
      lastNote: null,
    });
  });

  it('counts the attempts of a retry chain', () => {
    const first = aDelegation({
      key: 'first',
      role: 'tester',
      state: 'settled',
      outcome: 'failed',
    });
    const retry = {
      ...aDelegation({ key: 'retry', role: 'tester', state: 'running' }),
      childAgentId: first.childAgentId,
      retryOf: first.id,
      createdAt: first.createdAt + 1,
    };
    const attempts = delegationAttemptsOf({
      agentId: first.childAgentId,
      delegations: [first, retry],
    });
    expect(attempts.attempts).toBe(2);
  });

  it('counts one attempt for an agent without a delegation', () => {
    expect(delegationAttemptsOf({ agentId: 'agent-missing', delegations: [] })).toEqual({
      attempts: 1,
      lastNote: null,
    });
  });

  it('is not changed by a late result for another agent', () => {
    const tester = aDelegation({ key: 'tester', role: 'tester', state: 'running' });
    const scout = aDelegation({ key: 'scout', role: 'scout', state: 'running' });
    const before = delegationAttemptsOf({
      agentId: tester.childAgentId,
      delegations: [tester, scout],
    });
    const after = delegationAttemptsOf({
      agentId: tester.childAgentId,
      delegations: [tester, { ...scout, state: 'settled', outcome: 'completed' }],
    });
    expect(after).toEqual(before);
  });
});
