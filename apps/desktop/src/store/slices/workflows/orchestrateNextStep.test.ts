// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OrchestratorHint,
  OpenQuestion,
  OpenQuestionId,
  ProviderRunId,
  Session,
  SessionId,
  StepId,
  TelemetryRecord,
  Workflow,
  WorkflowId,
  WorkflowRoutingLock,
  WorkflowRules,
  WorkflowRun,
  WorkflowRunId,
  WorkflowSpendLimitMode,
  WorkspaceId,
} from '@goodboy/types';

import { DEFAULT_WORKFLOW_RULES, parseWorkflowRulesText } from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const {
  decideSpy,
  invokeWorkflowUpsertSpy,
  invokeAgentInsertSpy,
  listOpenQuestionsSpy,
  updateOutcomeSpy,
  updateStopSpy,
  updateSummarySpy,
  insertProviderRunSpy,
  updateProviderRunStatusSpy,
  insertTelemetrySpy,
  summarizeSessionSpy,
  summarizeWorkspaceSpy,
  repointWorkflowRunTemplateSpy,
  updateHintsSpy,
  updateRulesSpy,
} = vi.hoisted(() => ({
  decideSpy: vi.fn(),
  updateRulesSpy: vi.fn(async () => undefined),
  repointWorkflowRunTemplateSpy: vi.fn(async () => undefined),
  updateHintsSpy: vi.fn(async () => undefined),
  invokeWorkflowUpsertSpy: vi.fn(),
  invokeAgentInsertSpy: vi.fn(),
  listOpenQuestionsSpy: vi.fn(async () => [] as ReadonlyArray<OpenQuestion>),
  updateOutcomeSpy: vi.fn(async () => undefined),
  updateStopSpy: vi.fn(async () => undefined),
  updateSummarySpy: vi.fn(async () => undefined),
  insertProviderRunSpy: vi.fn(async () => undefined),
  updateProviderRunStatusSpy: vi.fn(async () => undefined),
  insertTelemetrySpy: vi.fn(async () => undefined),
  summarizeSessionSpy: vi.fn(async () => ({ estimatedCostUsd: 0 })),
  summarizeWorkspaceSpy: vi.fn(async () => ({ estimatedCostUsd: 0 })),
}));

const orchestratorTransport = vi.hoisted(() => ({
  stdout: null as string | null,
  requests: [] as Array<Record<string, unknown>>,
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...original,
    OrchestratorClient: vi.fn(function (deps: OrchestratorClientDeps) {
      const stdout = orchestratorTransport.stdout;
      if (stdout === null) {
        return { decide: decideSpy };
      }
      const client = new original.OrchestratorClient({
        ...deps,
        invokeFn: async (_command: string, args?: Record<string, unknown>) => {
          orchestratorTransport.requests.push((args?.['args'] ?? {}) as Record<string, unknown>);
          return { stdout, stderr: '', exitCode: 0 } as never;
        },
      });
      return { decide: (input: OrchestratorInput) => client.decide(input) };
    }),
  };
});

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    repointWorkflowRunTemplate: repointWorkflowRunTemplateSpy,
    listOpenQuestionsForSession: listOpenQuestionsSpy,
    updateWorkflowRunOrchestrationOutcome: updateOutcomeSpy,
    updateWorkflowRunOrchestrationStop: updateStopSpy,
    updateWorkflowRunOrchestratorSummary: updateSummarySpy,
    updateWorkflowRunOrchestratorHints: updateHintsSpy,
    updateWorkflowRunRulesSnapshot: updateRulesSpy,
    getWorkflowRunRulesText: vi.fn(async () => null),
    insertProviderRun: insertProviderRunSpy,
    updateProviderRunStatus: updateProviderRunStatusSpy,
    insertTelemetry: insertTelemetrySpy,
    summarizeSessionTelemetry: summarizeSessionSpy,
    summarizeWorkspaceTelemetry: summarizeWorkspaceSpy,
  }),
);

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeWorkflowUpsert: invokeWorkflowUpsertSpy,
  invokeAgentInsert: invokeAgentInsertSpy,
}));

import type {
  OrchestratorClientDeps,
  OrchestratorDecision,
  OrchestratorInput,
} from '@goodboy/core';
import { OrchestratorClient, OrchestratorClientSpawnError, AUTO_DEFAULTS } from '@goodboy/core';
import { orchestrateNextStep, persistOrchestrationStop } from './orchestrateNextStep';
import { requestDecisionRestart } from './decisionRestart';
import { addStepToWorkflowRun } from './addStepToWorkflowRun';
import { continueWorkflowRun } from './continueWorkflowRun';
import { maybeAutoAdvanceWorkflow } from './maybeAutoAdvanceWorkflow';
import { resolvePresetChange } from './resolvePresetChange';
import { updateWorkflowRunRules } from './updateWorkflowRunRules';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const CLONE_WORKFLOW_ID = 'workflow-2' as WorkflowId;
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

const openQuestion = (): OpenQuestion => ({
  id: 'oq-1' as OpenQuestionId,
  sessionId: SESSION_ID,
  workflowRunId: WORKFLOW_RUN_ID,
  text: 'which database?',
  suggestedAnswers: [],
  isBlocking: false,
  userAnswer: null,
  status: 'open',
  createdAt: NOW,
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
    projects: [],
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ],
    providerCooldowns: {},
    budgetAlerts: [],
    sessionBudgets: {},
    loadSessionBudget: vi.fn(async () => undefined),
    phaseTemplates: { [WORKSPACE_ID]: [template] },
    sessionWorkflows: { [SESSION_ID]: [template] },
    sessionPhaseRuns: { [SESSION_ID]: [completedAgent()] },
    workspaceOverrides: {},
    sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
    sessionProjectMounts: {},
    sessionActiveProject: {},
    sessionBranches: { [SESSION_ID]: 'ak/workflow' },
    selectedAgentId: { [SESSION_ID]: AGENT_ID },
    transcripts: { [AGENT_ID]: [] },
    sessionTelemetry: {},
    summarizerStatus: {},
    agentRunHistory: {},
    agentTurnState: {},
    agentModelOverride: {},
    agentKindOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    announcedRunBudget: {},
    decisionRestartMarks: {},
    orchestratorReadingHints: {},
    loadSessionTelemetry: vi.fn(async () => undefined),
    appendTurnEvent: vi.fn(),
    activateWorkflowAgent: vi.fn(async () => undefined),
    resolveNotifications: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
    maybeAutoAdvanceWorkflow: vi.fn(async () => undefined),
  };
};

const modelPickState = (): State => {
  const state = baseState();
  const base = session();
  state['sessions'] = [
    {
      ...base,
      workflowRuns: [
        {
          ...base.workflowRuns[0]!,
          rulesSnapshot: {
            ...DEFAULT_WORKFLOW_RULES,
            spreadByHeadroom: false,
            canOrchestratorPickModel: true,
          },
        },
      ],
    },
  ];
  return state;
};

type SpendParams = {
  readonly limitUsd: number;
  readonly spentUsd: number;
  readonly mode?: WorkflowSpendLimitMode;
};

const spendState = ({ limitUsd, spentUsd, mode = 'pause' }: SpendParams): State => {
  const state = baseState();
  const base = session();
  state['sessions'] = [
    {
      ...base,
      workflowRuns: [{ ...base.workflowRuns[0]!, spendLimitUsd: limitUsd, spendLimitMode: mode }],
    },
  ];
  state['sessionPhaseRuns'] = {
    [SESSION_ID]: [{ ...completedAgent(), runId: 'pr-1' as ProviderRunId }],
  };
  state['sessionTelemetry'] = {
    [SESSION_ID]: [
      { runId: 'pr-1', kind: 'turn', estimatedCostUsd: spentUsd } as unknown as TelemetryRecord,
    ],
  };
  return state;
};

const savedStep = (): Record<string, unknown> =>
  invokeWorkflowUpsertSpy.mock.calls[0]![0].steps[1] as Record<string, unknown>;

const modelMenuIdentities = (): ReadonlyArray<string> =>
  (decideSpy.mock.calls[0]![0].modelMenu as ReadonlyArray<{ provider: string; model: string }>).map(
    (option) => `${option.provider}/${option.model}`,
  );

const rejectDecisions = (error: Error, times: number): void => {
  for (let index = 0; index < times; index += 1) {
    decideSpy.mockRejectedValueOnce(error);
  }
};

type DecideNextParams = Omit<Extract<OrchestratorDecision, { action: 'next' }>, 'action'>;

const decideNext = (fields: DecideNextParams): void => {
  decideSpy.mockResolvedValue({ usage: NO_USAGE, decision: { action: 'next', ...fields } });
};

const anthropicReply = (text: string): string =>
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: text,
    usage: { input_tokens: 1200, output_tokens: 240 },
  });

const OPERATOR_STOP = {
  kind: 'operator',
  message: 'You stopped this run. The step in flight was skipped.',
} as const;

const stopFromOperator = async (set: never): Promise<void> =>
  persistOrchestrationStop({
    set,
    sessionId: SESSION_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    stop: OPERATOR_STOP,
  });

const HINT_AT = '2026-09-23T10:00:00.000Z' as IsoDateTime;

const hintFixture = (over: Partial<OrchestratorHint>): OrchestratorHint => ({
  id: 'hint',
  text: 'keep it to one PR',
  createdAt: HINT_AT,
  ...over,
});

const withHints = (state: State, hints: ReadonlyArray<OrchestratorHint>): State => {
  const sessions = state['sessions'] as ReadonlyArray<Session>;
  return {
    ...state,
    sessions: [
      {
        ...sessions[0]!,
        workflowRuns: [{ ...sessions[0]!.workflowRuns[0]!, orchestratorHints: hints }],
      },
      ...sessions.slice(1),
    ],
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
  const get = () => state;
  if (typeof state['orchestrateNextStep'] !== 'function') {
    state['orchestrateNextStep'] = orchestrateNextStep(set as never, get as never);
  }
  return { set: set as never, get: get as never };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  orchestratorTransport.stdout = null;
  orchestratorTransport.requests.length = 0;
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
  it('queues one merged rerun while orchestration is in flight', async () => {
    const openQuestionsGate: { release: (() => void) | null } = { release: null };
    listOpenQuestionsSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          openQuestionsGate.release = () => resolve([]);
        }),
    );
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
      decision: { action: 'done', reason: 'all set' },
    });
    const state = baseState();
    state['pendingOrchestrations'] = {};
    const { set, get } = harness(state);
    const orchestrate = vi.fn(orchestrateNextStep(set, get));
    state['orchestrateNextStep'] = orchestrate;

    const first = orchestrate(SESSION_ID, WORKFLOW_RUN_ID);
    await vi.waitFor(() => expect(listOpenQuestionsSpy).toHaveBeenCalledTimes(1));
    await orchestrate(SESSION_ID, WORKFLOW_RUN_ID, {
      bypassGate: true,
      routing: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
    });

    expect(decideSpy).not.toHaveBeenCalled();
    expect(state['pendingOrchestrations']).toEqual({
      [WORKFLOW_RUN_ID]: {
        sessionId: SESSION_ID,
        bypassGate: true,
        routing: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
      },
    });

    if (openQuestionsGate.release == null) {
      throw new Error('open questions gate was not reached');
    }
    openQuestionsGate.release();
    await first;
    await vi.waitFor(() => expect(orchestrate).toHaveBeenCalledTimes(3));

    expect(orchestrate).toHaveBeenLastCalledWith(SESSION_ID, WORKFLOW_RUN_ID, {
      bypassGate: true,
      routing: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
    });
    expect(state['pendingOrchestrations']).toEqual({});
  });

  it('coalesces three concurrent calls into one rerun with the last routing', async () => {
    const openQuestionsGate: { release: (() => void) | null } = { release: null };
    listOpenQuestionsSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          openQuestionsGate.release = () => resolve([]);
        }),
    );
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
      decision: { action: 'done', reason: 'all set' },
    });
    const state = baseState();
    state['pendingOrchestrations'] = {};
    const { set, get } = harness(state);
    const orchestrate = vi.fn(orchestrateNextStep(set, get));
    state['orchestrateNextStep'] = orchestrate;

    const first = orchestrate(SESSION_ID, WORKFLOW_RUN_ID);
    await vi.waitFor(() => expect(listOpenQuestionsSpy).toHaveBeenCalledTimes(1));
    await orchestrate(SESSION_ID, WORKFLOW_RUN_ID, {
      routing: { providerId: 'anthropic', model: 'claude-haiku-4-5' },
    });
    await orchestrate(SESSION_ID, WORKFLOW_RUN_ID, {
      bypassGate: true,
      routing: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
    });
    await orchestrate(SESSION_ID, WORKFLOW_RUN_ID);

    if (openQuestionsGate.release == null) {
      throw new Error('open questions gate was not reached');
    }
    openQuestionsGate.release();
    await first;
    await vi.waitFor(() => expect(orchestrate).toHaveBeenCalledTimes(5));

    expect(orchestrate).toHaveBeenLastCalledWith(SESSION_ID, WORKFLOW_RUN_ID, {
      bypassGate: true,
      routing: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
    });
    expect(state['pendingOrchestrations']).toEqual({});
  });

  it('returns before doing work when the run already has an operator stop', async () => {
    const state = baseState();
    const sessions = state['sessions'] as ReadonlyArray<Session>;
    state['sessions'] = [
      {
        ...sessions[0]!,
        workflowRuns: [{ ...sessions[0]!.workflowRuns[0]!, orchestrationStop: OPERATOR_STOP }],
      },
    ];
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).not.toHaveBeenCalled();
    expect(listOpenQuestionsSpy).not.toHaveBeenCalled();
    expect(updateStopSpy).not.toHaveBeenCalled();
    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
  });

  it('refuses a manual step from the moment it snapshots the workflow', async () => {
    const gate: { release: (() => void) | null } = { release: null };
    listOpenQuestionsSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          gate.release = () => resolve([]);
        }),
    );
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'all set' },
    });
    const state = baseState();
    const { set, get } = harness(state);
    const pending = orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    await vi.waitFor(() => expect(listOpenQuestionsSpy).toHaveBeenCalledTimes(1));

    const outcome = await addStepToWorkflowRun(
      set,
      get,
    )({
      sessionId: SESSION_ID,
      workflowRunId: WORKFLOW_RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });
    const upsertsDuringDecision = invokeWorkflowUpsertSpy.mock.calls.length;

    if (gate.release == null) {
      throw new Error('the activation gate was not reached');
    }
    gate.release();
    await pending;

    expect(outcome).toEqual({
      kind: 'refused',
      reason: 'the orchestrator is choosing the next step',
    });
    expect(upsertsDuringDecision).toBe(0);
    expect(state['orchestratingWorkflowRuns']).toEqual({ [WORKFLOW_RUN_ID]: false });
  });

  it('appends to the workflow the run points at now, not the snapshot it started from', async () => {
    const gate: { release: (() => void) | null } = { release: null };
    listOpenQuestionsSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          gate.release = () => resolve([]);
        }),
    );
    decideNext({
      reason: 'The implementation is ready.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Implement the mapped change.',
        expectedOutput: 'A tested implementation.',
      },
    });
    invokeWorkflowUpsertSpy.mockImplementation(async (input: Record<string, unknown>) => ({
      ...workflow(),
      id: input['id'],
      steps: input['steps'],
    }));
    const state = baseState();
    const { set, get } = harness(state);
    const pending = orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    await vi.waitFor(() => expect(listOpenQuestionsSpy).toHaveBeenCalledTimes(1));

    const clone: Workflow = {
      ...workflow(),
      id: CLONE_WORKFLOW_ID,
      isPreset: false,
      steps: [
        ...workflow().steps,
        {
          id: 'step-manual' as StepId,
          workflowId: CLONE_WORKFLOW_ID,
          ordinal: 1,
          name: 'Review',
          role: 'reviewer',
          promptPrefix: 'Check the change.',
        },
      ],
    };
    const current = state['sessions'] as ReadonlyArray<Session>;
    state['sessions'] = [
      {
        ...current[0]!,
        workflowRuns: [{ ...current[0]!.workflowRuns[0]!, workflowId: CLONE_WORKFLOW_ID }],
      },
    ];
    state['phaseTemplates'] = { [WORKSPACE_ID]: [clone] };

    if (gate.release == null) {
      throw new Error('the activation gate was not reached');
    }
    gate.release();
    await pending;

    const upsert = invokeWorkflowUpsertSpy.mock.calls[0]![0] as {
      readonly id: WorkflowId;
      readonly steps: ReadonlyArray<Record<string, unknown>>;
    };
    expect(upsert.id).toBe(CLONE_WORKFLOW_ID);
    expect(upsert.steps.map((step) => step['name'])).toEqual(['Scout', 'Review', 'Implement']);
    const templates = (state['phaseTemplates'] as Record<string, ReadonlyArray<Workflow>>)[
      WORKSPACE_ID
    ]!;
    expect(templates[0]!.steps).toHaveLength(3);
  });

  it('appends a real step and agent, emits the decision, and activates it', async () => {
    decideNext({
      reason: 'The implementation is ready.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Implement the mapped change.',
        expectedOutput: 'A tested implementation.',
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const templates = state['phaseTemplates'] as Record<string, ReadonlyArray<Workflow>>;
    expect(templates[WORKSPACE_ID]![0]!.steps).toHaveLength(2);
    const agents = (state['sessionPhaseRuns'] as Record<string, ReadonlyArray<Agent>>)[SESSION_ID]!;
    expect(agents[1]).toMatchObject({ name: 'Implement', status: 'pending' });
    expect(state['activateWorkflowAgent']).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: 'agent-2',
      focus: 'announce',
      bypassGate: true,
    });
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
    decideNext({
      reason: 'Inspect again.',
      step: {
        name: 'Scout',
        role: 'scout',
        promptPrefix: 'Inspect another area.',
        expectedOutput: 'An updated map.',
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeWorkflowUpsertSpy.mock.calls[0]![0].steps[1].name).toBe('Scout 2');
  });

  it('spawns a decided scout step on the scout role model, not on an expensive one', async () => {
    decideNext({
      reason: 'Survey first.',
      step: {
        name: 'Survey the routing code',
        role: 'scout',
        promptPrefix: 'Survey the routing code.',
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['kind']).toBe('scout');
    expect(insert['modelOverride']).toBe(AUTO_DEFAULTS.anthropic.scout[0]?.key);
    expect(insert['effort']).toBe(AUTO_DEFAULTS.anthropic.scout[0]?.effort);
  });

  it('still spawns a decided step on the model the orchestrator picked for it', async () => {
    decideNext({
      reason: 'This one is hard.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Implement the change.',
        model: 'opus-5',
        effort: 'max',
      },
    });
    const state = modelPickState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        modelOverride: 'opus-5',
        effort: 'max',
      }),
    );
  });

  it('offers every connected provider catalog, not only what the roles reach', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'all set' },
    });
    const state = modelPickState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const identities = modelMenuIdentities();

    expect(identities).toContain('anthropic/fable-5');
    expect(identities.some((identity) => identity.startsWith('codex/'))).toBe(true);
    expect(identities.some((identity) => identity.startsWith('gemini/'))).toBe(false);
  });

  it('metadata reaches the provider request', async () => {
    orchestratorTransport.stdout = anthropicReply(
      [
        '<<orchestrator>>',
        JSON.stringify({
          action: 'next',
          reason: 'The resolver rewrite still needs an implementer.',
          step: {
            name: 'Implement',
            role: 'implementer',
            promptPrefix: 'Rewrite the resolver.',
            provider: 'codex',
            model: 'gpt-5.6-sol',
            effort: 'high',
            taskType: 'implementation',
            difficulty: 'heavy',
            modelReason: 'A precedence rewrite needs the deepest model available.',
          },
        }),
        '<</orchestrator>>',
      ].join('\n'),
    );
    const { set, get } = harness(modelPickState());

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(orchestratorTransport.requests).toHaveLength(1);
    const request = orchestratorTransport.requests[0]!;
    expect(request['toolsDisabled']).toBe(true);
    const prompt = request['userMessage'] as string;

    expect(prompt).toContain(
      'Codes: exp=exploration, pln=planning, imp=implementation, dbg=debugging, rev=review, tst=testing, wrt=writing, gen=general; lt=light, st=standard, hv=heavy, uk=unknown.',
    );
    expect(prompt).toContain(
      'anthropic/opus-5.5 efforts low,medium,high,xhigh,max unassessed ctx 1000k $4/$20',
    );
    expect(prompt).toContain(
      'anthropic/opus-5 efforts low,medium,high,xhigh,max unassessed ctx 1000k $5/$25',
    );
    expect(prompt).toContain(
      'codex/gpt-5.6-sol efforts low,medium,high,xhigh,max unassessed ctx 272k $4/$20',
    );
    expect(prompt).toContain(
      'anthropic/haiku-4.5 efforts no effort control unassessed ctx 200k $1/$5',
    );
    expect(prompt).not.toContain('gemini/');

    const menuLines = prompt
      .split('\n')
      .filter((line) => line.startsWith('anthropic/') || line.startsWith('codex/'));
    expect(menuLines).toHaveLength(16);
    expect(menuLines.some((line) => line.startsWith('anthropic/sonnet-4.5 '))).toBe(false);
    for (const line of menuLines) {
      expect(line).toContain('unassessed');
      expect(line).toMatch(/ ctx \d+k \$[\d.]+\/\$[\d.]+$/);
    }

    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6-sol',
        effort: 'high',
      }),
    );
  });

  it('drops a cooling provider out of the menu it offers', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'all set' },
    });
    const state = modelPickState();
    state['providerCooldowns'] = { codex: Date.now() + 60_000 };
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(modelMenuIdentities().some((identity) => identity.startsWith('codex/'))).toBe(false);
  });

  it('offers only the providers the run was allowed to use', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'all set' },
    });
    const state = modelPickState();
    const base = session();
    state['sessions'] = [
      { ...base, workflowRuns: [{ ...base.workflowRuns[0]!, providerPool: ['codex'] }] },
    ];
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const identities = modelMenuIdentities();
    expect(identities.length).toBeGreaterThan(0);
    expect(identities.every((identity) => identity.startsWith('codex/'))).toBe(true);
  });

  it('moves a pick outside the run pool onto a provider the run may use', async () => {
    decideNext({
      reason: 'This one is hard.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Implement the change.',
        model: 'fable-5',
        effort: 'max',
        modelReason: 'The refactor spans the whole router.',
      },
    });
    const state = modelPickState();
    const base = session();
    state['sessions'] = [
      { ...base, workflowRuns: [{ ...base.workflowRuns[0]!, providerPool: ['codex'] }] },
    ];
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ providerOverride: 'codex' }),
    );
  });

  it('runs an available pick no role default reaches, without a rejection notice', async () => {
    decideNext({
      reason: 'This one is hard.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Implement the change.',
        model: 'fable-5',
        effort: 'max',
        modelReason: 'The refactor spans the whole router.',
      },
    });
    const state = modelPickState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOverride: 'anthropic',
        modelOverride: 'fable-5',
        effort: 'max',
      }),
    );
    expect(savedStep().routingDecision).toMatchObject({
      selected: { provider: 'anthropic', model: 'fable-5', effort: 'max' },
      source: 'agent',
      adjustment: 'none',
    });
    expect(state['emitNotification']).not.toHaveBeenCalled();
  });

  it('stores the task profile the orchestrator emitted', async () => {
    decideNext({
      reason: 'This one is hard.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Implement the change.',
        model: 'fable-5',
        effort: 'max',
        taskType: 'implementation',
        difficulty: 'heavy',
        modelReason: 'The refactor spans the whole router.',
      },
    });
    const { set, get } = harness(modelPickState());

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(savedStep().taskProfile).toEqual({
      taskType: 'implementation',
      difficulty: 'heavy',
      basis: 'agent',
    });
    expect(savedStep().routingDecision).toMatchObject({
      reason: 'The refactor spans the whole router.',
    });
    expect(savedStep().orchestratorReason).toBe('This one is hard.');
  });

  it('labels a difficulty it read off the step text as heuristic', async () => {
    decideNext({
      reason: 'This one is hard.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: [
          'Rework the migration runner so every segment is transactional.',
          '```ts',
          'const run = () => {};',
          '```',
        ].join('\n'),
        model: 'fable-5',
      },
    });
    const { set, get } = harness(modelPickState());

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(savedStep().taskProfile).toEqual({
      taskType: 'general',
      difficulty: 'heavy',
      basis: 'heuristic',
    });
    expect(decideSpy.mock.calls[0]![0].isModelMetadataEnabled).toBe(true);
  });

  it('runs a pick from another connected provider than the one deciding', async () => {
    decideNext({
      reason: 'This one is hard.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Implement the change.',
        provider: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'high',
      },
    });
    const state = modelPickState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6-sol',
        effort: 'high',
      }),
    );
  });

  it('replaces a model no catalog knows with an available recommendation', async () => {
    decideNext({
      reason: 'This one is hard.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Implement the change.',
        model: 'gpt-9-imaginary',
      },
    });
    const state = modelPickState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const decision = savedStep().routingDecision as {
      source: string;
      adjustment: string;
      selected: { provider: string; model: string };
    };

    expect(decision.source).toBe('kind_default');
    expect(decision.adjustment).toBe('unknown_model');
    expect(decision.selected).toMatchObject({
      provider: 'anthropic',
      model: AUTO_DEFAULTS.anthropic.implementer[0]?.key,
    });
  });

  it('ignores the model a step names while the model pick rule is off and sizes it by difficulty', async () => {
    decideNext({
      reason: 'A small edit.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Rename the helper.',
        provider: 'anthropic',
        model: 'opus-5',
        effort: 'max',
        taskType: 'implementation',
        difficulty: 'light',
      },
    });
    const { set, get } = harness(baseState());

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).toHaveBeenCalledWith(expect.objectContaining({ isModelPickEnabled: false }));
    expect(savedStep().routingDecision).toMatchObject({ proposal: null });
    expect(savedStep().routingDecision).not.toMatchObject({ source: 'agent' });
    expect(savedStep().routingDecision).not.toMatchObject({ selected: { model: 'opus-5' } });
  });

  it('passes the opt-in rule to the decision', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'all set' },
    });
    const { set, get } = harness(modelPickState());

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).toHaveBeenCalledWith(expect.objectContaining({ isModelPickEnabled: true }));
  });

  it('keeps the step reason about the work, not about routing', async () => {
    decideNext({
      reason: 'The scout located the failure.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Implement the change.',
        model: 'gpt-9-imaginary',
      },
    });
    const state = modelPickState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(savedStep().orchestratorReason).toBe('The scout located the failure.');
    expect(state['emitNotification']).not.toHaveBeenCalled();
  });

  it('normalizes an unsupported effort against the model that actually runs', async () => {
    decideNext({
      reason: 'This one is hard.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Implement the change.',
        provider: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'minimal',
      },
    });
    const state = modelPickState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const decision = savedStep().routingDecision as {
      adjustment: string;
      selected: { provider: string; effort: string | null };
    };
    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as { effort: string };

    expect(decision.selected.provider).toBe('codex');
    expect(decision.selected.effort).not.toBe('minimal');
    expect(insert.effort).toBe(decision.selected.effort);
  });

  it('stays quiet when the picked model is inside the pool', async () => {
    decideNext({
      reason: 'This one is hard.',
      step: {
        name: 'Implement',
        role: 'implementer',
        promptPrefix: 'Implement the change.',
        model: 'opus-5',
      },
    });
    const state = modelPickState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(state['emitNotification']).not.toHaveBeenCalled();
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
    expect(state['emitNotification']).not.toHaveBeenCalled();
    expect(updateOutcomeSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, 'done', expect.any(String));
    const updated = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(updated.orchestrationOutcome).toBe('done');
  });

  it('keeps the run recap the decision came with', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'done',
        reason: 'All required tests pass.',
        runSummary: { kind: 'structured', done: ['shipped the gate'], left: [], leftRoles: {} },
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const serialized = JSON.stringify({ done: ['shipped the gate'], left: [] });
    expect(updateSummarySpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, serialized);
    const updated = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(updated.orchestratorSummary).toBe(serialized);
  });

  it('leaves the previous recap alone when a decision carries none', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'All required tests pass.' },
    });
    const state = baseState();
    const current = (state['sessions'] as ReadonlyArray<Session>)[0]!;
    state['sessions'] = [
      {
        ...current,
        workflowRuns: current.workflowRuns.map((run) => ({
          ...run,
          orchestratorSummary: 'the earlier recap',
        })),
      },
    ];
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(updateSummarySpy).not.toHaveBeenCalled();
    const updated = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(updated.orchestratorSummary).toBe('the earlier recap');
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

  it('notifies when blocked, as plain text, and leaves the queued hints unread', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'blocked', reason: '**A product choice** is required.' },
    });
    const state = withHints(baseState(), [hintFixture({ id: 'queued', text: 'ship the copy' })]);
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(state['emitNotification']).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: 'Orchestrated run blocked',
        body: 'A product choice is required.',
        sessionId: SESSION_ID,
        action: { kind: 'open-agent', sessionId: SESSION_ID, agentId: AGENT_ID },
        coalesceKey: `orchestrator-blocked:${WORKFLOW_RUN_ID}`,
        isOnce: true,
      }),
    );
    expect(updateOutcomeSpy).toHaveBeenCalledWith(
      {},
      WORKFLOW_RUN_ID,
      'blocked',
      expect.any(String),
    );
    const updated = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(updated.orchestrationOutcome).toBe('blocked');
    expect(updated.orchestratorHints?.[0]?.consumedAt).toBeUndefined();
  });

  it('marks the queued hints read only once the next step exists', async () => {
    decideNext({
      reason: 'Ship the copy.',
      step: { name: 'Implement', role: 'implementer', promptPrefix: 'Ship the copy.' },
    });
    const state = withHints(baseState(), [hintFixture({ id: 'queued', text: 'ship the copy' })]);
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(updateHintsSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, [
      expect.objectContaining({ id: 'queued', consumedAt: expect.any(String) }),
    ]);
  });

  it('keeps the queued hints unread when the next step could not be created', async () => {
    decideNext({
      reason: 'Ship the copy.',
      step: { name: 'Implement', role: 'implementer', promptPrefix: 'Ship the copy.' },
    });
    invokeWorkflowUpsertSpy.mockRejectedValue(new Error('database is locked'));
    const state = withHints(baseState(), [hintFixture({ id: 'queued', text: 'ship the copy' })]);
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(updateHintsSpy).not.toHaveBeenCalled();
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
  });

  it('recovers from a client failure without persisting an outcome', async () => {
    rejectDecisions(new Error('orchestrator decision timed out'), 2);
    const state = baseState();
    const { set, get } = harness(state);
    const orchestrate = orchestrateNextStep(set, get);

    await orchestrate(SESSION_ID, WORKFLOW_RUN_ID);

    expect(state['emitNotification']).toHaveBeenCalledTimes(1);
    expect(state['emitNotification']).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: 'The orchestrator failed',
        body: expect.stringContaining('the orchestrator timed out after 120s'),
        sessionId: SESSION_ID,
        action: {
          kind: 'retry-orchestrator',
          sessionId: SESSION_ID,
          workflowRunId: WORKFLOW_RUN_ID,
        },
        coalesceKey: `orchestrator-failed:${WORKFLOW_RUN_ID}`,
        isOnce: true,
      }),
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

    expect(decideSpy).toHaveBeenCalledTimes(3);
    expect(updateOutcomeSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, 'done', expect.any(String));
    expect(state['resolveNotifications']).toHaveBeenCalledWith([
      `orchestrator-unreadable:${WORKFLOW_RUN_ID}`,
      `orchestrator-failed:${WORKFLOW_RUN_ID}`,
      `orchestrator-blocked:${WORKFLOW_RUN_ID}`,
    ]);
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
    expect(decideSpy).toHaveBeenCalledTimes(4);
    expect(state['emitNotification']).toHaveBeenCalledTimes(1);
    expect(state['emitNotification']).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: "Couldn't read the orchestrator's reply",
        body: 'Claude, Codex replied with something that is not a decision. Retry to ask again.',
        sessionId: SESSION_ID,
        action: {
          kind: 'retry-orchestrator',
          sessionId: SESSION_ID,
          workflowRunId: WORKFLOW_RUN_ID,
        },
        coalesceKey: `orchestrator-unreadable:${WORKFLOW_RUN_ID}`,
        isOnce: true,
      }),
    );
    expect(insertTelemetrySpy).toHaveBeenCalledTimes(4);
  });

  it('reads the reply again on another model before telling the owner', async () => {
    decideSpy
      .mockResolvedValueOnce({ decision: null, usage: BILLED_USAGE, model: 'claude-haiku-4-5' })
      .mockResolvedValueOnce({ decision: null, usage: BILLED_USAGE, model: 'claude-haiku-4-5' })
      .mockResolvedValueOnce({
        decision: { action: 'done', reason: 'All required tests pass.' },
        usage: NO_USAGE,
        model: 'gpt-5.6-terra',
      });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(OrchestratorClient).toHaveBeenCalledTimes(3);
    expect(updateOutcomeSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, 'done', expect.any(String));
    expect(state['emitNotification']).not.toHaveBeenCalled();
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
  it('names the cli cause instead of a bare exit code', async () => {
    rejectDecisions(
      new OrchestratorClientSpawnError(
        1,
        'Reading additional input from stdin...\nNot inside a trusted directory and --skip-git-repo-check was not specified.\n',
      ),
      4,
    );
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(updateStopSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, {
      kind: 'failure',
      message: expect.stringContaining(
        'orchestrator cli exited with code 1: Not inside a trusted directory',
      ),
    });
  });
  it('persists the failure so the run can explain itself, and clears it on the next decision', async () => {
    rejectDecisions(new Error('usage limit reached'), 2);
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
    expect(failed.orchestrationStop?.message).toContain('codex');

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

  it('keeps a stop the operator wrote while the decision was still in flight', async () => {
    const state = baseState();
    const { set, get } = harness(state);
    decideSpy.mockImplementationOnce(async () => {
      const sessions = state['sessions'] as ReadonlyArray<Session>;
      state['sessions'] = [
        {
          ...sessions[0]!,
          workflowRuns: [
            {
              ...sessions[0]!.workflowRuns[0]!,
              autoRun: false,
              orchestrationStop: { kind: 'operator', message: 'You stopped this run.' },
            },
          ],
        },
      ];
      return {
        decision: {
          action: 'next',
          reason: 'Keep going.',
          step: {
            name: 'Implement',
            role: 'implementer',
            promptPrefix: 'Implement the mapped change.',
          },
        },
        usage: NO_USAGE,
        model: 'claude-haiku-4-5',
      };
    });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const stopped = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(stopped.orchestrationStop?.kind).toBe('operator');
    expect(updateStopSpy).not.toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, null);
    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
  });

  it('reads as stopped by you when the decision in flight then throws', async () => {
    const state = baseState();
    const { set, get } = harness(state);
    decideSpy.mockImplementationOnce(async () => {
      await stopFromOperator(set);
      throw new Error('the orchestrator timed out after 120s');
    });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const stopped = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(stopped.orchestrationStop).toEqual(OPERATOR_STOP);
    expect(updateStopSpy).toHaveBeenLastCalledWith({}, WORKFLOW_RUN_ID, OPERATOR_STOP);
    expect(state['appendTurnEvent']).not.toHaveBeenCalled();
    expect(state['emitNotification']).not.toHaveBeenCalled();
  });

  it('reads as stopped by you when the reply in flight is not a decision', async () => {
    const state = baseState();
    const { set, get } = harness(state);
    decideSpy.mockImplementationOnce(async () => {
      await stopFromOperator(set);
      return { decision: null, usage: BILLED_USAGE, model: 'claude-haiku-4-5' };
    });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const stopped = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(stopped.orchestrationStop).toEqual(OPERATOR_STOP);
    expect(updateStopSpy).toHaveBeenLastCalledWith({}, WORKFLOW_RUN_ID, OPERATOR_STOP);
    expect(state['appendTurnEvent']).not.toHaveBeenCalled();
    expect(insertTelemetrySpy).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ kind: 'orchestrator', estimatedCostUsd: 0.0123 }),
    );
  });

  it('hands every hint of the run to the orchestrator, marking the new ones', async () => {
    const state = withHints(baseState(), [
      hintFixture({ id: 'read', text: 'ignore the docs', consumedAt: HINT_AT, consumedAtStep: 1 }),
      hintFixture({ id: 'queued', text: 'run a reviewer first' }),
    ]);
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const input = decideSpy.mock.calls[0]?.[0] as OrchestratorInput;
    expect(input.operatorHints).toContain('[since step 1] ignore the docs');
    expect(input.operatorHints).toContain('[new] run a reviewer first');
  });

  it('hands the orchestrator the workspace projects with the starred one first', async () => {
    const state = {
      ...baseState(),
      projects: [
        { id: 'project-relay', workspaceId: WORKSPACE_ID, name: 'notify-relay', kind: 'repo' },
        {
          id: 'project-ledger',
          workspaceId: WORKSPACE_ID,
          name: 'ledger-core',
          kind: 'repo',
          starredAt: HINT_AT,
          description: 'Settles payments',
        },
      ],
    };
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const input = decideSpy.mock.calls[0]?.[0] as OrchestratorInput;
    expect(input.operatorHints).toContain(
      '- ledger-core (repo) | starred, the owner works here most | Settles payments\n- notify-relay (repo)',
    );
    expect(input.operatorHints).toContain(
      'When a request names no project, look in starred projects first.',
    );
  });

  it('stamps the queued hints with the decision that first read them', async () => {
    const state = withHints(baseState(), [
      hintFixture({ id: 'read', text: 'ignore the docs', consumedAt: HINT_AT, consumedAtStep: 1 }),
      hintFixture({ id: 'queued', text: 'run a reviewer first' }),
    ]);
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const hints = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!
      .orchestratorHints;
    const queued = hints?.find((hint) => hint.id === 'queued');
    expect(queued?.consumedAt).toBeDefined();
    expect(queued?.consumedAtStep).toBeGreaterThan(0);
    expect(hints?.find((hint) => hint.id === 'read')?.consumedAtStep).toBe(1);
    expect(updateHintsSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, hints);
  });

  it('says which hints the decision in flight is reading, and forgets them once it lands', async () => {
    const state = withHints(baseState(), [
      hintFixture({ id: 'read', text: 'ignore the docs', consumedAt: HINT_AT, consumedAtStep: 1 }),
      hintFixture({ id: 'queued', text: 'run a reviewer first' }),
    ]);
    let readingDuringDecision: unknown;
    decideSpy.mockImplementationOnce(async () => {
      readingDuringDecision = state['orchestratorReadingHints'];
      return {
        decision: { action: 'done', reason: 'all set' },
        usage: NO_USAGE,
        model: 'claude-haiku-4-5',
      };
    });
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(readingDuringDecision).toEqual({ [WORKFLOW_RUN_ID]: ['queued'] });
    expect(state['orchestratorReadingHints']).toEqual({});
  });

  it('keeps a hint reading while a restarted decision is still to come', async () => {
    const state = withHints(baseState(), [hintFixture({ id: 'queued', text: 'no PR' })]);
    state['pendingOrchestrations'] = {};
    const { set, get } = harness(state);
    const readingHistory: Array<unknown> = [];
    const recordingSet = ((updater: unknown) => {
      (set as (value: unknown) => void)(updater);
      readingHistory.push(state['orchestratorReadingHints']);
    }) as never;
    decideSpy.mockImplementationOnce(async () => {
      state['pendingOrchestrations'] = {
        [WORKFLOW_RUN_ID]: { sessionId: SESSION_ID, bypassGate: false },
      };
      requestDecisionRestart({ set, workflowRunId: WORKFLOW_RUN_ID });
      return {
        decision: { action: 'done', reason: 'all set' },
        usage: NO_USAGE,
        model: 'claude-haiku-4-5',
      };
    });
    let historyAtRestart: ReadonlyArray<unknown> = [];
    decideSpy.mockImplementationOnce(async () => {
      historyAtRestart = [...readingHistory];
      return {
        decision: { action: 'done', reason: 'all set' },
        usage: NO_USAGE,
        model: 'claude-haiku-4-5',
      };
    });

    await orchestrateNextStep(recordingSet, get)(SESSION_ID, WORKFLOW_RUN_ID);
    await vi.waitFor(() => expect(decideSpy).toHaveBeenCalledTimes(2));

    const firstMark = historyAtRestart.findIndex(
      (entry) => entry !== undefined && Object.keys(entry as object).length > 0,
    );
    expect(firstMark).toBeGreaterThanOrEqual(0);
    expect(historyAtRestart.slice(firstMark)).toEqual(
      historyAtRestart.slice(firstMark).map(() => ({ [WORKFLOW_RUN_ID]: ['queued'] })),
    );
    await vi.waitFor(() => expect(state['orchestratorReadingHints']).toEqual({}));
  });

  it('throws away a decision when a hint asks to be read now while it is in flight', async () => {
    const state = baseState();
    const { set, get } = harness(state);
    decideSpy.mockImplementationOnce(async () => {
      Object.assign(
        state,
        withHints(state, [hintFixture({ id: 'late', text: 'no PR, commit locally' })]),
      );
      requestDecisionRestart({ set, workflowRunId: WORKFLOW_RUN_ID });
      return {
        decision: {
          action: 'next',
          reason: 'Keep going.',
          step: {
            name: 'Implement',
            role: 'implementer',
            promptPrefix: 'Implement the mapped change.',
          },
        },
        usage: BILLED_USAGE,
        model: 'claude-haiku-4-5',
      };
    });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
    expect(updateHintsSpy).not.toHaveBeenCalled();
    const late = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!
      .orchestratorHints?.[0];
    expect(late?.consumedAt).toBeUndefined();
    expect(insertTelemetrySpy).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ kind: 'orchestrator', estimatedCostUsd: 0.0123 }),
    );
  });

  it('does not add the step when read now lands after the decision came back', async () => {
    const state = baseState();
    const { set, get } = harness(state);
    decideSpy.mockResolvedValueOnce({
      decision: {
        action: 'next',
        reason: 'Keep going.',
        step: { name: 'Implement', role: 'implementer', promptPrefix: 'Implement it.' },
        runSummary: { kind: 'structured', done: ['mapped'], left: ['implement'], leftRoles: {} },
      },
      usage: BILLED_USAGE,
      model: 'claude-haiku-4-5',
    });
    updateSummarySpy.mockImplementationOnce(async () => {
      requestDecisionRestart({ set, workflowRunId: WORKFLOW_RUN_ID });
    });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
  });

  it('keeps a decision when a hint is only queued while it is in flight', async () => {
    const state = baseState();
    const { set, get } = harness(state);
    decideSpy.mockImplementationOnce(async () => {
      Object.assign(
        state,
        withHints(state, [hintFixture({ id: 'queued', text: 'no PR, commit locally' })]),
      );
      return {
        decision: { action: 'done', reason: 'all set' },
        usage: NO_USAGE,
        model: 'claude-haiku-4-5',
      };
    });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(updateStopSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, null);
    const queued = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!
      .orchestratorHints?.[0];
    expect(queued?.consumedAt).toBeUndefined();
  });

  it('does not report a failure when a read now hint landed while the failing decision was in flight', async () => {
    const state = baseState();
    const { set, get } = harness(state);
    decideSpy.mockImplementationOnce(async () => {
      Object.assign(
        state,
        withHints(state, [hintFixture({ id: 'late', text: 'no PR, commit locally' })]),
      );
      requestDecisionRestart({ set, workflowRunId: WORKFLOW_RUN_ID });
      throw new Error('the orchestrator timed out after 120s');
    });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(updateStopSpy).not.toHaveBeenCalledWith(
      {},
      WORKFLOW_RUN_ID,
      expect.objectContaining({ kind: 'failure' }),
    );
    expect(state['emitNotification']).not.toHaveBeenCalled();
  });

  it('leaves the note off a decision the operator did not write one for', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const appended = state['appendTurnEvent'] as ReturnType<typeof vi.fn>;
    expect(appended.mock.calls[0]![2]).not.toHaveProperty('operatorNote');
  });

  it('routes the decision through the provider handed by the caller', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'gpt-5.6-sol',
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID, {
      routing: { providerId: 'codex', model: 'gpt-5.6-sol' },
    });

    expect(OrchestratorClient).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'codex', model: 'gpt-5.6-sol' }),
    );
  });

  it('routes the decision through the model pinned on the run', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'gpt-5.6-sol',
    });
    const state = baseState();
    const sessions = state['sessions'] as ReadonlyArray<Session>;
    state['sessions'] = [
      {
        ...sessions[0]!,
        workflowRuns: [
          {
            ...sessions[0]!.workflowRuns[0]!,
            orchestratorRouting: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
          },
        ],
      },
    ];
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(OrchestratorClient).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'codex', model: 'gpt-5.6-sol', effort: 'high' }),
    );
  });

  it('falls back to the task model when the pinned routing pairs a model with the wrong provider', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    const sessions = state['sessions'] as ReadonlyArray<Session>;
    state['sessions'] = [
      {
        ...sessions[0]!,
        workflowRuns: [
          {
            ...sessions[0]!.workflowRuns[0]!,
            orchestratorRouting: { providerId: 'anthropic', model: 'glm-5.2-high' },
          },
        ],
      },
    ];
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(OrchestratorClient).not.toHaveBeenCalledWith(
      expect.objectContaining({ model: 'glm-5.2-high' }),
    );
    expect(OrchestratorClient).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'anthropic' }),
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

    expect(decideSpy).toHaveBeenCalledWith(expect.objectContaining({ stepsUsed: 1 }));
  });

  it('tells the orchestrator what the run spent against the limit the operator set', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = spendState({ limitUsd: 20, spentUsd: 3 });
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).toHaveBeenCalledWith(
      expect.objectContaining({ spendLimitUsd: 20, spentUsd: 3 }),
    );
  });

  it('pauses the run once it spends past the limit', async () => {
    const state = spendState({ limitUsd: 5, spentUsd: 6 });
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).not.toHaveBeenCalled();
    expect(updateStopSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, {
      kind: 'budget',
      message: expect.stringContaining('limit for this run'),
    });
  });

  it('keeps deciding past the limit when the operator only asked to be notified', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = spendState({ limitUsd: 5, spentUsd: 6, mode: 'notify' });
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).toHaveBeenCalledTimes(1);
    expect(state['emitNotification']).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'budget-cap',
        severity: 'warning',
        title: 'Run is over its limit',
        body: 'this run passed its $5.00 limit and keeps going',
        sessionId: SESSION_ID,
      }),
    );
  });

  it('announces the same limit once, and again once the operator raises it', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
      decision: {
        action: 'next',
        reason: 'keep going',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Implement the mapped change.',
          expectedOutput: 'A tested implementation.',
        },
      },
    });
    const state = spendState({ limitUsd: 5, spentUsd: 6, mode: 'notify' });
    const { set, get } = harness(state);
    const budgetCalls = () =>
      (state['emitNotification'] as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => (call[0] as { kind: string }).kind === 'budget-cap',
      ).length;

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    expect(budgetCalls()).toBe(1);

    state['sessions'] = spendState({ limitUsd: 6, spentUsd: 6, mode: 'notify' })['sessions'];
    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(budgetCalls()).toBe(2);
  });

  it('refuses to start a step while the session limit is reached', async () => {
    const state = baseState();
    state['budgetAlerts'] = [{ kind: 'session-exceeded', sessionId: SESSION_ID, capUsd: 10 }];
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).not.toHaveBeenCalled();
    expect(updateStopSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, {
      kind: 'budget',
      message: 'Paused at the $10.00 limit for this session.',
    });
    const paused = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(paused.orchestrationStop?.kind).toBe('budget');
  });

  it('stops on an open question before mutating anything, and says so on the run', async () => {
    listOpenQuestionsSpy.mockResolvedValue([openQuestion()]);
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy).not.toHaveBeenCalled();
    expect(invokeAgentInsertSpy).not.toHaveBeenCalled();
    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
    expect(updateStopSpy).toHaveBeenCalledWith({}, WORKFLOW_RUN_ID, {
      kind: 'questions',
      message: expect.stringContaining('Open questions'),
    });
    const paused = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(paused.orchestrationStop?.kind).toBe('questions');
  });

  it('decides anyway when the operator forced a skip, which already cleared the gate', async () => {
    listOpenQuestionsSpy.mockResolvedValue([openQuestion()]);
    decideNext({
      reason: 'The implementation is ready.',
      step: { name: 'Implement', role: 'implementer', promptPrefix: 'Implement it.' },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID, { bypassGate: true });

    expect(decideSpy).toHaveBeenCalledTimes(1);
    expect(state['activateWorkflowAgent']).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: 'agent-2',
      focus: 'announce',
      bypassGate: true,
    });
  });
});

describe('orchestrateNextStep and the runs chained behind it', () => {
  const CHAINED_RUN_ID = 'workflow-run-2' as WorkflowRunId;

  const chainedState = (): State => {
    const state = baseState();
    const base = session();
    const chained: WorkflowRun = {
      id: CHAINED_RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'after_run',
      chainAfterId: WORKFLOW_RUN_ID,
      executionMode: 'static',
    };
    state['sessions'] = [{ ...base, workflowRuns: [...base.workflowRuns, chained] }];
    state['budgetAlerts'] = [];
    state['startWorkflowRun'] = vi.fn(async () => undefined);
    return state;
  };

  it('starts the chained run once the dynamic predecessor lands done', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'Every step landed.' },
    });
    const state = chainedState();
    const { set, get } = harness(state);
    state['maybeAutoAdvanceWorkflow'] = maybeAutoAdvanceWorkflow(set, get);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    await vi.waitFor(() =>
      expect(state['startWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, CHAINED_RUN_ID),
    );
  });

  it('leaves the chain asleep when the orchestration ends blocked', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'blocked', reason: 'The repository has no tests.' },
    });
    const state = chainedState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(state['maybeAutoAdvanceWorkflow']).not.toHaveBeenCalled();
    expect(state['startWorkflowRun']).not.toHaveBeenCalled();
  });

  it('leaves the chain asleep when the orchestrator call fails', async () => {
    decideSpy.mockRejectedValue(new Error('provider exploded'));
    const state = chainedState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(state['maybeAutoAdvanceWorkflow']).not.toHaveBeenCalled();
    expect(state['startWorkflowRun']).not.toHaveBeenCalled();
  });
});

type PresetStateParams = {
  readonly closeness: 'follow' | 'adapt';
  readonly isPinned?: boolean;
  readonly approvedChange?: WorkflowRules['approvedChange'];
  readonly routingLock?: WorkflowRoutingLock;
};

const presetRules = ({
  closeness,
  isPinned = false,
  approvedChange,
  routingLock,
}: PresetStateParams): WorkflowRules => ({
  ...DEFAULT_WORKFLOW_RULES,
  spreadByHeadroom: false,
  route: {
    shape: 'plan',
    row: 1,
    presetName: 'Fix a layout',
    closeness,
    role: null,
    choice: `Workflow · Preset Fix a layout · ${closeness === 'follow' ? 'Follow it' : 'Adapt as it goes'}`,
    why: 'you picked it',
  },
  preset: {
    workflowId: 'workflow-layout',
    name: 'Fix a layout',
    steps: [
      {
        name: 'Find',
        role: 'scout',
        promptPrefix: 'Find the widths.',
        isPinned: false,
        routingLock: null,
      },
      {
        name: 'Center the pages',
        role: 'implementer',
        promptPrefix: 'Center every page exactly so.',
        isPinned,
        routingLock: routingLock ?? null,
      },
    ],
  },
  ...(approvedChange !== undefined && { approvedChange }),
});

const presetState = (params: PresetStateParams) => {
  const state = baseState();
  const base = session();
  state['sessions'] = [
    {
      ...base,
      workflowRuns: [{ ...base.workflowRuns[0]!, rulesSnapshot: presetRules(params) }],
    },
  ];
  const deps = harness(state);
  state['updateWorkflowRunRules'] = updateWorkflowRunRules(deps.set, deps.get);
  return { state, ...deps };
};

const sessionsOf = (state: State): ReadonlyArray<Session> => {
  const value: unknown = state['sessions'];
  return Array.isArray(value) ? value : [];
};

const presetRunOf = (state: State): WorkflowRun => sessionsOf(state)[0]!.workflowRuns[0]!;

const ADDED = {
  kind: 'added',
  step: 'Fix the billing table',
  reason: 'The scout found the billing table scrolls sideways at 390px',
} as const;

const addDecision = () => ({
  usage: NO_USAGE,
  decision: {
    action: 'next',
    reason: 'The table needs its own step.',
    change: ADDED,
    step: {
      name: 'Fix the billing table',
      role: 'implementer',
      promptPrefix: 'Fix the billing table at 390px.',
    },
  },
});

describe('orchestrateNextStep with a preset', () => {
  it('hands the preset and its closeness to the orchestrator', async () => {
    decideSpy.mockResolvedValue({ usage: NO_USAGE, decision: { action: 'done', reason: 'Done.' } });
    const { set, get } = presetState({ closeness: 'follow' });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(decideSpy.mock.calls[0]![0].preset).toMatchObject({
      name: 'Fix a layout',
      closeness: 'follow',
      steps: [
        { name: 'Find', instructions: 'Find the widths.' },
        { name: 'Center the pages', instructions: 'Center every page exactly so.' },
      ],
    });
  });

  it('under Follow never adds a step: it stops and asks', async () => {
    decideSpy.mockResolvedValue(addDecision());
    const { state, set, get } = presetState({ closeness: 'follow' });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
    expect(presetRunOf(state).orchestrationStop?.kind).toBe('preset-change');
    expect(presetRunOf(state).rulesSnapshot?.pendingChange).toMatchObject(ADDED);
  });

  it('under Follow never skips a step either, even to end the run', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'done',
        reason: 'Centered already.',
        change: { kind: 'skipped', step: 'Center the pages', reason: 'Nothing is off center' },
      },
    });
    const { state, set, get } = presetState({ closeness: 'follow' });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(updateOutcomeSpy).not.toHaveBeenCalled();
    expect(presetRunOf(state).orchestrationStop?.kind).toBe('preset-change');
  });

  it('under Adapt adds the step, tagged, with its reason as the Why', async () => {
    decideSpy.mockResolvedValue(addDecision());
    const { state, set, get } = presetState({ closeness: 'adapt' });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(savedStep()).toMatchObject({
      name: 'Fix the billing table',
      orchestratorReason: `Added to the preset: ${ADDED.reason}`,
    });
    expect(presetRunOf(state).rulesSnapshot?.planChanges).toEqual([
      { ...ADDED, agentId: 'agent-2' },
    ]);
    expect(presetRunOf(state).orchestrationStop).toBeUndefined();
  });

  it('applies a change the operator approved under Follow, once', async () => {
    decideSpy.mockResolvedValue(addDecision());
    const { state, set, get } = presetState({ closeness: 'follow', approvedChange: ADDED });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeWorkflowUpsertSpy).toHaveBeenCalledTimes(1);
    expect(presetRunOf(state).rulesSnapshot?.approvedChange).toBeUndefined();
    expect(presetRunOf(state).rulesSnapshot?.planChanges).toHaveLength(1);
  });

  it('never skips a pinned step, even under Adapt', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'done',
        reason: 'Centered already.',
        change: { kind: 'skipped', step: 'Center the pages', reason: 'Nothing is off center' },
      },
    });
    const { state, set, get } = presetState({ closeness: 'adapt', isPinned: true });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(updateOutcomeSpy).not.toHaveBeenCalled();
    expect(presetRunOf(state).orchestrationStop).toMatchObject({
      kind: 'preset-change',
      message: expect.stringContaining('Center the pages is pinned'),
    });
  });

  it('runs a pinned step as the preset wrote it', async () => {
    decideNext({
      reason: 'Now center.',
      step: {
        name: 'Center a few pages',
        role: 'implementer',
        promptPrefix: 'Center two pages.',
        presetStep: 2,
      },
    });
    const { set, get } = presetState({ closeness: 'adapt', isPinned: true });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(savedStep()).toMatchObject({
      name: 'Center the pages',
      promptPrefix: 'Center every page exactly so.',
    });
  });

  it('runs a pinned step on the model the preset pinned', async () => {
    const routingLock: WorkflowRoutingLock = {
      version: 1,
      pick: { provider: 'anthropic', model: 'haiku-4.5', effort: null },
      origin: 'user',
    };
    decideNext({
      reason: 'Now center.',
      step: {
        name: 'Center the pages',
        role: 'implementer',
        promptPrefix: 'Center two pages.',
        presetStep: 2,
      },
    });
    const { set, get } = presetState({ closeness: 'adapt', isPinned: true, routingLock });

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(savedStep()).toMatchObject({
      providerOverride: 'anthropic',
      modelOverride: 'haiku-4.5',
      routingLock,
    });
    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ providerOverride: 'anthropic', modelOverride: 'haiku-4.5' }),
    );
  });

  it('keeps the pinned model when the rules are saved and read back', () => {
    const routingLock: WorkflowRoutingLock = {
      version: 1,
      pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
      origin: 'user',
    };
    const text = JSON.stringify(presetRules({ closeness: 'follow', isPinned: true, routingLock }));

    expect(parseWorkflowRulesText({ text })?.preset?.steps[1]?.routingLock).toEqual(routingLock);
  });
});

describe('resolvePresetChange', () => {
  type AnswerParams = {
    readonly isPinned?: boolean;
  };

  const askedState = ({ isPinned = false }: AnswerParams = {}) => {
    const deps = presetState({ closeness: 'follow', isPinned });
    const sessions = sessionsOf(deps.state);
    const run = sessions[0]!.workflowRuns[0]!;
    deps.state['sessions'] = [
      {
        ...sessions[0]!,
        workflowRuns: [
          {
            ...run,
            orchestrationStop: { kind: 'preset-change', message: 'Auto wants to add a step' },
            rulesSnapshot: { ...run.rulesSnapshot!, pendingChange: ADDED },
          },
        ],
      },
    ];
    deps.state['addWorkflowOrchestratorHint'] = vi.fn(async () => null);
    deps.state['orchestrateNextStep'] = vi.fn(async () => undefined);
    return deps;
  };

  it('Add it approves the change, tells Auto and asks again', async () => {
    const { state, set, get } = askedState();

    expect(await resolvePresetChange(set, get)(SESSION_ID, WORKFLOW_RUN_ID, 'apply')).toBe(true);

    expect(presetRunOf(state).rulesSnapshot?.approvedChange).toMatchObject(ADDED);
    expect(presetRunOf(state).rulesSnapshot?.pendingChange).toBeUndefined();
    expect(presetRunOf(state).orchestrationStop).toBeUndefined();
    expect(state['addWorkflowOrchestratorHint']).toHaveBeenCalledWith(
      SESSION_ID,
      WORKFLOW_RUN_ID,
      expect.objectContaining({ text: expect.stringContaining('approved'), delivery: 'queue' }),
    );
    expect(state['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, WORKFLOW_RUN_ID, {
      bypassGate: true,
    });
  });

  it('Skip keeps the preset and approves nothing', async () => {
    const { state, set, get } = askedState();

    await resolvePresetChange(set, get)(SESSION_ID, WORKFLOW_RUN_ID, 'decline');

    expect(presetRunOf(state).rulesSnapshot?.approvedChange).toBeUndefined();
    expect(state['addWorkflowOrchestratorHint']).toHaveBeenCalledWith(
      SESSION_ID,
      WORKFLOW_RUN_ID,
      expect.objectContaining({ text: expect.stringContaining('keeps the preset') }),
    );
  });

  it('Switch to adapt turns the run to Adapt as it goes', async () => {
    const { state, set, get } = askedState();

    await resolvePresetChange(set, get)(SESSION_ID, WORKFLOW_RUN_ID, 'adapt');

    expect(presetRunOf(state).rulesSnapshot?.route).toMatchObject({
      closeness: 'adapt',
      choice: 'Workflow · Preset Fix a layout · Adapt as it goes',
    });
  });

  it('does nothing when the question was already answered in another window', async () => {
    const { state, set, get } = presetState({ closeness: 'follow' });
    state['orchestrateNextStep'] = vi.fn(async () => undefined);

    expect(await resolvePresetChange(set, get)(SESSION_ID, WORKFLOW_RUN_ID, 'apply')).toBe(false);

    expect(state['orchestrateNextStep']).not.toHaveBeenCalled();
  });

  it('refuses to change a pinned step', async () => {
    const { state, set, get } = askedState({ isPinned: true });
    const pinnedRun = presetRunOf(state);
    state['sessions'] = [
      {
        ...sessionsOf(state)[0]!,
        workflowRuns: [
          {
            ...pinnedRun,
            rulesSnapshot: {
              ...pinnedRun.rulesSnapshot!,
              pendingChange: { kind: 'skipped', step: 'Center the pages', reason: 'x' },
            },
          },
        ],
      },
    ];

    expect(await resolvePresetChange(set, get)(SESSION_ID, WORKFLOW_RUN_ID, 'apply')).toBe(false);
    expect(await resolvePresetChange(set, get)(SESSION_ID, WORKFLOW_RUN_ID, 'decline')).toBe(true);
  });

  it('keeps the question when the hint cannot be saved', async () => {
    const { state, set, get } = askedState();
    state['addWorkflowOrchestratorHint'] = vi.fn(async () => {
      throw new Error('database is locked');
    });

    await expect(
      resolvePresetChange(set, get)(SESSION_ID, WORKFLOW_RUN_ID, 'apply'),
    ).rejects.toThrow('database is locked');

    expect(presetRunOf(state).orchestrationStop?.kind).toBe('preset-change');
    expect(presetRunOf(state).rulesSnapshot?.pendingChange).toMatchObject(ADDED);
    expect(presetRunOf(state).rulesSnapshot?.approvedChange).toBeUndefined();
    expect(state['orchestrateNextStep']).not.toHaveBeenCalled();
  });

  it('keeps the question when the rules cannot be saved after the hint', async () => {
    const { state, set, get } = askedState();
    updateRulesSpy.mockRejectedValueOnce(new Error('database is locked'));

    await expect(
      resolvePresetChange(set, get)(SESSION_ID, WORKFLOW_RUN_ID, 'apply'),
    ).rejects.toThrow('database is locked');

    expect(presetRunOf(state).rulesSnapshot?.pendingChange).toMatchObject(ADDED);
    expect(presetRunOf(state).orchestrationStop?.kind).toBe('preset-change');
  });
});
