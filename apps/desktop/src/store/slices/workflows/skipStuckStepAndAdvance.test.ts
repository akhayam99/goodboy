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
      executionMode: 'static',
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

const buildHarness = (turnKind: 'idle' | 'running' | 'unseeded') => {
  const activateWorkflowAgent = vi.fn();
  const orchestrateNextStep = vi.fn();
  const state = {
    sessions: [session],
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionPhaseRuns: { [SESSION_ID]: [stuckAgent, nextAgent] },
    agentTurnState:
      turnKind === 'unseeded' ? {} : { [STUCK]: { kind: turnKind, lastActivityAt: NOW } },
    activateWorkflowAgent,
    orchestrateNextStep,
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
    orchestrateNextStep,
  };
};

type DynamicParams = {
  readonly orchestrationOutcome?: 'done' | 'blocked';
};

const dynamicHarness = ({ orchestrationOutcome }: DynamicParams = {}) => {
  const activateWorkflowAgent = vi.fn();
  const orchestrateNextStep = vi.fn();
  const scoutDone: Agent = { ...stuckAgent, status: 'completed' };
  const planFailed: Agent = { ...nextAgent, status: 'failed', startedAt: NOW };
  const state = {
    sessions: [
      {
        ...session,
        autoRun: true,
        workflowRuns: [
          {
            ...session.workflowRuns[0]!,
            autoRun: true,
            executionMode: 'dynamic' as const,
            ...(orchestrationOutcome != null && { orchestrationOutcome }),
          },
        ],
      },
    ],
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionPhaseRuns: { [SESSION_ID]: [scoutDone, planFailed] },
    agentTurnState: { [NEXT]: { kind: 'idle' as const, lastActivityAt: NOW } },
    activateWorkflowAgent,
    orchestrateNextStep,
    refreshUnreadWorkspaces: vi.fn(),
  };
  const set = vi.fn();
  const get = (() => state) as unknown as Parameters<typeof skipStuckStepAndAdvance>[1];
  invokeAgentListSpy.mockResolvedValue([scoutDone, { ...planFailed, status: 'skipped' }]);
  return {
    run: skipStuckStepAndAdvance(
      set as unknown as Parameters<typeof skipStuckStepAndAdvance>[0],
      get,
    ),
    activateWorkflowAgent,
    orchestrateNextStep,
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

  it('skips a paused step and starts the next one past the gate the operator just acknowledged', async () => {
    const { run, activateWorkflowAgent } = buildHarness('idle');

    await run(SESSION_ID, RUN_ID);

    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      STUCK,
      expect.objectContaining({ status: 'skipped' }),
    );
    expect(activateWorkflowAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: NEXT,
      focus: 'agent',
      bypassGate: true,
    });
  });

  it('does not skip a step with a live turn', async () => {
    const { run, activateWorkflowAgent } = buildHarness('running');

    await run(SESSION_ID, RUN_ID);

    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
  });

  it('refuses a background session where the persisted status is the only signal', async () => {
    const { run, activateWorkflowAgent } = buildHarness('unseeded');

    await run(SESSION_ID, RUN_ID);

    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
  });

  it('asks the orchestrator for the next step when a dynamic run has no known step left', async () => {
    const { run, activateWorkflowAgent, orchestrateNextStep } = dynamicHarness();

    await run(SESSION_ID, RUN_ID);

    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      NEXT,
      expect.objectContaining({ status: 'skipped' }),
    );
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
    expect(orchestrateNextStep).toHaveBeenCalledWith(SESSION_ID, RUN_ID, { bypassGate: true });
  });

  it('leaves a dynamic run alone once the orchestrator already closed it', async () => {
    const { run, orchestrateNextStep } = dynamicHarness({ orchestrationOutcome: 'done' });

    await run(SESSION_ID, RUN_ID);

    expect(orchestrateNextStep).not.toHaveBeenCalled();
  });
});
