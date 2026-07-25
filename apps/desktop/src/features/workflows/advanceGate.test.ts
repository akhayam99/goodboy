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
} from '@goodboy/types';
import { resolveWorkflowAdvance } from './advanceGate';

const WF_ID = 'wf-1' as WorkflowId;
const NOW = '2026-07-25T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WF_ID,
  workspaceId: 'ws-1' as WorkspaceId,
  name: 'Refactor',
  description: '',
  steps: [
    { id: 's1' as StepId, workflowId: WF_ID, ordinal: 0, name: 'Scout', promptPrefix: '' },
    { id: 's2' as StepId, workflowId: WF_ID, ordinal: 1, name: 'Plan', promptPrefix: '' },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const agents = (...statuses: ReadonlyArray<Agent['status']>): ReadonlyArray<Agent> =>
  statuses.map((status, index) => ({
    id: `a-${index}` as AgentId,
    sessionId: 'ses-1' as SessionId,
    stepId: (index === 0 ? 's1' : 's2') as StepId,
    ordinal: index,
    name: `agent ${index}`,
    status,
  }));

const gate = {
  hasOpenQuestions: false,
  isSummarizerRunning: false,
  isTurnRunning: false,
};

describe('resolveWorkflowAdvance', () => {
  it('is ready on the next pending step when nothing blocks', () => {
    const state = resolveWorkflowAdvance({
      workflow,
      agents: agents('completed', 'pending'),
      ...gate,
    });

    expect(state).toEqual({ kind: 'ready', step: workflow.steps[1] });
  });

  it('reports open questions before anything else', () => {
    const state = resolveWorkflowAdvance({
      workflow,
      agents: agents('failed', 'pending'),
      ...gate,
      hasOpenQuestions: true,
    });

    expect(state).toMatchObject({ kind: 'blocked', reason: 'questions' });
  });

  it('reports the summarizer ahead of a failed step', () => {
    const state = resolveWorkflowAdvance({
      workflow,
      agents: agents('failed', 'pending'),
      ...gate,
      isSummarizerRunning: true,
    });

    expect(state).toMatchObject({ kind: 'blocked', reason: 'summarizer' });
  });

  it('reports the failed step and points at it', () => {
    const state = resolveWorkflowAdvance({
      workflow,
      agents: agents('failed', 'pending'),
      ...gate,
    });

    expect(state).toEqual({ kind: 'blocked', reason: 'failed-step', step: workflow.steps[0] });
  });

  it('reports a running turn last', () => {
    const state = resolveWorkflowAdvance({
      workflow,
      agents: agents('completed', 'pending'),
      ...gate,
      isTurnRunning: true,
    });

    expect(state).toMatchObject({ kind: 'blocked', reason: 'turn-running' });
  });

  it('is complete once every step is done or skipped', () => {
    const state = resolveWorkflowAdvance({
      workflow,
      agents: agents('completed', 'skipped'),
      ...gate,
    });

    expect(state).toEqual({ kind: 'complete' });
  });
});
