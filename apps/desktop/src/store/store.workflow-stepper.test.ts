import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@kay-am/types';

// Module mocks — hoisted before subject import.
const runTurnSpy = vi.fn();

vi.mock('../turn', () => ({
  runTurn: (args: unknown) => runTurnSpy(args),
  cancelTurn: vi.fn(),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

async function* emptyStream(): AsyncIterable<TurnEvent> {
  // intentionally empty
}

vi.mock('../permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

vi.mock('../db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@kay-am/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertSession: vi.fn(),
  insertSessionWorktree: vi.fn(),
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  listContextSlotsForSession: vi.fn(async () => []),
  listMessagesForSession: vi.fn(async () => []),
  listSessionsForWorkspace: vi.fn(async () => []),
  listTelemetryForSession: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => [
    { id: 'ws-1', name: 'ws', rootPath: '/tmp', createdAt: '', updatedAt: '' },
  ]),
  setSetting: vi.fn(),
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(),
  updateSessionState: vi.fn(),
  upsertContextSlot: vi.fn(),
  insertTurnEvent: vi.fn(async () => undefined),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  insertNotification: vi.fn(async () => undefined),
  listNotifications: vi.fn(async () => []),
  markAllNotificationsRead: vi.fn(async () => undefined),
  clearAllNotifications: vi.fn(async () => undefined),
}));

vi.mock('../providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../routing', () => ({
  resolveProviderForTurn: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-opus-4-5',
    reason: 'preference',
  })),
}));

vi.mock('../budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
  invokeCheckProviderBudget: vi.fn(),
}));

vi.mock('../skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}));

const phaseRunInsertSpy = vi.fn();
const phaseRunListSpy = vi.fn();
const phaseRunUpdateStatusSpy = vi.fn();

vi.mock('../phases', () => ({
  invokePhaseTemplateList: vi.fn(async () => []),
  invokePhaseTemplateUpsert: vi.fn(),
  invokePhaseTemplateDelete: vi.fn(),
  invokePhaseRunList: (sid: SessionId) => phaseRunListSpy(sid),
  invokePhaseRunInsert: (args: unknown) => phaseRunInsertSpy(args),
  invokePhaseRunUpdateStatus: (id: unknown, fields: unknown) => phaseRunUpdateStatusSpy(id, fields),
}));

vi.mock('../worktree', () => ({
  createWorktree: vi.fn(async () => ({
    worktreePath: '/tmp/wt',
    branchName: 'kay/test',
    slug: 'test',
  })),
  removeWorktree: vi.fn(),
}));

vi.mock('../repo', () => ({ validateGitRepo: vi.fn() }));

const WS_ID = 'ws-1' as WorkspaceId;
const WORKFLOW_ID = 'wf-refactor' as WorkflowId;
const NOW = '2026-05-10T00:00:00.000Z' as IsoDateTime;

function makeRefactorWorkflow(): Workflow {
  return {
    id: WORKFLOW_ID,
    workspaceId: WS_ID,
    name: 'Refactor',
    description: 'scout/plan/refactor/verify',
    steps: [
      {
        id: 's-scout' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 0,
        name: 'Scout',
        promptPrefix: '',
      },
      {
        id: 's-plan' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 1,
        name: 'Plan',
        promptPrefix: '',
      },
      {
        id: 's-refactor' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 2,
        name: 'Refactor',
        promptPrefix: '',
      },
      {
        id: 's-verify' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 3,
        name: 'Verify',
        promptPrefix: '',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeRefactorWorkflowWithPrefixes(): Workflow {
  return {
    id: WORKFLOW_ID,
    workspaceId: WS_ID,
    name: 'Refactor',
    description: 'scout/plan/refactor/verify',
    steps: [
      {
        id: 's-scout' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 0,
        name: 'Scout',
        promptPrefix: 'Survey the codebase.',
      },
      {
        id: 's-plan' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 1,
        name: 'Plan',
        promptPrefix: 'Produce a detailed plan.',
      },
      {
        id: 's-refactor' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 2,
        name: 'Refactor',
        promptPrefix: 'Execute the plan.',
      },
      {
        id: 's-verify' as StepId,
        workflowId: WORKFLOW_ID,
        ordinal: 3,
        name: 'Verify',
        promptPrefix: 'Run and verify tests.',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

let inserted: Agent[] = [];

function wirePhaseSpies() {
  inserted = [];
  phaseRunInsertSpy.mockReset();
  phaseRunInsertSpy.mockImplementation(async (args: Record<string, unknown>) => {
    const row: Agent = {
      id: `ses-${inserted.length + 1}` as AgentId,
      sessionId: args['sessionId'] as SessionId,
      ordinal: args['ordinal'] as number,
      name: args['name'] as string,
      status: (args['status'] as Agent['status']) ?? 'pending',
      ...((args['stepId'] as StepId | undefined) !== undefined && {
        stepId: args['stepId'] as StepId,
      }),
    };
    inserted.push(row);
    return row;
  });
  phaseRunListSpy.mockReset();
  phaseRunListSpy.mockImplementation(async () => inserted);
  phaseRunUpdateStatusSpy.mockReset();
  phaseRunUpdateStatusSpy.mockImplementation(
    async (id: AgentId, fields: Record<string, unknown>) => {
      const existing = inserted.find((r) => r.id === id);
      const updated: Agent = {
        ...(existing ?? { id, sessionId: 'unknown' as SessionId, ordinal: 0, name: '' }),
        status: (fields['status'] as Agent['status']) ?? 'running',
      };
      inserted = inserted.map((r) => (r.id === id ? updated : r));
      return updated;
    },
  );
}

describe('createSession — workflow stepper seeding (#424)', () => {
  beforeEach(() => {
    wirePhaseSpies();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('seeds exactly one agent for the first workflow step (no redundant default agent)', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRefactorWorkflow()] },
    });

    await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'extract helpers',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    expect(phaseRunInsertSpy).toHaveBeenCalledTimes(1);
    const args = phaseRunInsertSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args['stepId']).toBe('s-scout');
    expect(args['name']).toBe('Scout');
    expect(args['ordinal']).toBe(0);

    const state = useAppStore.getState();
    const sid = state.currentSessionId as SessionId;
    expect(state.sessionPhaseRuns[sid]?.length).toBe(1);
  });

  it('falls back to a single generic "agent 1" when no workflow is attached', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({ currentWorkspaceId: WS_ID, phaseTemplates: {} });

    await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'free form',
      branchPrefix: 'kay',
    });

    expect(phaseRunInsertSpy).toHaveBeenCalledTimes(1);
    const args = phaseRunInsertSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args['name']).toBe('agent 1');
    expect(args['stepId']).toBeUndefined();
  });

  it('spawnAgent advances to the next workflow step after the first completes', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRefactorWorkflow()] },
    });

    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'refactor X',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    inserted = inserted.map((r) =>
      r.stepId === ('s-scout' as StepId) ? { ...r, status: 'completed' as const } : r,
    );

    await useAppStore.getState().spawnAgent(session.id, { stepId: 's-plan' as StepId });

    expect(phaseRunInsertSpy).toHaveBeenCalledTimes(2);
    const second = phaseRunInsertSpy.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(second['stepId']).toBe('s-plan');
    expect(second['name']).toBe('Plan');

    const state = useAppStore.getState();
    expect(state.sessionPhaseRuns[session.id]?.length).toBe(2);
  });
});

describe('createSession — AGENT_KIND_DEFAULTS applied to first workflow agent (#439)', () => {
  beforeEach(async () => {
    wirePhaseSpies();
    runTurnSpy.mockReset();
    runTurnSpy.mockImplementation(() => emptyStream());
    const routingMod = await import('../routing');
    (routingMod.resolveProviderForTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      selectedProvider: 'anthropic',
      selectedModel: 'claude-opus-4-5',
      reason: 'preference',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stores AGENT_KIND_DEFAULTS model for the first workflow agent (scout → haiku)', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRefactorWorkflow()] },
    });

    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'extract helpers',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    const state = useAppStore.getState();
    const agentId = state.selectedAgentId[session.id];
    expect(agentId).toBeDefined();
    const modelOverride = state.agentModelOverride[agentId!];
    expect(modelOverride).toBe('claude-haiku-4-5');
  });

  it('auto-runs the first workflow agent by triggering a turn (sendTurn fires with promptPrefix)', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRefactorWorkflow()] },
    });

    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'extract helpers',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    const agentId = useAppStore.getState().selectedAgentId[session.id];
    expect(agentId).toBeDefined();

    await useAppStore.getState().sendTurn({
      sessionId: session.id,
      content:
        'Survey the area of code in scope. List relevant files, key abstractions, callers, and any tests. Do not propose changes yet.',
    });

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    const callArgs = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof callArgs['prompt']).toBe('string');
    expect(String(callArgs['prompt'])).toContain('Survey the area');
    expect(callArgs['model']).toBe('claude-haiku-4-5');
  });

  it('does NOT auto-run when no workflow is attached', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({ currentWorkspaceId: WS_ID, phaseTemplates: {} });

    await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'free form',
      branchPrefix: 'kay',
    });

    await new Promise<void>((r) => setTimeout(r, 100));
    expect(runTurnSpy).not.toHaveBeenCalled();
  });
});

describe('spawnAgent — AGENT_KIND_DEFAULTS applied via CTA advance (#439)', () => {
  beforeEach(() => {
    wirePhaseSpies();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stores planner model override when spawning Plan step via CTA', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRefactorWorkflow()] },
    });

    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'refactor Y',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    const agentId = await useAppStore
      .getState()
      .spawnAgent(session.id, { stepId: 's-plan' as StepId, model: 'claude-opus-4-5' });

    const state = useAppStore.getState();
    expect(state.agentModelOverride[agentId]).toBe('claude-opus-4-5');
    expect(state.sessionPhaseRuns[session.id]?.find((r) => r.id === agentId)?.status).toBe(
      'pending',
    );
  });
});

describe('spawnAgent — CTA auto-run next step (#442)', () => {
  beforeEach(() => {
    wirePhaseSpies();
    runTurnSpy.mockReset();
    runTurnSpy.mockImplementation(() => emptyStream());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fires sendTurn with the step promptPrefix when spawnAgent is called with a stepId', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRefactorWorkflowWithPrefixes()] },
    });

    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'refactor Z',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    // Wait for createSession's void sendTurn (scout prefix) to settle before clearing
    await new Promise<void>((r) => setTimeout(r, 50));
    runTurnSpy.mockClear();

    inserted = inserted.map((r) =>
      r.stepId === ('s-scout' as StepId) ? { ...r, status: 'completed' as const } : r,
    );

    await useAppStore.getState().spawnAgent(session.id, { stepId: 's-plan' as StepId });

    await new Promise<void>((r) => setTimeout(r, 50));

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    const callArgs = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(String(callArgs['prompt'])).toContain('Produce a detailed plan.');
  });

  it('switches selectedAgentId to the new agent before firing sendTurn', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRefactorWorkflowWithPrefixes()] },
    });

    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'refactor W',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    const agentId = await useAppStore
      .getState()
      .spawnAgent(session.id, { stepId: 's-plan' as StepId });

    expect(useAppStore.getState().selectedAgentId[session.id]).toBe(agentId);
  });

  it('does NOT fire sendTurn when spawnAgent has no stepId (free session)', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({ currentWorkspaceId: WS_ID, phaseTemplates: {} });

    await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'free agent test',
      branchPrefix: 'kay',
    });

    runTurnSpy.mockClear();

    const state = useAppStore.getState();
    const sessionId = state.currentSessionId as SessionId;
    await useAppStore.getState().spawnAgent(sessionId, {});

    await new Promise<void>((r) => setTimeout(r, 50));

    expect(runTurnSpy).not.toHaveBeenCalled();
  });

  it('does NOT fire sendTurn when step has empty promptPrefix', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRefactorWorkflow()] },
    });

    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'refactor V',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    runTurnSpy.mockClear();

    await useAppStore.getState().spawnAgent(session.id, { stepId: 's-plan' as StepId });

    await new Promise<void>((r) => setTimeout(r, 50));

    expect(runTurnSpy).not.toHaveBeenCalled();
  });
});
