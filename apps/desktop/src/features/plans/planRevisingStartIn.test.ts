// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnState } from '@goodboy/types';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { PLAN_FIXTURE_PLANNER, PLAN_FIXTURE_SESSION, aStoredPlan } from '../../test/planFixtures';
import { planRevisingStartIn } from './planRevisingStartIn';

const STARTED_AT = brandId<IsoDateTime>({ value: '2026-10-05T10:05:00.000Z' });
const BLOCKED_AT = brandId<IsoDateTime>({ value: '2026-10-05T10:07:00.000Z' });

const heldRun = aWorkflowRun({
  executionMode: 'dynamic',
  orchestrationStop: { kind: 'plan-approval', message: 'Review the plan' },
});

const planner = anAgent({
  id: PLAN_FIXTURE_PLANNER,
  sessionId: PLAN_FIXTURE_SESSION,
  workflowRunId: heldRun.id,
});

const running = (runId: string): TurnState => ({
  kind: 'running',
  runId: brandId<ProviderRunId>({ value: runId }),
  startedAt: STARTED_AT,
});

type StateParams = {
  readonly turn: TurnState;
};

const stateOf = ({ turn }: StateParams) => ({
  sessionArtifacts: { [PLAN_FIXTURE_SESSION]: [aStoredPlan()] },
  sessionPhaseRuns: { [PLAN_FIXTURE_SESSION]: [planner] },
  agentTurnState: { [PLAN_FIXTURE_PLANNER]: turn },
});

describe('planRevisingStartIn', () => {
  it('reads the start of the planner turn that reworks a held plan', () => {
    expect(
      planRevisingStartIn({
        state: stateOf({ turn: running('run-2') }),
        sessionId: PLAN_FIXTURE_SESSION,
        run: heldRun,
      }),
    ).toBe(Date.parse(STARTED_AT));
  });

  it('reads the time the planner blocked when the turn waits on the planner', () => {
    expect(
      planRevisingStartIn({
        state: stateOf({
          turn: {
            kind: 'blocked',
            runId: brandId<ProviderRunId>({ value: 'run-2' }),
            blockedAt: BLOCKED_AT,
          },
        }),
        sessionId: PLAN_FIXTURE_SESSION,
        run: heldRun,
      }),
    ).toBe(Date.parse(BLOCKED_AT));
  });

  it('gives no start when the turn is the one that wrote the plan', () => {
    expect(
      planRevisingStartIn({
        state: stateOf({ turn: running('run-1') }),
        sessionId: PLAN_FIXTURE_SESSION,
        run: heldRun,
      }),
    ).toBeNull();
  });

  it('gives no start for a run that is not held for the plan', () => {
    expect(
      planRevisingStartIn({
        state: stateOf({ turn: running('run-2') }),
        sessionId: PLAN_FIXTURE_SESSION,
        run: { ...heldRun, orchestrationStop: undefined },
      }),
    ).toBeNull();
  });
});
