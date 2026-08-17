import { describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { recoverStuckStep } from './recoverStuckStep';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const AGENT_ID = 'agent-1' as AgentId;
const NOW = '2026-08-17T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Delivery',
  description: '',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Analyze',
      promptPrefix: '',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const session: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'ship safely',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [
    {
      id: RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      currentStep: 0,
      autoRun: false,
      triggerMode: 'immediate',
      executionMode: 'static',
    },
  ],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const failedAgent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  stepId: workflow.steps[0]!.id,
  ordinal: 0,
  name: 'Analyze',
  status: 'failed',
};

describe('recoverStuckStep', () => {
  it('uses the normal turn path to verify completion and request the marker', async () => {
    const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
    const emitNotification = vi.fn(async () => undefined);
    const state = {
      sessions: [session],
      phaseTemplates: { [WORKSPACE_ID]: [workflow] },
      sessionWorkflows: {},
      sessionPhaseRuns: { [SESSION_ID]: [failedAgent] },
      agentTurnState: {},
      sendTurn,
      emitNotification,
    };
    const run = recoverStuckStep(
      (() => state) as unknown as Parameters<typeof recoverStuckStep>[0],
    );

    await run({ sessionId: SESSION_ID, workflowRunId: RUN_ID });

    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        content: expect.stringContaining('Check whether this workflow step is complete'),
      }),
    );
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining(`<<step-done id="${AGENT_ID}">>`),
      }),
    );
    expect(emitNotification).not.toHaveBeenCalled();
  });

  it('reports a failed recovery and leaves skip available', async () => {
    const sendTurn = vi.fn(async () => {
      throw new Error('provider unavailable');
    });
    const emitNotification = vi.fn(async () => undefined);
    const state = {
      sessions: [session],
      phaseTemplates: { [WORKSPACE_ID]: [workflow] },
      sessionWorkflows: {},
      sessionPhaseRuns: { [SESSION_ID]: [failedAgent] },
      agentTurnState: {},
      sendTurn,
      emitNotification,
    };
    const run = recoverStuckStep(
      (() => state) as unknown as Parameters<typeof recoverStuckStep>[0],
    );

    await run({ sessionId: SESSION_ID, workflowRunId: RUN_ID });

    expect(emitNotification).toHaveBeenCalledWith(
      'error',
      'warning',
      'the blocked step could not be checked',
      'provider unavailable. You can still skip this step.',
      { sessionId: SESSION_ID },
    );
  });
});
