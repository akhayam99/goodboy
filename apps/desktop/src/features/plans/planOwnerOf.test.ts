import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKFLOW_RULES,
  type Agent,
  type AgentId,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { aPlan } from '../../test/planFixtures';
import { planOwnerOf } from './planOwnerOf';

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

describe('planOwnerOf', () => {
  it('returns the run whose next step consumes the plan', () => {
    const found = planOwnerOf({
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

    const found = planOwnerOf({
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
    const found = planOwnerOf({
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
    const found = planOwnerOf({
      plan,
      agents: [stepAgent({ ordinal: 0, status: 'completed' })],
      runs: [run],
      templates: [workflow(['planner'])],
    });

    expect(found).toBeNull();
  });

  it('returns nothing for a plan written outside a run step', () => {
    const found = planOwnerOf({
      plan,
      agents: [anAgent({ id: 'agent-0' as AgentId })],
      runs: [run],
      templates: [workflow(['planner', 'implementer'])],
    });

    expect(found).toBeNull();
  });

  it('returns nothing when the planner or the run is gone', () => {
    expect(planOwnerOf({ plan, agents: [], runs: [run], templates: [] })).toBeNull();
    expect(
      planOwnerOf({
        plan,
        agents: [stepAgent({ ordinal: 0, status: 'completed' })],
        runs: [],
        templates: [workflow(['planner', 'implementer'])],
      }),
    ).toBeNull();
  });

  describe('by the stored link', () => {
    const linked = aPlan({ agentId: 'agent-0' as AgentId, workflowRunId: RUN_ID });
    const approved = aWorkflowRun({
      id: RUN_ID,
      workflowId: WORKFLOW_ID,
      executionMode: 'dynamic',
      rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan', planApproved: true },
    });

    it('returns an approved orchestrated run that has no next step yet', () => {
      const found = planOwnerOf({
        plan: linked,
        agents: [stepAgent({ ordinal: 0, status: 'completed' })],
        runs: [approved],
        templates: [workflow(['planner'])],
      });

      expect(found?.id).toBe(RUN_ID);
    });

    it('returns the run whatever its next step is', () => {
      const found = planOwnerOf({
        plan: linked,
        agents: [
          stepAgent({ ordinal: 0, status: 'completed' }),
          stepAgent({ ordinal: 1, status: 'pending' }),
        ],
        runs: [run],
        templates: [workflow(['planner', 'scout'])],
      });

      expect(found?.id).toBe(RUN_ID);
    });

    it('finds the run when the planner is not a step agent', () => {
      const found = planOwnerOf({
        plan: linked,
        agents: [anAgent({ id: 'agent-0' as AgentId })],
        runs: [approved],
        templates: [],
      });

      expect(found?.id).toBe(RUN_ID);
    });

    it('returns nothing for a discarded, closed or finished run', () => {
      const dead = [
        aWorkflowRun({ id: RUN_ID, workflowId: WORKFLOW_ID, discardedAt: AT }),
        aWorkflowRun({
          id: RUN_ID,
          workflowId: WORKFLOW_ID,
          orchestrationStop: { kind: 'closed', message: 'Closed' },
        }),
        aWorkflowRun({ id: RUN_ID, workflowId: WORKFLOW_ID, orchestrationOutcome: 'done' }),
      ];

      for (const candidate of dead) {
        expect(
          planOwnerOf({ plan: linked, agents: [], runs: [candidate], templates: [] }),
        ).toBeNull();
      }
    });

    it('returns nothing for a plan whose link points at no known run', () => {
      expect(planOwnerOf({ plan: linked, agents: [], runs: [], templates: [] })).toBeNull();
    });
  });

  it('returns the approved run of the planner even before the next step exists', () => {
    const approved = aWorkflowRun({
      id: RUN_ID,
      workflowId: WORKFLOW_ID,
      rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan', planApproved: true },
    });

    const found = planOwnerOf({
      plan,
      agents: [stepAgent({ ordinal: 0, status: 'completed' })],
      runs: [approved],
      templates: [workflow(['planner'])],
    });

    expect(found?.id).toBe(RUN_ID);
  });
});
