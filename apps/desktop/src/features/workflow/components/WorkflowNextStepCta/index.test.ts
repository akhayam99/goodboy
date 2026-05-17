import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@kay-am/types';
import { pickNextWorkflowStep } from './index';

const WS_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 't-1' as SessionId;
const WF_ID = 'wf' as WorkflowId;
const NOW = '2026-05-10T00:00:00.000Z' as IsoDateTime;

function wf(): Workflow {
  return {
    id: WF_ID,
    workspaceId: WS_ID,
    name: 'Refactor',
    description: '',
    steps: [
      { id: 's1' as StepId, workflowId: WF_ID, ordinal: 0, name: 'Scout', promptPrefix: '' },
      { id: 's2' as StepId, workflowId: WF_ID, ordinal: 1, name: 'Plan', promptPrefix: '' },
      { id: 's3' as StepId, workflowId: WF_ID, ordinal: 2, name: 'Refactor', promptPrefix: '' },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function run(stepId: StepId, status: Agent['status'], idx = 0): Agent {
  return {
    id: `r-${idx}` as AgentId,
    sessionId: SESSION_ID,
    stepId,
    ordinal: idx,
    name: stepId,
    status,
  };
}

describe('pickNextWorkflowStep', () => {
  it('returns null when current step is still pending/running', () => {
    expect(pickNextWorkflowStep(wf(), [run('s1' as StepId, 'pending', 0)])).toBeNull();
    expect(pickNextWorkflowStep(wf(), [run('s1' as StepId, 'running', 0)])).toBeNull();
  });

  it('returns the next un-spawned step once the previous one is completed', () => {
    const next = pickNextWorkflowStep(wf(), [run('s1' as StepId, 'completed', 0)]);
    expect(next?.id).toBe('s2');
  });

  it('returns null when all steps are already spawned', () => {
    const runs = [
      run('s1' as StepId, 'completed', 0),
      run('s2' as StepId, 'completed', 1),
      run('s3' as StepId, 'pending', 2),
    ];
    expect(pickNextWorkflowStep(wf(), runs)).toBeNull();
  });

  it('skips ahead past completed steps to the next un-spawned one', () => {
    const runs = [run('s1' as StepId, 'completed', 0), run('s2' as StepId, 'completed', 1)];
    expect(pickNextWorkflowStep(wf(), runs)?.id).toBe('s3');
  });

  it('returns first step when no runs exist yet', () => {
    expect(pickNextWorkflowStep(wf(), [])?.id).toBe('s1');
  });
});
