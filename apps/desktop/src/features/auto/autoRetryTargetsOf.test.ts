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
const LATE = FIXTURE_NOW + 61_000;
const LINKED = anAgent({
  id: brandId<AgentId>({ value: 'agent-linked' }),
  parentAgentId: FIXTURE_ROOT,
  kind: 'tester',
  status: 'failed',
});

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
        role: 'Implementer',
        kind: 'neverStarted',
        reason: null,
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
        reason: `reason ${outcome}`,
      })),
    });

    const targets = autoRetryTargetsOf({ views: [view], agents: [ROOT], now: FIXTURE_NOW });

    expect(targets.map((target) => [target.kind, target.reason])).toEqual([
      ['failed', 'reason failed'],
      ['failed', 'reason timed_out'],
      ['failed', 'reason blocked'],
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

  it('adds an approve target when the plan waits on you', () => {
    const view = aView({ phase: 'waiting', artifacts: [aPlanRow()] });

    expect(autoRetryTargetsOf({ views: [view], agents: [ROOT], now: FIXTURE_NOW })).toEqual([
      {
        agentId: FIXTURE_ROOT,
        rootAgentId: FIXTURE_ROOT,
        role: 'Auto',
        kind: 'approve',
        reason: null,
        canRetry: false,
      },
    ]);
  });

  it('adds a blocked target for a blocked tree', () => {
    const view = aView({ phase: 'blocked' });

    expect(
      autoRetryTargetsOf({ views: [view], agents: [ROOT], now: FIXTURE_NOW }).map(
        (target) => target.kind,
      ),
    ).toEqual(['blocked']);
  });
});
