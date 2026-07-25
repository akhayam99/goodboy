import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { stepForAgent } from './stepForAgent';

const WF_ID = 'wf-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-07-25T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WF_ID,
  workspaceId: 'ws-1' as WorkspaceId,
  name: 'Refactor',
  description: '',
  steps: [
    {
      id: 's1' as StepId,
      workflowId: WF_ID,
      ordinal: 0,
      name: 'Scout',
      promptPrefix: 'map it',
      expectedOutput: 'a file map',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const run: WorkflowRun = {
  id: RUN_ID,
  workflowId: WF_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
};

const agent: Agent = {
  id: 'a-1' as AgentId,
  sessionId: 'ses-1' as SessionId,
  stepId: 's1' as StepId,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'Scout',
  status: 'completed',
};

describe('stepForAgent', () => {
  it('resolves the step definition behind a workflow agent', () => {
    const step = stepForAgent({ agent, workflowRuns: [run], workflows: [workflow] });

    expect(step?.expectedOutput).toBe('a file map');
  });

  it('returns null for an agent that is not bound to a workflow step', () => {
    const adHoc: Agent = { ...agent, stepId: undefined, workflowRunId: undefined };

    expect(stepForAgent({ agent: adHoc, workflowRuns: [run], workflows: [workflow] })).toBeNull();
  });

  it('returns null when the workflow is no longer loaded', () => {
    expect(stepForAgent({ agent, workflowRuns: [run], workflows: [] })).toBeNull();
  });
});
