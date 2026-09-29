// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  ArtifactId,
  IsoDateTime,
  PlanWithCount,
  SearchHit,
  SessionId,
} from '@goodboy/types';
import type { AppState } from '../../store/types';
import { hitActionTarget, hitPlanRunning } from './hitActionTarget';

const SESSION = 's-payout' as SessionId;
const AT = '2026-09-20T10:00:00.000Z' as IsoDateTime;

type HitParams = Partial<SearchHit>;

const hit = ({ ...overrides }: HitParams): SearchHit => ({
  docId: 'artifact:plan-1',
  kind: 'plan',
  refId: 'plan-1',
  workspaceId: null,
  sessionId: SESSION,
  sessionTitle: 'Speed up the payout export',
  agentId: null,
  agentName: null,
  mountId: null,
  provider: null,
  container: null,
  status: 'active',
  ordinal: null,
  url: null,
  isArchived: false,
  occurredAt: AT,
  title: [],
  snippet: [],
  ...overrides,
});

const plan = (status: PlanWithCount['status']): PlanWithCount => ({
  id: 'plan-1' as ArtifactId,
  sessionId: SESSION,
  agentId: 'agent-planner' as AgentId,
  title: 'Stream the payout export',
  bodyMd: '## Goal',
  status,
  createdAt: AT,
  updatedAt: AT,
  consumptionCount: 0,
});

type StateParams = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly openQuestions: number;
};

const stateOf = ({ plans, openQuestions }: StateParams): AppState =>
  ({
    sessionPlans: { [SESSION]: plans },
    sessionArtifacts: { [SESSION]: [] },
    sessionPhaseRuns: { [SESSION]: [] },
    sessionOpenQuestions: { [SESSION]: Array.from({ length: openQuestions }, () => ({})) },
  }) as unknown as AppState;

describe('search hit action target', () => {
  it('gives plans, reports and wireframes the artifact kind of the registry', () => {
    for (const kind of ['plan', 'report', 'wireframe'] as const) {
      expect(hitActionTarget({ hit: hit({ kind }), isPlanRunning: false })).toEqual({
        kind: 'artifact',
        sessionId: SESSION,
        subject: { kind: 'stored', artifactId: 'plan-1', isPlanRunning: false },
      });
    }
  });

  it('reads whether the plan is waiting on an answer from the live store', () => {
    expect(
      hitPlanRunning({
        hit: hit({}),
        state: stateOf({ plans: [plan('active')], openQuestions: 1 }),
      }),
    ).toBe(true);
    expect(
      hitPlanRunning({
        hit: hit({}),
        state: stateOf({ plans: [plan('active')], openQuestions: 0 }),
      }),
    ).toBe(false);
    expect(hitPlanRunning({ hit: hit({}), state: stateOf({ plans: [], openQuestions: 0 }) })).toBe(
      false,
    );
  });

  it('keeps an archived or orphan hit to its link, and objects without a kind to none', () => {
    expect(
      hitActionTarget({
        hit: hit({ isArchived: true, url: 'https://x.test' }),
        isPlanRunning: false,
      }),
    ).toEqual({ kind: 'link', href: 'https://x.test' });
    expect(hitActionTarget({ hit: hit({ kind: 'pr', url: null }), isPlanRunning: false })).toBe(
      null,
    );
    for (const kind of ['decision', 'question', 'branch'] as const) {
      expect(hitActionTarget({ hit: hit({ kind }), isPlanRunning: false })).toBe(null);
    }
    expect(hitActionTarget({ hit: hit({ kind: 'session' }), isPlanRunning: false })).toEqual({
      kind: 'session',
      sessionId: SESSION,
    });
  });
});
