import { describe, expect, it } from 'vitest';
import type { Agent, ArtifactId, IsoDateTime, PlanWithCount, WorkflowRunId } from '@goodboy/types';
import { PLAN_FIXTURE_PLANNER, aPlan } from '../../test/planFixtures';
import { runPlanOf } from './runPlanOf';

const RUN = 'run-ledger' as WorkflowRunId;
const OTHER_RUN = 'run-relay' as WorkflowRunId;

const planner = ({ runId }: { readonly runId: WorkflowRunId }): Agent => ({
  id: PLAN_FIXTURE_PLANNER,
  sessionId: 'session-harborline' as Agent['sessionId'],
  ordinal: 1,
  name: 'Plan',
  status: 'completed',
  workflowRunId: runId,
});

const planOf = (overrides: Partial<PlanWithCount>): PlanWithCount => aPlan(overrides);

describe('runPlanOf', () => {
  it('finds the active plan a run wrote, through its own run id', () => {
    const own = planOf({ workflowRunId: RUN });

    expect(runPlanOf({ plans: [own], agents: [], runId: RUN })).toBe(own);
  });

  it('finds it through the run of the agent that wrote it when the plan carries none', () => {
    const own = planOf({});

    expect(runPlanOf({ plans: [own], agents: [planner({ runId: RUN })], runId: RUN })).toBe(own);
  });

  it('ignores a plan of another run, a consumed plan and a discarded one', () => {
    const plans = [
      planOf({ id: 'plan-other' as ArtifactId, workflowRunId: OTHER_RUN }),
      planOf({ id: 'plan-consumed' as ArtifactId, workflowRunId: RUN, status: 'consumed' }),
      planOf({ id: 'plan-discarded' as ArtifactId, workflowRunId: RUN, status: 'discarded' }),
    ];

    expect(runPlanOf({ plans, agents: [], runId: RUN })).toBeNull();
  });

  it('takes the newest active plan when the run wrote more than one', () => {
    const older = planOf({
      id: 'plan-v1' as ArtifactId,
      workflowRunId: RUN,
      updatedAt: '2026-10-01T09:00:00.000Z' as IsoDateTime,
    });
    const newer = planOf({
      id: 'plan-v2' as ArtifactId,
      workflowRunId: RUN,
      updatedAt: '2026-10-01T10:00:00.000Z' as IsoDateTime,
    });

    expect(runPlanOf({ plans: [newer, older], agents: [], runId: RUN })).toBe(newer);
  });
});
