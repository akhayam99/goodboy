import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
  StepId,
  TelemetryRecord,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const {
  decideSpy,
  invokeWorkflowUpsertSpy,
  invokeAgentInsertSpy,
  listOpenQuestionsSpy,
  updateOutcomeSpy,
  updateStopSpy,
  insertProviderRunSpy,
  updateProviderRunStatusSpy,
  insertTelemetrySpy,
  summarizeSessionSpy,
  summarizeWorkspaceSpy,
} = vi.hoisted(() => ({
  decideSpy: vi.fn(),
  invokeWorkflowUpsertSpy: vi.fn(),
  invokeAgentInsertSpy: vi.fn(),
  listOpenQuestionsSpy: vi.fn(async () => []),
  updateOutcomeSpy: vi.fn(async () => undefined),
  updateStopSpy: vi.fn(async () => undefined),
  insertProviderRunSpy: vi.fn(async () => undefined),
  updateProviderRunStatusSpy: vi.fn(async () => undefined),
  insertTelemetrySpy: vi.fn(async () => undefined),
  summarizeSessionSpy: vi.fn(async () => ({ estimatedCostUsd: 0 })),
  summarizeWorkspaceSpy: vi.fn(async () => ({ estimatedCostUsd: 0 })),
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...original,
    OrchestratorClient: vi.fn(function () {
      return { decide: decideSpy };
    }),
  };
});

vi.mock('@goodboy/db', () => ({
  listOpenQuestionsForSession: listOpenQuestionsSpy,
  updateWorkflowRunOrchestrationOutcome: updateOutcomeSpy,
  updateWorkflowRunOrchestrationStop: updateStopSpy,
  insertProviderRun: insertProviderRunSpy,
  updateProviderRunStatus: updateProviderRunStatusSpy,
  insertTelemetry: insertTelemetrySpy,
  summarizeSessionTelemetry: summarizeSessionSpy,
  summarizeWorkspaceTelemetry: summarizeWorkspaceSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeWorkflowUpsert: invokeWorkflowUpsertSpy,
  invokeAgentInsert: invokeAgentInsertSpy,
}));

import {
  ORCHESTRATOR_STEP_BUDGET,
  ORCHESTRATOR_STEP_HARD_CAP,
  OrchestratorClient,
  ROLE_DEFAULTS,
} from '@goodboy/core';
import { orchestrateNextStep } from './orchestrateNextStep';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const WORKFLOW_RUN_ID = 'workflow-run-1' as WorkflowRunId;
const AGENT_ID = 'agent-1' as AgentId;
const NOW = '2026-07-30T00:00:00.000Z' as IsoDateTime;

const NO_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  estimatedCostUsd: 0,
};

const BILLED_USAGE = {
  inputTokens: 4200,
  outputTokens: 310,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  estimatedCostUsd: 0.0123,
};

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
    workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
    phaseTemplates: { [WORKSPACE_ID]: [template] },
    sessionWorkflows: { [SESSION_ID]: [template] },
    sessionPhaseRuns: { [SESSION_ID]: [completedAgent()] },
    workspaceOverrides: {},
    sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
    sessionMounts: {},
    sessionActiveMount: {},
    sessionBranches: { [SESSION_ID]: 'ak/workflow' },
    selectedAgentId: { [SESSION_ID]: AGENT_ID },
    transcripts: { [AGENT_ID]: [] },
    sessionTelemetry: {},
    agentRunHistory: {},
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
  listOpenQuestionsSpy.mockResolvedValue([]);
  updateOutcomeSpy.mockResolvedValue(undefined);
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
      usage: NO_USAGE,
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
    expect(state['activateWorkflowAgent']).toHaveBeenCalledWith(
      SESSION_ID,
      'agent-2',
      undefined,
      'agent',
    );
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
      usage: NO_USAGE,
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

  it('spawns a decided scout step on the scout role model, not on an expensive one', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'Survey first.',
        step: {
          name: 'Survey the routing code',
          role: 'scout',
          promptPrefix: 'Survey the routing code.',
        },
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'scout',
        modelOverride: ROLE_DEFAULTS.scout.model,
        effort: ROLE_DEFAULTS.scout.effort,
      }),
    );
  });

  it('still spawns a decided step on the model the orchestrator picked for it', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'This one is hard.',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Implement the change.',
          model: 'opus-5',
          effort: 'max',
        },
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        modelOverride: 'opus-5',
        effort: 'max',
      }),
    );
  });

  it('offers the orchestrator the routing pool instead of the whole provider catalog', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'all set' },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const menu = decideSpy.mock.calls[0]![0].modelMenu as ReadonlyArray<{ id: string }>;
    expect(menu.map((option) => option.id)).toEqual(['opus-5', 'sonnet-5', 'haiku-4.5']);
  });

  it('falls back to the role default when the picked model is outside the pool', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'This one is hard.',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Implement the change.',
          model: 'fable-5',
          effort: 'max',
        },
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        modelOverride: ROLE_DEFAULTS.implementer.model,
        effort: ROLE_DEFAULTS.implementer.effort,
      }),
    );
  });

  it('tells the operator which pick it refused', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'This one is hard.',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Implement the change.',
          model: 'fable-5',
        },
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const saved = invokeWorkflowUpsertSpy.mock.calls[0]![0].steps[1];
    expect(saved.orchestratorReason).toContain('fable-5');
    expect(saved.orchestratorReason).toContain(ROLE_DEFAULTS.implementer.model);
    expect(state['appendTurnEvent']).toHaveBeenCalledWith(
      'agent-2',
      SESSION_ID,
      expect.objectContaining({ reason: expect.stringContaining('fable-5') }),
    );
  });

  it('bills the decision to the step it opened so the run cost includes it', async () => {
    decideSpy.mockResolvedValue({
      decision: {
        action: 'next',
        reason: 'The implementation is ready.',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Implement the mapped change.',
        },
      },
      usage: BILLED_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const records = (state['sessionTelemetry'] as Record<string, ReadonlyArray<TelemetryRecord>>)[
      SESSION_ID
    ]!;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: 'orchestrator',
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      inputTokens: 4200,
      outputTokens: 310,
      estimatedCostUsd: 0.0123,
    });
    const history = state['agentRunHistory'] as Record<string, ReadonlyArray<string>>;
    expect(history['agent-2']).toEqual([records[0]!.runId]);
    expect(insertTelemetrySpy).toHaveBeenCalledTimes(1);
  });

  it('bills a decision that only closed the run to the last agent', async () => {
    decideSpy.mockResolvedValue({
      decision: { action: 'done', reason: 'All required tests pass.' },
      usage: BILLED_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const history = state['agentRunHistory'] as Record<string, ReadonlyArray<string>>;
    expect(history[AGENT_ID]).toHaveLength(1);
  });

  it('keeps the turn the agent already paid for alongside the decision', async () => {
    decideSpy.mockResolvedValue({
      decision: { action: 'done', reason: 'All required tests pass.' },
      usage: BILLED_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    state['sessionPhaseRuns'] = {
      [SESSION_ID]: [{ ...completedAgent(), runId: 'own-run' as ProviderRunId }],
    };
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const history = state['agentRunHistory'] as Record<string, ReadonlyArray<string>>;
    expect(history[AGENT_ID]?.[0]).toBe('own-run');
    expect(history[AGENT_ID]).toHaveLength(2);
  });

  it('persists nothing when the decision burned no tokens', async () => {
    decideSpy.mockResolvedValue({
      decision: { action: 'done', reason: 'All required tests pass.' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(insertTelemetrySpy).not.toHaveBeenCalled();
  });

  it('emits done and stops without adding a step', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
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
    expect(updateOutcomeSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, 'done', expect.any(String));
    const updated = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(updated.orchestrationOutcome).toBe('done');
  });

  it('skips a run whose persisted outcome is already terminal', async () => {
    const state = baseState();
    const current = (state['sessions'] as ReadonlyArray<Session>)[0]!;
    state['sessions'] = [
      {
        ...current,
        workflowRuns: current.workflowRuns.map((run) => ({
          ...run,
          orchestrationOutcome: 'done' as const,
        })),
      },
    ];
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).not.toHaveBeenCalled();
  });

  it('notifies when blocked', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
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
    expect(updateOutcomeSpy).toHaveBeenCalledWith(
      {},
      WORKFLOW_RUN_ID,
      'blocked',
      expect.any(String),
    );
    const updated = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(updated.orchestrationOutcome).toBe('blocked');
  });

  it('recovers from a client failure without persisting an outcome', async () => {
    decideSpy.mockRejectedValueOnce(new Error('orchestrator decision timed out'));
    const state = baseState();
    const { set, get } = harness(state);
    const orchestrate = orchestrateNextStep(set, get);

    await orchestrate(SESSION_ID, WORKFLOW_RUN_ID);

    expect(state['emitNotification']).toHaveBeenCalledWith(
      'error',
      'warning',
      'orchestrator failed',
      expect.stringContaining('the orchestrator timed out after 120s'),
      { sessionId: SESSION_ID },
    );
    expect(state['appendTurnEvent']).toHaveBeenCalledWith(
      AGENT_ID,
      SESSION_ID,
      expect.objectContaining({
        action: 'blocked',
        reason: expect.stringContaining('orchestrator failed: the orchestrator timed out'),
      }),
    );
    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
    expect(updateOutcomeSpy).not.toHaveBeenCalled();
    const updated = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(updated.orchestrationOutcome).toBeUndefined();

    decideSpy.mockResolvedValueOnce({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'All required tests pass.' },
    });
    await orchestrate(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).toHaveBeenCalledTimes(2);
    expect(updateOutcomeSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, 'done', expect.any(String));
  });

  it('targets the run latest agent over the session selection for decision events', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'All required tests pass.' },
    });
    const state = baseState();
    state['selectedAgentId'] = { [SESSION_ID]: 'agent-other' as AgentId };
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(state['appendTurnEvent']).toHaveBeenCalledWith(
      AGENT_ID,
      SESSION_ID,
      expect.objectContaining({ action: 'done' }),
    );
  });

  it('never bills a decision to an agent outside the run', async () => {
    decideSpy.mockResolvedValue({
      decision: { action: 'done', reason: 'All required tests pass.' },
      usage: BILLED_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    state['sessionPhaseRuns'] = { [SESSION_ID]: [] };
    state['selectedAgentId'] = { [SESSION_ID]: 'agent-other' as AgentId };
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(state['appendTurnEvent']).not.toHaveBeenCalled();
    const history = state['agentRunHistory'] as Record<string, ReadonlyArray<string>>;
    expect(history['agent-other']).toBeUndefined();
  });

  it('records a decision the run has no agent to hang it on exactly once', async () => {
    decideSpy.mockResolvedValue({
      decision: { action: 'done', reason: 'All required tests pass.' },
      usage: BILLED_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    state['sessionPhaseRuns'] = { [SESSION_ID]: [] };
    state['selectedAgentId'] = { [SESSION_ID]: 'agent-other' as AgentId };
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const records = (state['sessionTelemetry'] as Record<string, ReadonlyArray<TelemetryRecord>>)[
      SESSION_ID
    ]!;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: 'orchestrator', estimatedCostUsd: 0.0123 });
    expect(insertTelemetrySpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the run alive when the decision is unparseable', async () => {
    decideSpy.mockResolvedValue({
      decision: null,
      usage: BILLED_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(updateOutcomeSpy).not.toHaveBeenCalled();
    expect(state['appendTurnEvent']).toHaveBeenCalledWith(
      AGENT_ID,
      SESSION_ID,
      expect.objectContaining({ action: 'blocked' }),
    );
    expect(state['emitNotification']).toHaveBeenCalledWith(
      'error',
      'warning',
      'orchestrator reply unparseable',
      'the decision could not be parsed, use next step to retry',
      { sessionId: SESSION_ID },
    );
    expect(insertTelemetrySpy).toHaveBeenCalledTimes(1);
  });

  it('guards re-entrant decisions for the same run', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    decideSpy.mockImplementation(async () => {
      await gate;
      return { decision: { action: 'done', reason: 'Complete.' }, usage: NO_USAGE };
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
  it('persists the failure so the run can explain itself, and clears it on the next decision', async () => {
    decideSpy.mockRejectedValueOnce(new Error('usage limit reached'));
    const state = baseState();
    const { set, get } = harness(state);
    const orchestrate = orchestrateNextStep(set, get);

    await orchestrate(SESSION_ID, WORKFLOW_RUN_ID);

    expect(updateStopSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, {
      kind: 'failure',
      message: expect.stringContaining('usage limit reached'),
    });
    const failed = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(failed.orchestrationStop?.kind).toBe('failure');
    expect(failed.orchestrationStop?.message).toContain('anthropic');

    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    await orchestrate(SESSION_ID, WORKFLOW_RUN_ID);

    expect(updateStopSpy).toHaveBeenLastCalledWith({}, WORKFLOW_RUN_ID, null);
    const cleared = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(cleared.orchestrationStop).toBeUndefined();
  });

  it('hands the operator hints of the run to the orchestrator', async () => {
    const state = baseState();
    const sessions = state['sessions'] as ReadonlyArray<Session>;
    state['sessions'] = [
      {
        ...sessions[0]!,
        workflowRuns: [{ ...sessions[0]!.workflowRuns[0]!, orchestratorHints: 'ignore the docs' }],
      },
    ];
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).toHaveBeenCalledWith(
      expect.objectContaining({ operatorHints: 'ignore the docs' }),
    );
  });

  it('routes the decision through the provider handed by the caller', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'gpt-5.6',
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID, {
      routing: { providerId: 'codex', model: 'gpt-5.6' },
    });

    expect(OrchestratorClient).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'codex', model: 'gpt-5.6' }),
    );
  });

  it('routes the decision through the model pinned on the run', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'gpt-5.6',
    });
    const state = baseState();
    const sessions = state['sessions'] as ReadonlyArray<Session>;
    state['sessions'] = [
      {
        ...sessions[0]!,
        workflowRuns: [
          {
            ...sessions[0]!.workflowRuns[0]!,
            orchestratorRouting: { providerId: 'codex', model: 'gpt-5.6', effort: 'high' },
          },
        ],
      },
    ];
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(OrchestratorClient).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'codex', model: 'gpt-5.6', effort: 'high' }),
    );
  });

  it('tells the orchestrator how much of the step budget is spent', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).toHaveBeenCalledWith(
      expect.objectContaining({ stepsUsed: 1, stepBudget: ORCHESTRATOR_STEP_BUDGET }),
    );
  });

  it('blocks the run once it reaches the hard step cap instead of asking for more', async () => {
    const state = baseState();
    const template = state['phaseTemplates'] as Record<string, ReadonlyArray<Workflow>>;
    const base = template[WORKSPACE_ID]![0]!;
    const capped: Workflow = {
      ...base,
      steps: Array.from({ length: ORCHESTRATOR_STEP_HARD_CAP }, (_, index) => ({
        ...base.steps[0]!,
        id: `step-${index}` as StepId,
        ordinal: index,
        name: `Step ${index}`,
      })),
    };
    state['phaseTemplates'] = { [WORKSPACE_ID]: [capped] };
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).not.toHaveBeenCalled();
    expect(updateOutcomeSpy).toHaveBeenCalledWith(
      {},
      WORKFLOW_RUN_ID,
      'blocked',
      expect.stringContaining('hard cap'),
    );
  });

  it('refuses to start a step while the budget cap is reached', async () => {
    const state = baseState();
    state['budgetAlerts'] = [{ kind: 'session-exceeded', sessionId: SESSION_ID }];
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).not.toHaveBeenCalled();
    expect(updateStopSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, {
      kind: 'budget',
      message: expect.stringContaining('budget cap'),
    });
    const paused = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(paused.orchestrationStop?.kind).toBe('budget');
  });
});
