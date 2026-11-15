// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aDelegation } from '../testing/autoViewFixtures';
import { childWentInOf } from './childWentInOf';

const NO_SNAPSHOTS: Readonly<Record<string, unknown>> = {};

describe('childWentInOf', () => {
  it('has no snapshot for an agent started before it existed', () => {
    const wentIn = childWentInOf({
      agentId: 'agent-impl',
      delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })],
      launchSnapshots: NO_SNAPSHOTS,
    });
    expect(wentIn).toBeNull();
  });

  it('reads the snapshot when the launch wrote one and drops an unknown kind', () => {
    const base = aDelegation({ key: 'impl', role: 'implementer', state: 'running' });
    const wentIn = childWentInOf({
      agentId: 'agent-impl',
      delegations: [base],
      launchSnapshots: {
        [base.id]: {
          schemaVersion: 1,
          items: [
            { kind: 'note', ref: 'outbox-user-2', label: 'Also cover the batch endpoint' },
            { kind: 'x', ref: 'x', label: 'unknown kind' },
          ],
        },
      },
    });
    expect(wentIn).toEqual([
      { kind: 'note', ref: 'outbox-user-2', label: 'Also cover the batch endpoint', detail: null },
    ]);
  });

  it('reads an empty snapshot as nothing given, not as missing', () => {
    const base = aDelegation({ key: 'impl', role: 'implementer', state: 'running' });
    const wentIn = childWentInOf({
      agentId: 'agent-impl',
      delegations: [base],
      launchSnapshots: { [base.id]: { schemaVersion: 1, items: [] } },
    });
    expect(wentIn).toEqual([]);
  });

  it('reads the snapshot of the latest delegation only, never one of an earlier attempt', () => {
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
    const wentIn = childWentInOf({
      agentId: first.childAgentId,
      delegations: [first, retry],
      launchSnapshots: {
        [first.id]: { schemaVersion: 1, items: [{ kind: 'note', ref: 'n1', label: 'old' }] },
      },
    });
    expect(wentIn).toBeNull();
  });

  it('is not repainted by a late result for another agent', () => {
    const tester = aDelegation({ key: 'tester', role: 'tester', state: 'running' });
    const scout = aDelegation({ key: 'scout', role: 'scout', state: 'running' });
    const launchSnapshots = {
      [tester.id]: { schemaVersion: 1, items: [{ kind: 'note', ref: 'n1', label: 'note' }] },
    };
    const before = childWentInOf({
      agentId: 'agent-tester',
      delegations: [tester, scout],
      launchSnapshots,
    });
    const after = childWentInOf({
      agentId: 'agent-tester',
      delegations: [
        tester,
        { ...scout, state: 'settled', outcome: 'completed', result: { summary: 'late' } },
      ],
      launchSnapshots,
    });
    expect(after).toEqual(before);
  });
});
