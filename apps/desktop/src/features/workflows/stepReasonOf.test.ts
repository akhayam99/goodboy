// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, StepId, Workflow, WorkflowId } from '@goodboy/types';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { stepReasonOf } from './stepReasonOf';

const WORKFLOW_ID: WorkflowId = JSON.parse('"workflow-ledger"');
const STEP_ONE: StepId = JSON.parse('"step-scout"');
const STEP_TWO: StepId = JSON.parse('"step-implement"');
const SCOUT: AgentId = JSON.parse('"agent-scout"');
const IMPLEMENTER: AgentId = JSON.parse('"agent-implementer"');

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: JSON.parse('"workspace-harborline"'),
  name: 'Fix flaky tests',
  description: '',
  steps: [
    {
      id: STEP_ONE,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Find',
      promptPrefix: '',
      orchestratorReason: 'The scout maps the failing suites first.',
    },
    { id: STEP_TWO, workflowId: WORKFLOW_ID, ordinal: 1, name: 'Fix', promptPrefix: '' },
  ],
  createdAt: JSON.parse('"2026-10-16T09:00:00.000Z"'),
  updatedAt: JSON.parse('"2026-10-16T09:00:00.000Z"'),
};

const scout = anAgent({ id: SCOUT, stepId: STEP_ONE, status: 'completed', ordinal: 0 });
const implementer = anAgent({ id: IMPLEMENTER, stepId: STEP_TWO, status: 'blocked', ordinal: 1 });
const AGENTS: ReadonlyArray<Agent> = [scout, implementer];

const BLOCKED_RUN = aWorkflowRun({
  workflowId: WORKFLOW_ID,
  orchestrationOutcome: 'blocked',
  orchestrationReason: 'Pick the branch to push to, then add a hint.',
});

describe('stepReasonOf', () => {
  it('reads the step decision on its own step page', () => {
    expect(
      stepReasonOf({
        run: aWorkflowRun({ workflowId: WORKFLOW_ID }),
        workflow: WORKFLOW,
        agent: scout,
        stepAgent: scout,
        runAgents: AGENTS,
      }),
    ).toBe('The scout maps the failing suites first.');
  });

  it('puts the closing reason of a run that needs a human call on the last step', () => {
    expect(
      stepReasonOf({
        run: BLOCKED_RUN,
        workflow: WORKFLOW,
        agent: implementer,
        stepAgent: implementer,
        runAgents: AGENTS,
      }),
    ).toBe('Pick the branch to push to, then add a hint.');
  });

  it('keeps the closing reason off the earlier steps', () => {
    expect(
      stepReasonOf({
        run: BLOCKED_RUN,
        workflow: WORKFLOW,
        agent: scout,
        stepAgent: scout,
        runAgents: AGENTS,
      }),
    ).toBe('The scout maps the failing suites first.');
  });

  it('shows no closing reason for a run that finished', () => {
    expect(
      stepReasonOf({
        run: { ...BLOCKED_RUN, orchestrationOutcome: 'done' },
        workflow: WORKFLOW,
        agent: implementer,
        stepAgent: implementer,
        runAgents: AGENTS,
      }),
    ).toBe('');
  });
});
