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

  it('gives a done child its declared result, then the delivered summary, never its working line', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        aDelegation({
          key: 'declared',
          role: 'reviewer',
          state: 'settled',
          outcome: 'completed',
          result: { declared: { summary: 'Clean, one nit on the empty state.' } },
        }),
        aDelegation({ key: 'reviewer', role: 'reviewer', state: 'settled', outcome: 'completed' }),
        aDelegation({ key: 'docs', role: 'docs', state: 'settled', outcome: 'completed' }),
        aDelegation({ key: 'fixer', role: 'implementer', state: 'running' }),
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
      anAgent({ id: childId('declared'), outputSummary: 'I will now read the home page' }),
      anAgent({ id: childId('reviewer'), outputSummary: 'agent side summary' }),
      anAgent({ id: childId('docs'), outputSummary: 'Updated the retry notes' }),
      anAgent({ id: childId('fixer'), outputSummary: 'Reading the retry helper' }),
    ];

    const group = autoGroupOf({ view, agents, now: FIXTURE_NOW });

    expect(group?.children.map((child) => child.outcome)).toEqual([
      'Clean, one nit on the empty state.',
      'Found 2 doc mismatches',
      null,
      'Reading the retry helper',
    ]);
  });

  it('reads a blocked child its own words, else a sentence, never a reason code', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        {
          ...aDelegation({
            key: 'scout',
            role: 'scout',
            state: 'settled',
            outcome: 'blocked',
            result: { declared: { summary: 'The design notes are not in harbor-portal.' } },
          }),
          reason: 'declared_blocked',
        },
        {
          ...aDelegation({ key: 'quiet', role: 'scout', state: 'settled', outcome: 'blocked' }),
          reason: 'declared_blocked',
          slot: 1,
        },
        {
          ...aDelegation({ key: 'odd', role: 'tester', state: 'settled', outcome: 'failed' }),
          reason: 'some_new_code',
          slot: 2,
        },
      ],
    });

    const group = autoGroupOf({ view, agents: [ROOT], now: FIXTURE_NOW });

    expect(group?.children.map((child) => child.reason)).toEqual([
      'The design notes are not in harbor-portal.',
      'It reported that it is blocked.',
      null,
    ]);
  });

  it('names two children of the same role by their task', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        aDelegation({ key: 'one', role: 'reviewer', state: 'running' }),
        { ...aDelegation({ key: 'two', role: 'reviewer', state: 'running' }), slot: 1 },
      ],
    });

    const group = autoGroupOf({ view, agents: [ROOT], now: FIXTURE_NOW });

    expect(group?.children.map((child) => child.label)).toEqual(['work for one', 'work for two']);
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

  it('reads a stopped or declined child as stopped, never as stuck', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        {
          ...aDelegation({ key: 'mine', role: 'reviewer', state: 'settled', outcome: 'stopped' }),
          reason: 'stopped',
        },
        {
          ...aDelegation({ key: 'no', role: 'implementer', state: 'settled', outcome: 'stopped' }),
          slot: 1,
          reason: 'declined',
        },
      ],
    });

    const group = autoGroupOf({ view, agents: [ROOT], now: FIXTURE_NOW });

    expect(group?.children.map((child) => [child.state, child.reasonCode])).toEqual([
      ['stopped', 'stopped'],
      ['stopped', 'declined'],
    ]);
    expect(group?.isStuck).toBe(false);
  });

  it('supersedes a child when a later one takes the same role on the same branch', () => {
    const first = {
      ...aDelegation({ key: 'fixer-1', role: 'implementer', state: 'settled', outcome: 'failed' }),
      target: { mountId: 'mount-home' },
    };
    const other = {
      ...aDelegation({ key: 'fixer-3', role: 'implementer', state: 'settled', outcome: 'failed' }),
      target: { mountId: 'mount-billing' },
      slot: 1,
    };
    const second = {
      ...aDelegation({ key: 'fixer-2', role: 'implementer', state: 'settled', outcome: 'blocked' }),
      target: { mountId: 'mount-home' },
      slot: 2,
      createdAt: FIXTURE_NOW + 1_000,
    };
    const group = autoGroupOf({
      view: aView({ phase: 'waiting', delegations: [first, other, second] }),
      agents: [ROOT],
      now: FIXTURE_NOW,
    });

    expect(group?.children.map((child) => [child.state, child.mountId])).toEqual([
      ['retried', 'mount-home'],
      ['failed', 'mount-billing'],
      ['blocked', 'mount-home'],
    ]);
  });

  it('keeps a done child done when a later one takes the same role on its branch', () => {
    const first = {
      ...aDelegation({ key: 'r-1', role: 'reviewer', state: 'settled', outcome: 'completed' }),
      target: { mountId: 'mount-home' },
    };
    const second = {
      ...aDelegation({ key: 'r-2', role: 'reviewer', state: 'running' }),
      target: { mountId: 'mount-home' },
      slot: 1,
      createdAt: FIXTURE_NOW + 1_000,
    };
    const group = autoGroupOf({
      view: aView({ phase: 'waiting', delegations: [first, second] }),
      agents: [ROOT],
      now: FIXTURE_NOW,
    });

    expect(group?.children.map((child) => child.state)).toEqual(['done', 'running']);
  });

  it('maps outcomes and the never started rule', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        { ...aDelegation({ key: 'a', role: 'implementer', state: 'accepted' }), slot: 0 },
        {
          ...aDelegation({ key: 'b', role: 'tester', state: 'settled', outcome: 'timed_out' }),
          slot: 1,
          reason: 'deadline_passed',
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
    expect(group?.children[1]?.reason).toBe('It ran out of time.');
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

  describe('a child whose agent is gone', () => {
    const failed = () =>
      aView({
        phase: 'waiting',
        delegations: [
          aDelegation({ key: 'scout', role: 'scout', state: 'settled', outcome: 'blocked' }),
        ],
      });

    it('is not stuck, so the group neither reads Stuck nor asks for a retry', () => {
      const group = autoGroupOf({ view: failed(), agents: [ROOT], now: FIXTURE_NOW });

      expect(group?.isStuck).toBe(false);
      expect(group?.word).not.toBe('Stuck');
      expect(group?.children[0]?.isGone).toBe(true);
    });

    it('is stuck again while its agent is in the session', () => {
      const group = autoGroupOf({
        view: failed(),
        agents: [ROOT, anAgent({ id: childId('scout'), parentAgentId: FIXTURE_ROOT })],
        now: FIXTURE_NOW,
      });

      expect(group?.isStuck).toBe(true);
      expect(group?.children[0]?.isGone).toBeUndefined();
    });

    it('stays stuck when its agent could not be created, since there was none to delete', () => {
      const group = autoGroupOf({
        view: aView({
          phase: 'waiting',
          delegations: [
            {
              ...aDelegation({ key: 'scout', role: 'scout', state: 'settled', outcome: 'failed' }),
              reason: 'agent_not_created: the agents table is locked',
            },
          ],
        }),
        agents: [ROOT],
        now: FIXTURE_NOW,
      });

      expect(group?.isStuck).toBe(true);
      expect(group?.word).toBe('Stuck');
      expect(group?.children[0]?.isGone).toBeUndefined();
    });

    it('never counts a child that has not started, since it has no agent yet', () => {
      const group = autoGroupOf({
        view: aView({
          phase: 'waiting',
          delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'accepted' })],
        }),
        agents: [ROOT],
        now: FIXTURE_NOW + 120_000,
      });

      expect(group?.isStuck).toBe(true);
      expect(group?.children[0]?.isGone).toBeUndefined();
    });
  });
});
