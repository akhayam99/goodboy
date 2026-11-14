// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aDelegation } from '../testing/autoViewFixtures';
import { spawnRecordOf } from './spawnRecordOf';

describe('spawnRecordOf', () => {
  it('reads the stored fields of one agent', () => {
    const base = aDelegation({ key: 'tester', role: 'tester', state: 'running' });
    const delegation = {
      ...base,
      request: { ...base.request, doneWhen: 'One credit per event.' },
    };
    const record = spawnRecordOf({
      agentId: 'agent-tester',
      number: '4',
      delegations: [delegation],
    });
    expect(record).toMatchObject({
      title: '4 · Tester',
      brief: 'work for tester',
      why: 'Touches idempotency in payments-api and ledger-core, so it needs a plan.',
      doneWhen: 'One credit per event.',
      modelReason: 'chosen for the role',
      isLive: true,
      attempts: 1,
    });
  });

  it('has no snapshot for an agent started before it existed', () => {
    const record = spawnRecordOf({
      agentId: 'agent-impl',
      number: null,
      delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })],
    });
    expect(record?.wentIn).toBeNull();
  });

  it('reads the snapshot when the launch wrote one', () => {
    const base = aDelegation({ key: 'impl', role: 'implementer', state: 'running' });
    const record = spawnRecordOf({
      agentId: 'agent-impl',
      number: null,
      delegations: [
        {
          ...base,
          request: {
            ...base.request,
            launchSnapshot: [
              { kind: 'note', label: 'Also cover the batch endpoint' },
              { kind: 'x' },
            ],
          },
        },
      ],
    });
    expect(record?.wentIn).toEqual([
      { kind: 'note', label: 'Also cover the batch endpoint', detail: null },
    ]);
  });

  it('keeps the reason of the role even when thin', () => {
    const base = aDelegation({ key: 'impl', role: 'implementer', state: 'running' });
    const record = spawnRecordOf({
      agentId: 'agent-impl',
      number: null,
      delegations: [{ ...base, request: { ...base.request, roleReason: 'Code change.' } }],
    });
    expect(record?.role).toEqual({ label: 'Implementer', whyNot: null, reason: 'Code change.' });
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
    const record = spawnRecordOf({
      agentId: first.childAgentId,
      number: '3',
      delegations: [first, retry],
    });
    expect(record?.attempts).toBe(2);
  });

  it('is null for an agent without a delegation', () => {
    expect(spawnRecordOf({ agentId: 'agent-missing', number: null, delegations: [] })).toBeNull();
  });

  it('is not repainted by a late result for another agent', () => {
    const tester = aDelegation({ key: 'tester', role: 'tester', state: 'running' });
    const scout = aDelegation({ key: 'scout', role: 'scout', state: 'running' });
    const before = spawnRecordOf({
      agentId: 'agent-tester',
      number: '4',
      delegations: [tester, scout],
    });
    const after = spawnRecordOf({
      agentId: 'agent-tester',
      number: '4',
      delegations: [
        tester,
        { ...scout, state: 'settled', outcome: 'completed', result: { summary: 'late' } },
      ],
    });
    expect(after).toEqual(before);
  });
});
