import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type AutoDelegationId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { aDelegation, aView, FIXTURE_NOW, FIXTURE_ROOT } from './testing/autoViewFixtures';
import { autoGroupOf } from './autoGroupOf';
import { autoRowFacts } from './autoRowFacts';

const ROOT = anAgent({ id: FIXTURE_ROOT, name: 'Harden retries in payments-api' });

const childId = (key: string) => brandId<AgentId>({ value: `agent-${key}` });

describe('autoGroupOf', () => {
  it('orders children by slot and reads the word from autoRowFacts', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        { ...aDelegation({ key: 'fixer', role: 'implementer', state: 'running' }), slot: 1 },
        {
          ...aDelegation({
            key: 'reviewer',
            role: 'reviewer',
            state: 'settled',
            outcome: 'completed',
          }),
          slot: 0,
        },
      ],
    });

    const group = autoGroupOf({ view, agents: [ROOT], now: FIXTURE_NOW });

    expect(group?.children.map((child) => child.noun)).toEqual(['Reviewer', 'Implementer']);
    expect(group?.word).toBe(autoRowFacts({ view })?.word);
    expect(group?.phase).toBe(autoRowFacts({ view })?.phase);
    expect(group?.title).toBe('Harden retries in payments-api');
  });

  it('prefers the delivered summary, then the agent output summary', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        aDelegation({ key: 'reviewer', role: 'reviewer', state: 'settled', outcome: 'completed' }),
        aDelegation({ key: 'docs', role: 'docs', state: 'settled', outcome: 'completed' }),
      ],
      deliveredResults: [
        {
          runId: brandId({ value: 'run-1' }),
          delegationId: 'delegation-reviewer',
          childAgentId: childId('reviewer'),
          role: 'reviewer',
          provider: null,
          model: null,
          outcome: 'completed',
          summary: 'Found 2 doc mismatches',
        },
      ],
    });
    const agents = [
      ROOT,
      anAgent({ id: childId('reviewer'), outputSummary: 'agent side summary' }),
      anAgent({ id: childId('docs'), outputSummary: 'Updated the retry notes' }),
    ];

    const group = autoGroupOf({ view, agents, now: FIXTURE_NOW });

    expect(group?.children.map((child) => child.outcome)).toEqual([
      'Found 2 doc mismatches',
      'Updated the retry notes',
    ]);
  });

  it('numbers two children of the same role', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        aDelegation({ key: 'one', role: 'reviewer', state: 'running' }),
        { ...aDelegation({ key: 'two', role: 'reviewer', state: 'running' }), slot: 1 },
      ],
    });

    const group = autoGroupOf({ view, agents: [ROOT], now: FIXTURE_NOW });

    expect(group?.children.map((child) => child.label)).toEqual(['Reviewer 1', 'Reviewer 2']);
  });

  it('folds a delegation that another one retries', () => {
    const first = aDelegation({
      key: 'fixer-1',
      role: 'implementer',
      state: 'settled',
      outcome: 'failed',
    });
    const second = {
      ...aDelegation({ key: 'fixer-2', role: 'implementer', state: 'running' }),
      retryOf: first.id,
      slot: 1,
    };
    const group = autoGroupOf({
      view: aView({ phase: 'waiting', delegations: [first, second] }),
      agents: [ROOT],
      now: FIXTURE_NOW,
    });

    expect(group?.children.map((child) => child.state)).toEqual(['retried', 'running']);
  });

  it('maps outcomes and the never started rule', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        { ...aDelegation({ key: 'a', role: 'implementer', state: 'accepted' }), slot: 0 },
        {
          ...aDelegation({ key: 'b', role: 'tester', state: 'settled', outcome: 'timed_out' }),
          slot: 1,
          reason: 'Ran past its deadline.',
        },
        {
          ...aDelegation({ key: 'c', role: 'docs', state: 'settled', outcome: 'blocked' }),
          slot: 2,
        },
      ],
    });

    const group = autoGroupOf({ view, agents: [ROOT], now: FIXTURE_NOW + 61_000 });

    expect(group?.children.map((child) => child.state)).toEqual([
      'neverStarted',
      'timedOut',
      'blocked',
    ]);
    expect(group?.children[1]?.reason).toBe('Ran past its deadline.');
  });

  it('nests an agent linked by parentAgentId without a delegation', () => {
    const linked = anAgent({
      id: childId('linked'),
      parentAgentId: FIXTURE_ROOT,
      kind: 'tester',
      status: 'running',
    });
    const group = autoGroupOf({
      view: aView({ phase: 'waiting' }),
      agents: [ROOT, linked],
      now: FIXTURE_NOW,
    });

    expect(group?.children).toHaveLength(1);
    expect(group?.children[0]).toMatchObject({
      agentId: linked.id,
      delegationId: null,
      noun: 'Tester',
      state: 'running',
    });
  });

  it('leaves adopted agents as their own rows', () => {
    const adopted = {
      ...aDelegation({ key: 'mine', role: 'implementer', state: 'running' }),
      isAdopted: true,
    };
    const group = autoGroupOf({
      view: aView({ phase: 'waiting', delegations: [adopted] }),
      agents: [ROOT],
      now: FIXTURE_NOW,
    });

    expect(group?.children).toEqual([]);
  });

  it('returns null while Auto is only answering', () => {
    expect(autoGroupOf({ view: aView({ phase: 'answering' }), agents: [ROOT], now: 0 })).toBeNull();
  });

  it('keeps the delegation id on the child', () => {
    const group = autoGroupOf({
      view: aView({
        phase: 'waiting',
        delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'running' })],
      }),
      agents: [ROOT],
      now: FIXTURE_NOW,
    });

    expect(group?.children[0]?.delegationId).toBe(
      brandId<AutoDelegationId>({ value: 'delegation-fixer' }),
    );
    expect(group?.children[0]?.asked).toBe('work for fixer');
  });
});
