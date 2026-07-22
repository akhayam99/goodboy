import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const { invokeAgentListSpy, invokeAgentUpdateStatusSpy } = vi.hoisted(() => ({
  invokeAgentListSpy: vi.fn(),
  invokeAgentUpdateStatusSpy: vi.fn(),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: invokeAgentListSpy,
  invokeAgentUpdateStatus: invokeAgentUpdateStatusSpy,
}));

import { skipStuckStepAndAdvance } from './skipStuckStepAndAdvance';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const STEP_A = 'step-a' as StepId;
const STEP_B = 'step-b' as StepId;
const STUCK = 'agent-a' as AgentId;
const NEXT = 'agent-b' as AgentId;
const NOW = '2026-07-22T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Scout, Plan',
  description: '',
  goal: 'do the thing',
  createdAt: NOW,
  updatedAt: NOW,
  steps: [
    { id: STEP_A, workflowId: WORKFLOW_ID, ordinal: 0, name: 'Scout', promptPrefix: '' },
    { id: STEP_B, workflowId: WORKFLOW_ID, ordinal: 1, name: 'Plan', promptPrefix: '' },
  ],
};

const session: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'do the thing',
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
      triggerMode: 'manual',
    },
  ],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const stuckAgent: Agent = {
  id: STUCK,
  sessionId: SESSION_ID,
  stepId: STEP_A,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'Scout',
  status: 'running',
  startedAt: NOW,
};

const nextAgent: Agent = {
  id: NEXT,
  sessionId: SESSION_ID,
  stepId: STEP_B,
  workflowRunId: RUN_ID,
  ordinal: 1,
  name: 'Plan',
  status: 'pending',
};

const buildHarness = (turnKind: 'idle' | 'running') => {
  const activateWorkflowAgent = vi.fn();
  const state = {
    sessions: [session],
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionPhaseRuns: { [SESSION_ID]: [stuckAgent, nextAgent] },
    agentTurnState: { [STUCK]: { kind: turnKind, lastActivityAt: NOW } },
    activateWorkflowAgent,
    refreshUnreadWorkspaces: vi.fn(),
  };
  const set = vi.fn();
  const get = (() => state) as unknown as Parameters<typeof skipStuckStepAndAdvance>[1];
  return {
    run: skipStuckStepAndAdvance(
      set as unknown as Parameters<typeof skipStuckStepAndAdvance>[0],
      get,
    ),
    activateWorkflowAgent,
  };
};

describe('skipStuckStepAndAdvance', () => {
  beforeEach(() => {
    invokeAgentListSpy.mockResolvedValue([{ ...stuckAgent, status: 'skipped' }, nextAgent]);
    invokeAgentUpdateStatusSpy.mockResolvedValue({ ...stuckAgent, status: 'skipped' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips a paused running step and activates the next pending step', async () => {
    const { run, activateWorkflowAgent } = buildHarness('idle');

    await run(SESSION_ID, RUN_ID);

    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      STUCK,
      expect.objectContaining({ status: 'skipped' }),
    );
    expect(activateWorkflowAgent).toHaveBeenCalledWith(SESSION_ID, NEXT);
  });

  it('does not skip a step with a live turn', async () => {
    const { run, activateWorkflowAgent } = buildHarness('running');

    await run(SESSION_ID, RUN_ID);

    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
  });
});
