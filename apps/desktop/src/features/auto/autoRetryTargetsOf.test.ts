import { describe, expect, it } from 'vitest';
import type { AutoOutcome } from '@goodboy/db';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  aDelegation,
  aPlanRow,
  aView,
  FIXTURE_NOW,
  FIXTURE_ROOT,
} from './testing/autoViewFixtures';
import { autoRetryTargetsOf } from './autoRetryTargetsOf';

const ROOT = anAgent({ id: FIXTURE_ROOT, kind: 'auto' });
const OUTCOMES: ReadonlyArray<AutoOutcome> = ['failed', 'timed_out', 'blocked'];
const REASON_CODE: Readonly<Record<AutoOutcome, string>> = {
  completed: 'completed',
  failed: 'process_error',
  timed_out: 'deadline_passed',
  blocked: 'declared_blocked',
  stopped: 'stopped',
};
const LATE = FIXTURE_NOW + 61_000;
const LINKED = anAgent({
  id: brandId<AgentId>({ value: 'agent-linked' }),
  parentAgentId: FIXTURE_ROOT,
  kind: 'tester',
  status: 'failed',
});

type ChildAgentParams = {
  readonly key: string;
};

const childAgentOf = ({ key }: ChildAgentParams) =>
  anAgent({ id: brandId<AgentId>({ value: `agent-${key}` }), parentAgentId: FIXTURE_ROOT });

describe('autoRetryTargetsOf', () => {
  it('targets a child that never started', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'accepted' })],
    });

    expect(autoRetryTargetsOf({ views: [view], agents: [ROOT], now: LATE })).toEqual([
      {
        agentId: 'agent-fixer',
        rootAgentId: FIXTURE_ROOT,
        role: 'work for fixer',
        noun: 'Implementer',
        kind: 'neverStarted',
        reason: null,
        reasonCode: null,
        mountId: null,
        plan: null,
        canRetry: true,
      },
    ]);
  });

  it('does not target a child still inside its first minute', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'accepted' })],
    });

    expect(
      autoRetryTargetsOf({ views: [view], agents: [ROOT], now: FIXTURE_NOW + 59_000 }),
    ).toEqual([]);
  });

  it('targets failed, timed out and blocked children with their reason', () => {
    const view = aView({
      phase: 'waiting',
      delegations: OUTCOMES.map((outcome, slot) => ({
        ...aDelegation({
          key: outcome,
          role: 'tester',
          state: 'settled',
          outcome,
        }),
        slot,
        reason: REASON_CODE[outcome],
      })),
    });

    const targets = autoRetryTargetsOf({
      views: [view],
      agents: [ROOT, ...OUTCOMES.map((outcome) => childAgentOf({ key: outcome }))],
      now: FIXTURE_NOW,
    });

    expect(targets.map((target) => [target.kind, target.reason])).toEqual([
      ['failed', 'The agent ended with an error.'],
      ['timedOut', 'It ran out of time.'],
      ['childBlocked', 'It reported that it is blocked.'],
    ]);
  });

  it('skips a delegation that was retried', () => {
    const first = aDelegation({
      key: 'fixer-1',
      role: 'implementer',
      state: 'settled',
      outcome: 'failed',
    });
    const view = aView({
      phase: 'waiting',
      delegations: [
        first,
        {
          ...aDelegation({ key: 'fixer-2', role: 'implementer', state: 'running' }),
          retryOf: first.id,
          slot: 1,
        },
      ],
    });

    expect(autoRetryTargetsOf({ views: [view], agents: [ROOT], now: LATE })).toEqual([]);
  });

  it('skips a child you stopped or declined', () => {
    const view = aView({
      phase: 'waiting',
      delegations: ['stopped', 'declined'].map((reason, slot) => ({
        ...aDelegation({ key: reason, role: 'reviewer', state: 'settled', outcome: 'stopped' }),
        slot,
        reason,
      })),
    });

    expect(autoRetryTargetsOf({ views: [view], agents: [ROOT], now: LATE })).toEqual([]);
  });

  it('skips a child a later one replaced on the same branch', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        {
          ...aDelegation({ key: 'old', role: 'implementer', state: 'settled', outcome: 'failed' }),
          target: { mountId: 'mount-home' },
        },
        {
          ...aDelegation({ key: 'new', role: 'implementer', state: 'running' }),
          target: { mountId: 'mount-home' },
          slot: 1,
          createdAt: FIXTURE_NOW + 1_000,
        },
      ],
    });

    expect(autoRetryTargetsOf({ views: [view], agents: [ROOT], now: LATE })).toEqual([]);
  });

  it('skips finished and stopped trees', () => {
    const delegations = [
      aDelegation({ key: 'fixer', role: 'implementer', state: 'settled', outcome: 'failed' }),
    ];

    expect(
      autoRetryTargetsOf({
        views: [
          aView({ phase: 'finished', delegations }),
          aView({ phase: 'stopped', delegations }),
        ],
        agents: [ROOT],
        now: LATE,
      }),
    ).toEqual([]);
  });

  it('reports canRetry false when the route is null', () => {
    const plainRoot = anAgent({ id: FIXTURE_ROOT });

    const targets = autoRetryTargetsOf({
      views: [aView({ phase: 'waiting' })],
      agents: [plainRoot, LINKED],
      now: LATE,
    });

    expect(targets.map((target) => [target.agentId, target.canRetry])).toEqual([
      [LINKED.id, false],
    ]);
  });

  it('routes a parent linked failure to the Auto root', () => {
    const targets = autoRetryTargetsOf({
      views: [aView({ phase: 'waiting' })],
      agents: [ROOT, LINKED],
      now: LATE,
    });

    expect(targets.map((target) => target.canRetry)).toEqual([true]);
  });

  it('adds an approve target named by the plan, its version and its branches when the plan waits on you', () => {
    const view = aView({
      phase: 'waiting',
      artifacts: [aPlanRow({ title: 'Center pages rollout', revision: 3 })],
      delegations: ['home', 'billing', 'home'].map((page, index) => ({
        ...aDelegation({ key: `${page}-${index}`, role: 'implementer', state: 'accepted' }),
        target: { mountId: `mount-${page}` },
      })),
    });

    expect(autoRetryTargetsOf({ views: [view], agents: [ROOT], now: FIXTURE_NOW })).toEqual([
      {
        agentId: FIXTURE_ROOT,
        rootAgentId: FIXTURE_ROOT,
        role: 'Auto',
        noun: 'Auto',
        kind: 'approve',
        reason: null,
        reasonCode: null,
        mountId: null,
        plan: { name: 'Center pages rollout', version: 3, branchCount: 2 },
        canRetry: false,
      },
    ]);
  });

  it('gives an approve target no plan facts while the plan is being revised', () => {
    const view = aView({
      phase: 'waiting',
      artifacts: [aPlanRow({ openRevise: 'delegation-reviser' }), aPlanRow({ title: '  ' })],
    });

    expect(
      autoRetryTargetsOf({ views: [view], agents: [ROOT], now: FIXTURE_NOW }).map((target) => [
        target.kind,
        target.plan,
      ]),
    ).toEqual([['approve', null]]);
  });

  it('carries the branch and the reason code of a stuck child', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        {
          ...aDelegation({
            key: 'fixer',
            role: 'implementer',
            state: 'settled',
            outcome: 'blocked',
          }),
          target: { mountId: 'mount-home' },
          reason: 'declared_blocked',
        },
      ],
    });

    expect(
      autoRetryTargetsOf({
        views: [view],
        agents: [ROOT, childAgentOf({ key: 'fixer' })],
        now: FIXTURE_NOW,
      }).map((target) => [target.noun, target.mountId, target.reasonCode]),
    ).toEqual([['Implementer', 'mount-home', 'declared_blocked']]);
  });

  it('adds a blocked target for a blocked tree', () => {
    const view = aView({ phase: 'blocked' });

    expect(
      autoRetryTargetsOf({ views: [view], agents: [ROOT], now: FIXTURE_NOW }).map(
        (target) => target.kind,
      ),
    ).toEqual(['blocked']);
  });

  describe('an agent that is gone', () => {
    const waitingPlan = () =>
      aView({ phase: 'waiting', artifacts: [aPlanRow({ title: 'Center pages rollout' })] });

    it('offers no approve card for a tree whose root agent was deleted', () => {
      expect(autoRetryTargetsOf({ views: [waitingPlan()], agents: [], now: FIXTURE_NOW })).toEqual(
        [],
      );
    });

    it('offers no approve card when the root agent belongs to another session', () => {
      const elsewhere = anAgent({ id: brandId<AgentId>({ value: 'agent-elsewhere' }) });

      expect(
        autoRetryTargetsOf({ views: [waitingPlan()], agents: [elsewhere], now: FIXTURE_NOW }),
      ).toEqual([]);
    });

    it('offers no blocked card for a tree whose root agent is gone', () => {
      expect(
        autoRetryTargetsOf({ views: [aView({ phase: 'blocked' })], agents: [], now: FIXTURE_NOW }),
      ).toEqual([]);
    });

    it('keeps the card of a sibling tree whose root agent is still there', () => {
      const gone = aView({ phase: 'blocked' });
      const other = {
        ...aView({ phase: 'blocked' }),
        tree: {
          ...aView({ phase: 'blocked' }).tree,
          rootAgentId: brandId<AgentId>({ value: 'agent-auto-second' }),
        },
      };

      const targets = autoRetryTargetsOf({
        views: [gone, other],
        agents: [anAgent({ id: other.tree.rootAgentId, kind: 'auto' })],
        now: FIXTURE_NOW,
      });

      expect(targets.map((target) => target.rootAgentId)).toEqual([other.tree.rootAgentId]);
    });

    it('offers no stuck card for a child whose agent is gone, though its delegation failed', () => {
      const view = aView({
        phase: 'waiting',
        delegations: [
          aDelegation({ key: 'scout', role: 'scout', state: 'settled', outcome: 'blocked' }),
        ],
      });

      expect(autoRetryTargetsOf({ views: [view], agents: [ROOT], now: FIXTURE_NOW })).toEqual([]);
      expect(
        autoRetryTargetsOf({
          views: [view],
          agents: [ROOT, childAgentOf({ key: 'scout' })],
          now: FIXTURE_NOW,
        }).map((target) => target.kind),
      ).toEqual(['childBlocked']);
    });

    it('still offers a child that never started, which has no agent yet', () => {
      const view = aView({
        phase: 'waiting',
        delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'accepted' })],
      });

      expect(
        autoRetryTargetsOf({ views: [view], agents: [ROOT], now: LATE }).map(
          (target) => target.kind,
        ),
      ).toEqual(['neverStarted']);
    });
  });
});
