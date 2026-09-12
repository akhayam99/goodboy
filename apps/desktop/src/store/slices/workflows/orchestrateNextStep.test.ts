import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  ProviderRunId,
  Session,
  SessionId,
  StepId,
  TelemetryRecord,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkflowSpendLimitMode,
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
  updateSummarySpy,
  insertProviderRunSpy,
  updateProviderRunStatusSpy,
  insertTelemetrySpy,
  summarizeSessionSpy,
  summarizeWorkspaceSpy,
} = vi.hoisted(() => ({
  decideSpy: vi.fn(),
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

vi.mock('@goodboy/db', () => ({
  listOpenQuestionsForSession: listOpenQuestionsSpy,
  updateWorkflowRunOrchestrationOutcome: updateOutcomeSpy,
  updateWorkflowRunOrchestrationStop: updateStopSpy,
  updateWorkflowRunOrchestratorSummary: updateSummarySpy,
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

import type { OrchestratorClientDeps, OrchestratorInput } from '@goodboy/core';
import { OrchestratorClient, ROLE_DEFAULTS } from '@goodboy/core';
import { orchestrateNextStep, persistOrchestrationStop } from './orchestrateNextStep';
import { continueWorkflowRun } from './continueWorkflowRun';
import { maybeAutoAdvanceWorkflow } from './maybeAutoAdvanceWorkflow';

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

const openQuestion = (): OpenQuestion => ({
  id: 'oq-1' as OpenQuestionId,
  sessionId: SESSION_ID,
  workflowRunId: WORKFLOW_RUN_ID,
  text: 'which database?',
  suggestedAnswers: [],
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
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ],
    providerCooldowns: {},
    budgetAlerts: [],
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
    loadSessionTelemetry: vi.fn(async () => undefined),
    appendTurnEvent: vi.fn(),
    activateWorkflowAgent: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
    maybeAutoAdvanceWorkflow: vi.fn(async () => undefined),
  };
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

const stateWithRunRoleLock = (): State => {
  const state = baseState();
  const current = session();
  state['sessions'] = [
    {
      ...current,
      workflowRuns: [
        {
          ...current.workflowRuns[0]!,
          roleModelOverrides: {
            implementer: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
          },
        },
      ],
    },
  ];
  return state;
};

const savedStep = (): Record<string, unknown> =>
  invokeWorkflowUpsertSpy.mock.calls[0]![0].steps[1] as Record<string, unknown>;

const modelMenuIdentities = (): ReadonlyArray<string> =>
  (decideSpy.mock.calls[0]![0].modelMenu as ReadonlyArray<{ provider: string; model: string }>).map(
    (option) => `${option.provider}/${option.model}`,
  );

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
      extraHints: ' first pending hint ',
      routing: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
    });

    expect(decideSpy).not.toHaveBeenCalled();
    expect(state['pendingOrchestrations']).toEqual({
      [WORKFLOW_RUN_ID]: {
        sessionId: SESSION_ID,
        bypassGate: true,
        extraHints: ['first pending hint'],
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
      extraHints: 'first pending hint',
      routing: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
    });
    expect(state['pendingOrchestrations']).toEqual({});
  });

  it('coalesces three concurrent calls into one rerun with deduped hints and last routing', async () => {
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
      extraHints: 'first hint',
      routing: { providerId: 'anthropic', model: 'claude-haiku-4-5' },
    });
    await orchestrate(SESSION_ID, WORKFLOW_RUN_ID, {
      bypassGate: true,
      extraHints: 'second hint',
      routing: { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
    });
    await orchestrate(SESSION_ID, WORKFLOW_RUN_ID, { extraHints: 'first hint' });

    if (openQuestionsGate.release == null) {
      throw new Error('open questions gate was not reached');
    }
    openQuestionsGate.release();
    await first;
    await vi.waitFor(() => expect(orchestrate).toHaveBeenCalledTimes(5));

    expect(orchestrate).toHaveBeenLastCalledWith(SESSION_ID, WORKFLOW_RUN_ID, {
      bypassGate: true,
      extraHints: 'first hint\n\nsecond hint',
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

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['kind']).toBe('scout');
    expect(insert['modelOverride']).toBe(ROLE_DEFAULTS.scout.model);
    expect(insert['effort']).toBeUndefined();
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

  it('applies the run role override after the orchestrator chooses a role', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'Implement with the pinned route.',
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
    const currentSession = session();
    state['sessions'] = [
      {
        ...currentSession,
        workflowRuns: [
          {
            ...currentSession.workflowRuns[0]!,
            roleModelOverrides: {
              implementer: {
                providerId: 'codex',
                model: 'gpt-5.6-sol',
                effort: 'high',
              },
            },
          },
        ],
      },
    ];
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

  it('offers every connected provider catalog, not only what the roles reach', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'all set' },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const identities = modelMenuIdentities();

    expect(identities).toContain('anthropic/fable-5');
    expect(identities.some((identity) => identity.startsWith('codex/'))).toBe(true);
    expect(identities.some((identity) => identity.startsWith('gemini/'))).toBe(false);
  });

  it('metadata reaches the provider request', async () => {
    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', 'true');
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
    const { set, get } = harness(baseState());

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(orchestratorTransport.requests).toHaveLength(1);
    const request = orchestratorTransport.requests[0]!;
    expect(request['toolsDisabled']).toBe(true);
    const prompt = request['userMessage'] as string;

    expect(prompt).toContain(
      'Codes: exp=exploration, pln=planning, imp=implementation, dbg=debugging, rev=review, tst=testing, wrt=writing, gen=general; lt=light, st=standard, hv=heavy, uk=unknown.',
    );
    expect(prompt).toContain(
      'anthropic/opus-5 efforts low,medium,high,xhigh,max unassessed ctx 1000k $5/$25',
    );
    expect(prompt).toContain(
      'codex/gpt-5.6-sol efforts low,medium,high,xhigh,max unassessed ctx 1000k $5/$30',
    );
    expect(prompt).toContain(
      'anthropic/haiku-4.5 efforts no effort control unassessed ctx 200k $1/$5',
    );
    expect(prompt).not.toContain('gemini/');

    const menuLines = prompt
      .split('\n')
      .filter((line) => line.startsWith('anthropic/') || line.startsWith('codex/'));
    expect(menuLines).toHaveLength(15);
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
    vi.unstubAllEnvs();
  });

  it('leaves catalog metadata out of the provider request while the flag is off', async () => {
    orchestratorTransport.stdout = anthropicReply(
      [
        '<<orchestrator>>',
        JSON.stringify({ action: 'done', reason: 'all set' }),
        '<</orchestrator>>',
      ].join('\n'),
    );
    const { set, get } = harness(baseState());

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const prompt = orchestratorTransport.requests[0]!['userMessage'] as string;
    expect(prompt).toContain('anthropic/opus-5 - Opus 5 - efforts: low, medium, high, xhigh, max');
    expect(prompt).not.toContain('unassessed');
    expect(prompt).not.toMatch(/ ctx \d+k /);
    expect(prompt).not.toMatch(/\$[\d.]+\/\$[\d.]+/);
  });

  it('drops a cooling provider out of the menu it offers', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'all set' },
    });
    const state = baseState();
    state['providerCooldowns'] = { codex: Date.now() + 60_000 };
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(modelMenuIdentities().some((identity) => identity.startsWith('codex/'))).toBe(false);
  });

  it('runs an available pick no role default reaches, without a rejection notice', async () => {
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
          modelReason: 'The refactor spans the whole router.',
        },
      },
    });
    const state = baseState();
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
          taskType: 'implementation',
          difficulty: 'heavy',
          modelReason: 'The refactor spans the whole router.',
        },
      },
    });
    const { set, get } = harness(baseState());

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

  it('never invents a difficulty for an unprofiled step while the metadata flag is off', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
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
      },
    });
    const { set, get } = harness(baseState());

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(savedStep().taskProfile).toEqual({
      taskType: 'general',
      difficulty: 'unknown',
      basis: 'unknown',
    });
    expect(decideSpy.mock.calls[0]![0].isModelMetadataEnabled).toBeUndefined();
  });

  it('labels a difficulty it read off the step text as heuristic when the flag is on', async () => {
    vi.stubEnv('VITE_WORKFLOW_MODEL_METADATA', 'true');
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
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
      },
    });
    const { set, get } = harness(baseState());

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(savedStep().taskProfile).toEqual({
      taskType: 'general',
      difficulty: 'heavy',
      basis: 'heuristic',
    });
    expect(decideSpy.mock.calls[0]![0].isModelMetadataEnabled).toBe(true);
    vi.unstubAllEnvs();
  });

  it('runs a pick from another connected provider than the one deciding', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'This one is hard.',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Implement the change.',
          provider: 'codex',
          model: 'gpt-5.6-sol',
          effort: 'high',
        },
      },
    });
    const state = baseState();
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
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'This one is hard.',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Implement the change.',
          model: 'gpt-9-imaginary',
        },
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const decision = savedStep().routingDecision as {
      source: string;
      adjustment: string;
      selected: { provider: string; model: string };
    };

    expect(decision.source).toBe('heuristic');
    expect(decision.adjustment).toBe('unknown_model');
    expect(['anthropic', 'codex']).toContain(decision.selected.provider);
    expect(decision.selected.model).not.toBe('gpt-9-imaginary');
  });

  it('keeps the step reason about the work, not about routing', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'The scout located the failure.',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Implement the change.',
          model: 'gpt-9-imaginary',
        },
      },
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(savedStep().orchestratorReason).toBe('The scout located the failure.');
    expect(state['emitNotification']).not.toHaveBeenCalled();
  });

  it('reports only the selected run lock when the automatic pick is unavailable', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'This one is hard.',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Implement the change.',
          provider: 'gemini',
          model: 'gemini-3.1-pro',
          effort: 'high',
        },
      },
    });
    const { set, get } = harness(stateWithRunRoleLock());

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6-sol',
        effort: 'high',
      }),
    );
    const decision = savedStep().routingDecision as {
      source: string;
      adjustment: string;
      reason: string;
      selected: { provider: string; model: string };
    };

    expect(decision.source).toBe('run_role_lock');
    expect(decision.adjustment).toBe('none');
    expect(decision.selected).toEqual({
      provider: 'codex',
      model: 'gpt-5.6-sol',
      effort: 'high',
    });
    expect(decision.reason).toContain('codex/gpt-5.6-sol');
    expect(decision.reason).not.toContain('gemini');
  });

  it('records the run lock without calling an available pick unavailable', async () => {
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
    const { set, get } = harness(stateWithRunRoleLock());

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    const decision = savedStep().routingDecision as {
      source: string;
      adjustment: string;
      proposal: { pick: { provider: string; model: string } } | null;
    };

    expect(decision.source).toBe('run_role_lock');
    expect(decision.adjustment).toBe('none');
    expect(decision.proposal?.pick).toEqual({
      provider: 'anthropic',
      model: 'fable-5',
      effort: null,
    });
  });

  it('normalizes an unsupported effort against the model that actually runs', async () => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'This one is hard.',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Implement the change.',
          provider: 'codex',
          model: 'gpt-5.6-sol',
          effort: 'minimal',
        },
      },
    });
    const state = baseState();
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

  it('stops the run when the only lock it has cannot run', async () => {
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
    const state = stateWithRunRoleLock();
    state['providerCooldowns'] = { codex: Date.now() + 60_000 };
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(invokeAgentInsertSpy).not.toHaveBeenCalled();
    expect(updateStopSpy).toHaveBeenCalledWith(
      {},
      WORKFLOW_RUN_ID,
      expect.objectContaining({ kind: 'failure', message: expect.stringContaining('cooldown') }),
    );
  });

  it('stays quiet when the picked model is inside the pool', async () => {
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
        },
      },
    });
    const state = baseState();
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
        runSummary: { kind: 'structured', done: ['shipped the gate'], left: [] },
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

  it('records the note on the decision it triggered, not only in the prompt', async () => {
    decideSpy.mockResolvedValueOnce({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'The tests come next.',
        step: {
          name: 'Implement',
          role: 'implementer',
          promptPrefix: 'Write the missing tests.',
        },
      },
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID, {
      extraHints: '  the gate is in place but its tests are missing  ',
    });

    expect(state['appendTurnEvent']).toHaveBeenCalledWith(
      'agent-2',
      SESSION_ID,
      expect.objectContaining({
        kind: 'orchestrator_decision',
        operatorNote: 'the gate is in place but its tests are missing',
      }),
    );
  });

  it('records the note on a terminal decision too', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID, {
      extraHints: 'ship the changelog as well',
    });

    expect(state['appendTurnEvent']).toHaveBeenCalledWith(
      AGENT_ID,
      SESSION_ID,
      expect.objectContaining({
        kind: 'orchestrator_decision',
        action: 'done',
        operatorNote: 'ship the changelog as well',
      }),
    );
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

  it('carries the note from the continue drawer all the way onto the decision', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: { action: 'done', reason: 'all set' },
      usage: NO_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    const { set, get } = harness(state);
    state['orchestrateNextStep'] = orchestrateNextStep(set, get);

    await continueWorkflowRun(set, get)(SESSION_ID, WORKFLOW_RUN_ID, '  say what is missing  ');

    expect(state['appendTurnEvent']).toHaveBeenCalledWith(
      AGENT_ID,
      SESSION_ID,
      expect.objectContaining({
        kind: 'orchestrator_decision',
        operatorNote: 'say what is missing',
      }),
    );
  });

  it('records the note on a provider failure block, not only in the prompt', async () => {
    decideSpy.mockRejectedValueOnce(new Error('orchestrator decision timed out'));
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID, {
      extraHints: 'this was already flaky yesterday',
    });

    expect(state['appendTurnEvent']).toHaveBeenCalledWith(
      AGENT_ID,
      SESSION_ID,
      expect.objectContaining({
        kind: 'orchestrator_decision',
        action: 'blocked',
        operatorNote: 'this was already flaky yesterday',
      }),
    );
  });

  it('records the note on an unparseable-reply block, not only in the prompt', async () => {
    decideSpy.mockResolvedValueOnce({
      decision: null,
      usage: BILLED_USAGE,
      model: 'claude-haiku-4-5',
    });
    const state = baseState();
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID, {
      extraHints: 'retry with more context',
    });

    expect(state['appendTurnEvent']).toHaveBeenCalledWith(
      AGENT_ID,
      SESSION_ID,
      expect.objectContaining({
        kind: 'orchestrator_decision',
        action: 'blocked',
        operatorNote: 'retry with more context',
      }),
    );
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
      message: expect.stringContaining('spend limit'),
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
      'budget-cap',
      'warning',
      expect.stringContaining('spend limit'),
      expect.stringContaining('spend limit'),
      expect.objectContaining({ sessionId: SESSION_ID }),
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
        (call) => call[0] === 'budget-cap',
      ).length;

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    expect(budgetCalls()).toBe(1);

    state['sessions'] = spendState({ limitUsd: 6, spentUsd: 6, mode: 'notify' })['sessions'];
    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);

    expect(budgetCalls()).toBe(2);
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
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: {
        action: 'next',
        reason: 'The implementation is ready.',
        step: { name: 'Implement', role: 'implementer', promptPrefix: 'Implement it.' },
      },
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

describe('orchestrateNextStep and the session context summarizer', () => {
  const mockDone = (): void => {
    decideSpy.mockResolvedValue({
      usage: NO_USAGE,
      decision: { action: 'done', reason: 'Every step landed.' },
    });
  };

  const runOutcomeOf = (state: State): string | undefined =>
    (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!.orchestrationOutcome;

  it('does not call the run done while the session summarizer is still writing', async () => {
    vi.useFakeTimers();
    mockDone();
    const state = baseState();
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'running' } };
    const { set, get } = harness(state);

    const pending = orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(decideSpy).not.toHaveBeenCalled();
    expect(runOutcomeOf(state)).toBeUndefined();

    state['summarizerStatus'] = { [SESSION_ID]: { status: 'idle' } };
    await vi.advanceTimersByTimeAsync(500);
    await pending;
  });

  it('still reaches done once the summarizer finishes, so the advance is not dropped', async () => {
    vi.useFakeTimers();
    mockDone();
    const state = baseState();
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'running' } };
    const { set, get } = harness(state);

    const pending = orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(decideSpy).not.toHaveBeenCalled();

    state['summarizerStatus'] = { [SESSION_ID]: { status: 'idle' } };
    await vi.advanceTimersByTimeAsync(500);
    await pending;

    expect(decideSpy).toHaveBeenCalledTimes(1);
    expect(updateOutcomeSpy).toHaveBeenCalledWith(
      {},
      WORKFLOW_RUN_ID,
      'done',
      'Every step landed.',
    );
    expect(runOutcomeOf(state)).toBe('done');
  });

  it('caps the summarizer wait at exactly sixty seconds, not a moment sooner', async () => {
    vi.useFakeTimers();
    mockDone();
    const state = baseState();
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'running' } };
    const { set, get } = harness(state);

    const pending = orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(decideSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    await pending;

    expect(decideSpy).toHaveBeenCalledTimes(1);
    expect(runOutcomeOf(state)).toBe('done');
  });

  it('gives up on a summarizer that never settles instead of parking the run forever', async () => {
    vi.useFakeTimers();
    mockDone();
    const state = baseState();
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'running' } };
    const { set, get } = harness(state);

    const pending = orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    await vi.advanceTimersByTimeAsync(120_000);
    await pending;

    expect(decideSpy).toHaveBeenCalledTimes(1);
    expect(runOutcomeOf(state)).toBe('done');
  });

  it('abandons the pass when the run was discarded during the summarizer wait', async () => {
    vi.useFakeTimers();
    mockDone();
    const state = baseState();
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'running' } };
    const { set, get } = harness(state);

    const pending = orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    await vi.advanceTimersByTimeAsync(2_000);

    const sessions = state['sessions'] as ReadonlyArray<Session>;
    state['sessions'] = [
      {
        ...sessions[0]!,
        workflowRuns: [{ ...sessions[0]!.workflowRuns[0]!, discardedAt: NOW }],
      },
    ];
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'idle' } };
    await vi.advanceTimersByTimeAsync(500);
    await pending;

    expect(decideSpy).not.toHaveBeenCalled();
    expect(updateOutcomeSpy).not.toHaveBeenCalled();
  });

  it('abandons the pass when the run settled from elsewhere during the summarizer wait', async () => {
    vi.useFakeTimers();
    mockDone();
    const state = baseState();
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'running' } };
    const { set, get } = harness(state);

    const pending = orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID);
    await vi.advanceTimersByTimeAsync(2_000);

    const sessions = state['sessions'] as ReadonlyArray<Session>;
    state['sessions'] = [
      {
        ...sessions[0]!,
        workflowRuns: [
          { ...sessions[0]!.workflowRuns[0]!, orchestrationOutcome: 'blocked' as const },
        ],
      },
    ];
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'idle' } };
    await vi.advanceTimersByTimeAsync(500);
    await pending;

    expect(decideSpy).not.toHaveBeenCalled();
    expect(updateOutcomeSpy).not.toHaveBeenCalled();
  });

  it('lets a forced skip past the summarizer, as it already cleared the gate', async () => {
    mockDone();
    const state = baseState();
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'running' } };
    const { set, get } = harness(state);

    await orchestrateNextStep(set, get)(SESSION_ID, WORKFLOW_RUN_ID, { bypassGate: true });

    expect(decideSpy).toHaveBeenCalledTimes(1);
    expect(runOutcomeOf(state)).toBe('done');
  });

  it('gates continue-in-place too, which never passed through the autorun gate', async () => {
    vi.useFakeTimers();
    mockDone();
    const state = baseState();
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'running' } };
    const { set, get } = harness(state);
    state['orchestrateNextStep'] = orchestrateNextStep(set, get);

    const pending = continueWorkflowRun(set, get)(SESSION_ID, WORKFLOW_RUN_ID, 'keep going');
    await vi.advanceTimersByTimeAsync(2_000);

    expect(decideSpy).not.toHaveBeenCalled();

    state['summarizerStatus'] = { [SESSION_ID]: { status: 'idle' } };
    await vi.advanceTimersByTimeAsync(500);
    await pending;

    expect(runOutcomeOf(state)).toBe('done');
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
