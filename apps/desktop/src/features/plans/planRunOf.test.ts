import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { aPlan } from '../../test/planFixtures';
import { planRunOf } from './planRunOf';

const WORKFLOW_ID = 'workflow-retry' as WorkflowId;
const RUN_ID = 'run-retry' as WorkflowRunId;
const AT = '2026-10-05T10:00:00.000Z' as Workflow['createdAt'];

const workflow = (
  roles: ReadonlyArray<'planner' | 'implementer' | 'tester' | 'scout'>,
): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: 'workspace-harborline' as WorkspaceId,
  name: 'Retry payments through ledger-core',
  description: '',
  steps: roles.map((role, ordinal) => ({
    id: `step-${ordinal}` as StepId,
    workflowId: WORKFLOW_ID,
    ordinal,
    name: role,
    role,
    promptPrefix: '',
  })),
  createdAt: AT,
  updatedAt: AT,
});

const stepAgent = ({
  ordinal,
  status,
}: {
  readonly ordinal: number;
  readonly status: Agent['status'];
}): Agent =>
  anAgent({
    id: `agent-${ordinal}` as AgentId,
    ordinal,
    status,
    stepId: `step-${ordinal}` as StepId,
    workflowRunId: RUN_ID,
  });

const run = aWorkflowRun({ id: RUN_ID, workflowId: WORKFLOW_ID });
const plan = aPlan({ agentId: 'agent-0' as AgentId });

describe('planRunOf', () => {
  it('returns the run whose next step consumes the plan', () => {
    const found = planRunOf({
      plan,
      agents: [
        stepAgent({ ordinal: 0, status: 'completed' }),
        stepAgent({ ordinal: 1, status: 'pending' }),
      ],
      runs: [run],
      templates: [workflow(['planner', 'implementer'])],
    });

    expect(found?.id).toBe(RUN_ID);
  });

  it('returns the run held for the plan whatever its next step is', () => {
    const held = aWorkflowRun({
      id: RUN_ID,
      workflowId: WORKFLOW_ID,
      orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
    });

    const found = planRunOf({
      plan,
      agents: [
        stepAgent({ ordinal: 0, status: 'completed' }),
        stepAgent({ ordinal: 1, status: 'pending' }),
      ],
      runs: [held],
      templates: [workflow(['planner', 'tester'])],
    });

    expect(found?.id).toBe(RUN_ID);
  });

  it('returns nothing when the next step does not run plans', () => {
    const found = planRunOf({
      plan,
      agents: [
        stepAgent({ ordinal: 0, status: 'completed' }),
        stepAgent({ ordinal: 1, status: 'pending' }),
      ],
      runs: [run],
      templates: [workflow(['planner', 'scout'])],
    });

    expect(found).toBeNull();
  });

  it('returns nothing when the run has no step left', () => {
    const found = planRunOf({
      plan,
      agents: [stepAgent({ ordinal: 0, status: 'completed' })],
      runs: [run],
      templates: [workflow(['planner'])],
    });

    expect(found).toBeNull();
  });

  it('returns nothing for a plan written outside a run step', () => {
    const found = planRunOf({
      plan,
      agents: [anAgent({ id: 'agent-0' as AgentId })],
      runs: [run],
      templates: [workflow(['planner', 'implementer'])],
    });

    expect(found).toBeNull();
  });

  it('returns nothing when the planner or the run is gone', () => {
    expect(planRunOf({ plan, agents: [], runs: [run], templates: [] })).toBeNull();
    expect(
      planRunOf({
        plan,
        agents: [stepAgent({ ordinal: 0, status: 'completed' })],
        runs: [],
        templates: [workflow(['planner', 'implementer'])],
      }),
    ).toBeNull();
  });
});
