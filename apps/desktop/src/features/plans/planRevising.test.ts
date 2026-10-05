// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  ArtifactId,
  IsoDateTime,
  ProviderRunId,
  ReportArtifact,
  TurnState,
} from '@goodboy/types';
import { aStoredPlan } from '../../test/planFixtures';
import {
  NOT_REVISING,
  planRevisingLabel,
  planRevisingOf,
  revisingByPlanId,
  sameRevisingMaps,
} from './planRevising';

const PLANNER = 'agent-planner' as AgentId;
const OTHER = 'agent-other' as AgentId;
const AT = '2026-10-05T10:00:00.000Z' as IsoDateTime;

const running = (runId: string): TurnState => ({
  kind: 'running',
  runId: runId as ProviderRunId,
  startedAt: AT,
});
const blocked = (runId: string): TurnState => ({
  kind: 'blocked',
  runId: runId as ProviderRunId,
  blockedAt: AT,
});

const stored = (overrides: {
  readonly status?: 'active' | 'consumed' | 'superseded' | 'discarded';
  readonly revision?: number;
  readonly sourceTurnId?: string | null;
}) => ({
  status: overrides.status ?? 'active',
  revision: overrides.revision ?? 1,
  sourceTurnId: overrides.sourceTurnId === undefined ? 'run-1' : overrides.sourceTurnId,
});

describe('planRevisingOf', () => {
  it('reads a running turn that is not the one that wrote the plan as revising to the next version', () => {
    expect(planRevisingOf({ artifact: stored({ revision: 2 }), turn: running('run-2') })).toEqual({
      kind: 'revising',
      nextRevision: 3,
    });
  });

  it('reads a blocked turn the same way', () => {
    expect(planRevisingOf({ artifact: stored({}), turn: blocked('run-2') })).toEqual({
      kind: 'revising',
      nextRevision: 2,
    });
  });

  it('stays quiet while the turn that wrote the plan is the one running', () => {
    expect(planRevisingOf({ artifact: stored({}), turn: running('run-1') })).toBe(NOT_REVISING);
  });

  it.each([
    ['idle', { kind: 'idle', lastActivityAt: AT } as const],
    ['starting', { kind: 'starting', startedAt: AT } as const],
    ['ended', { kind: 'ended', endedAt: AT } as const],
    ['error', { kind: 'error', message: 'x', failedAt: AT } as const],
    ['missing', undefined],
  ])('stays quiet when the planner is %s', (_name, turn) => {
    expect(planRevisingOf({ artifact: stored({}), turn })).toBe(NOT_REVISING);
  });

  it('says a plan that already ran gets a new version beside it', () => {
    expect(
      planRevisingOf({ artifact: stored({ status: 'consumed' }), turn: running('run-2') }),
    ).toEqual({ kind: 'newVersion' });
  });

  it.each(['superseded', 'discarded'] as const)('leaves a %s plan alone', (status) => {
    expect(planRevisingOf({ artifact: stored({ status }), turn: running('run-2') })).toBe(
      NOT_REVISING,
    );
  });

  it('treats a plan with no recorded turn as older than any running turn', () => {
    expect(
      planRevisingOf({ artifact: stored({ sourceTurnId: null }), turn: running('run-2') }).kind,
    ).toBe('revising');
  });
});

describe('planRevisingLabel', () => {
  it('names the version being written, or a new version for a plan that ran', () => {
    expect(planRevisingLabel({ revising: { kind: 'revising', nextRevision: 2 } })).toBe(
      'Revising to v2',
    );
    expect(planRevisingLabel({ revising: { kind: 'newVersion' } })).toBe('Writing a new version');
    expect(planRevisingLabel({ revising: NOT_REVISING })).toBe('');
  });
});

describe('revisingByPlanId', () => {
  const plan = (id: string, agentId: AgentId) =>
    aStoredPlan({ id: id as ArtifactId, agentId, revision: 1, sourceTurnId: 'run-1' });
  const report: ReportArtifact = {
    ...aStoredPlan({ id: 'report-1' as ArtifactId, agentId: PLANNER }),
    kind: 'report',
    metadata: { reportType: 'session-summary' },
  };

  it('keeps only the plans their own planner is reworking', () => {
    const map = revisingByPlanId({
      artifacts: [plan('plan-a', PLANNER), plan('plan-b', OTHER), report],
      turnStates: { [PLANNER]: running('run-2'), [OTHER]: running('run-1') },
    });
    expect([...map.keys()]).toEqual(['plan-a']);
  });

  it('compares two maps by what they say, not by identity', () => {
    const first = new Map([
      ['plan-a' as ArtifactId, { kind: 'revising', nextRevision: 2 } as const],
    ]);
    const same = new Map([
      ['plan-a' as ArtifactId, { kind: 'revising', nextRevision: 2 } as const],
    ]);
    const later = new Map([
      ['plan-a' as ArtifactId, { kind: 'revising', nextRevision: 3 } as const],
    ]);
    expect(sameRevisingMaps(first, same)).toBe(true);
    expect(sameRevisingMaps(first, later)).toBe(false);
    expect(sameRevisingMaps(first, new Map())).toBe(false);
  });
});
