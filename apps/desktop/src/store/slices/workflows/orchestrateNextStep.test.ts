import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const { decideSpy, invokeWorkflowUpsertSpy, invokeAgentInsertSpy, listOpenQuestionsSpy } =
  vi.hoisted(() => ({
    decideSpy: vi.fn(),
    invokeWorkflowUpsertSpy: vi.fn(),
    invokeAgentInsertSpy: vi.fn(),
    listOpenQuestionsSpy: vi.fn(async () => []),
  }));

vi.mock('@goodboy/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...original,
    OrchestratorClient: vi.fn().mockImplementation(() => ({ decide: decideSpy })),
  };
});

vi.mock('@goodboy/db', () => ({
  listOpenQuestionsForSession: listOpenQuestionsSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeWorkflowUpsert: invokeWorkflowUpsertSpy,
  invokeAgentInsert: invokeAgentInsertSpy,
}));

import { orchestrateNextStep } from './orchestrateNextStep';
import { orchestrationTerminalStates } from './orchestrationTerminalStates';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const WORKFLOW_RUN_ID = 'workflow-run-1' as WorkflowRunId;
const AGENT_ID = 'agent-1' as AgentId;
const NOW = '2026-07-30T00:00:00.000Z' as IsoDateTime;

const workflow = (): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Dynamic workflow',
  description: '',
  goal: 'Ship the change',
  processText: 'Inspect, implement, and test until complete.',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Scout',
      role: 'scout',
      promptPrefix: 'Inspect the code.',
      expectedOutput: 'A file map.',
    },
  ],
  isPreset: false,
  createdAt: NOW,
  updatedAt: NOW,
});

const session = (): Session => ({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Ship the change',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [
    {
      id: WORKFLOW_RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'immediate',
      executionMode: 'dynamic',
    },
  ],
  autoRun: true,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
});

const completedAgent = (): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  stepId: 'step-1' as StepId,
  workflowRunId: WORKFLOW_RUN_ID,
  ordinal: 0,
  name: 'Scout',
  status: 'completed',
  outputSummary: 'The auth flow lives in auth.ts.',
});

type State = Record<string, unknown>;

const baseState = (): State => {
  const template = workflow();
  return {
    sessions: [session()],
    phaseTemplates: { [WORKSPACE_ID]: [template] },
    sessionWorkflows: { [SESSION_ID]: [template] },
    sessionPhaseRuns: { [SESSION_ID]: [completedAgent()] },
    workspaceOverrides: {},
    sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
    selectedAgentId: { [SESSION_ID]: AGENT_ID },
    transcripts: { [AGENT_ID]: [] },
    agentTurnState: {},
    agentModelOverride: {},
    agentKindOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    appendTurnEvent: vi.fn(),
    activateWorkflowAgent: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
  };
};

const harness = (state: State) => {
  const set = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      Object.assign(state, (updater as (current: State) => State)(state));
      return;
    }
    Object.assign(state, updater as State);
  });
  return { set: set as never, get: (() => state) as never };
};

beforeEach(() => {
  vi.clearAllMocks();
  orchestrationTerminalStates.clear();
  listOpenQuestionsSpy.mockResolvedValue([]);
  invokeWorkflowUpsertSpy.mockImplementation(async (input: Record<string, unknown>) => ({
    ...workflow(),
    steps: input['steps'],
  }));
  invokeAgentInsertSpy.mockImplementation(async (input: Record<string, unknown>) => ({
    id: 'agent-2' as AgentId,
    sessionId: input['sessionId'] as SessionId,
    stepId: input['stepId'] as StepId,
    workflowRunId: input['workflowRunId'] as WorkflowRunId,
    ordinal: input['ordinal'] as number,
    name: input['name'] as string,
    status: 'pending',
  }));
});

describe('orchestrateNextStep', () => {
  it('appends a real step and agent, emits the decision, and activates it', async () => {
    decideSpy.mockResolvedValue({
      decision: {
        action: 'next',
        reason: 'The implementation is ready.',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Implement the mapped change.',
          expectedOutput: 'A tested implementation.',
        },
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const templates = state['phaseTemplates'] as Record<string, ReadonlyArray<Workflow>>;
    expect(templates[WORKSPACE_ID]![0]!.steps).toHaveLength(2);
    const agents = (state['sessionPhaseRuns'] as Record<string, ReadonlyArray<Agent>>)[SESSION_ID]!;
    expect(agents[1]).toMatchObject({ name: 'Implement', status: 'pending' });
    expect(state['activateWorkflowAgent']).toHaveBeenCalledWith(SESSION_ID, 'agent-2');
    expect(state['appendTurnEvent']).toHaveBeenCalledWith(
      'agent-2',
      SESSION_ID,
      expect.objectContaining({
        kind: 'orchestrator_decision',
        action: 'next',
        reason: 'The implementation is ready.',
        stepName: 'Implement',
      }),
    );
  });

  it('suffixes a colliding step name', async () => {
    decideSpy.mockResolvedValue({
      decision: {
        action: 'next',
        reason: 'Inspect again.',
        step: {
          name: 'Scout',
          role: 'scout',
          promptPrefix: 'Inspect another area.',
          expectedOutput: 'An updated map.',
        },
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeWorkflowUpsertSpy.mock.calls[0]![0].steps[1].name).toBe('Scout 2');
  });

  it('emits done and stops without adding a step', async () => {
    decideSpy.mockResolvedValue({
      decision: { action: 'done', reason: 'All required tests pass.' },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
    expect(state['appendTurnEvent']).toHaveBeenCalledWith(
      AGENT_ID,
      SESSION_ID,
      expect.objectContaining({ action: 'done', reason: 'All required tests pass.' }),
    );
    expect(state['emitNotification']).toHaveBeenCalledWith(
      'agent-auto-spawn',
      'success',
      'dynamic workflow complete',
      'All required tests pass.',
      { sessionId: SESSION_ID },
    );
  });

  it('notifies when blocked', async () => {
    decideSpy.mockResolvedValue({
      decision: { action: 'blocked', reason: 'A product choice is required.' },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
    expect(state['emitNotification']).toHaveBeenCalledWith(
      'error',
      'warning',
      'dynamic workflow blocked',
      'A product choice is required.',
      { sessionId: SESSION_ID },
    );
  });

  it('treats an unparseable decision as blocked', async () => {
    decideSpy.mockResolvedValue({ decision: null });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(state['emitNotification']).toHaveBeenCalledWith(
      'error',
      'warning',
      'dynamic workflow blocked',
      'unparseable decision',
      { sessionId: SESSION_ID },
    );
  });

  it('guards re-entrant decisions for the same run', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    decideSpy.mockImplementation(async () => {
      await gate;
      return { decision: { action: 'done', reason: 'Complete.' } };
    });
    const state = baseState();
    const { set, get } = harness(state);
    const orchestrate = orchestrateNextStep(set, get);

    const first = orchestrate(SESSION_ID, WORKFLOW_RUN_ID);
    const second = orchestrate(SESSION_ID, WORKFLOW_RUN_ID);
    release();
    await Promise.all([first, second]);

    expect(decideSpy).toHaveBeenCalledTimes(1);
  });
});
