import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';
import type {
  Agent,
  AgentId,
  AgentRole,
  IsoDateTime,
  SessionId,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowId,
  ProjectId,
  WorkspaceId,
} from '@goodboy/types';
import { kindForRole, kindRouting } from '../features/session/agent-kind';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const runTurnSpy = storySpies.runTurn;
const phaseRunInsertSpy = storySpies.invokeAgentInsert;
const phaseRunListSpy = storySpies.invokeAgentList;
const phaseRunUpdateStatusSpy = storySpies.invokeAgentUpdateStatus;

async function* emptyStream(): AsyncIterable<TurnEvent> {}

const wireStoryDefaults = () => {
  storySpies.getWorkspaceById.mockImplementation(async ({ id }) =>
    buildStoryWorkspace({ id, name: 'ws', slug: 'ws' }),
  );
  storySpies.listProjectsForWorkspace.mockImplementation(async ({ workspaceId }) => [
    buildStoryProject({
      id: 'project-1' as ProjectId,
      workspaceId,
      name: 'repo',
      rootPath: '/tmp',
    }),
  ]);
  storySpies.listWorkspaces.mockImplementation(async () => [
    buildStoryWorkspace({ id: 'ws-1' as WorkspaceId, name: 'ws' }),
  ]);
  storySpies.createWorktree.mockImplementation(async () => ({
    worktreePath: '/tmp/wt',
    branchName: 'kay/test',
    slug: 'test',
  }));
  storySpies.createSessionDir.mockImplementation(async () => ({
    worktreePath: '/tmp/sessions/test',
    branchName: '',
    slug: 'test',
  }));
  storySpies.scratchDirPrepare.mockImplementation(
    async () => '/tmp/goodboy-root/scratch/mountless',
  );
};

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
  resetStorySpies();
  wireStoryDefaults();
  inserted = [];
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
  phaseRunListSpy.mockImplementation(async () => inserted);
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

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('createSession, workflow stepper seeding (#424)', () => {
  beforeEach(() => {
    wirePhaseSpies();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pre-creates agents for all workflow steps', async () => {
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

    expect(phaseRunInsertSpy).toHaveBeenCalledTimes(4);
    const firstArgs = phaseRunInsertSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstArgs['stepId']).toBe('s-scout');
    expect(firstArgs['name']).toBe('Scout');
    expect(firstArgs['ordinal']).toBe(0);
    const lastArgs = phaseRunInsertSpy.mock.calls[3]?.[0] as Record<string, unknown>;
    expect(lastArgs['stepId']).toBe('s-verify');
    expect(lastArgs['name']).toBe('Verify');
    expect(lastArgs['ordinal']).toBe(3);

    const state = useAppStore.getState();
    const sid = state.currentSessionId as SessionId;
    expect(state.sessionPhaseRuns[sid]?.length).toBe(4);
    expect(state.sessionPhaseRuns[sid]?.every((r) => r.status === 'pending')).toBe(true);
  });

  it('pre-spawns nothing when no workflow and no firstAgentKind are passed', async () => {
    useAppStore.setState({ currentWorkspaceId: WS_ID, phaseTemplates: {} });

    await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'free form',
      branchPrefix: 'kay',
    });

    expect(phaseRunInsertSpy).not.toHaveBeenCalled();
    const state = useAppStore.getState();
    const sid = state.currentSessionId as SessionId;
    expect(state.sessionPhaseRuns[sid] ?? []).toHaveLength(0);
  });

  it('spawnAgent creates a new agent when called for a step (e.g. retry)', async () => {
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

    expect(phaseRunInsertSpy).toHaveBeenCalledTimes(5);
    const fifth = phaseRunInsertSpy.mock.calls[4]?.[0] as Record<string, unknown>;
    expect(fifth['stepId']).toBe('s-plan');
    expect(fifth['name']).toBe('Plan');
  });
});

describe('createSession, AGENT_KIND_DEFAULTS applied to first workflow agent (#439)', () => {
  beforeEach(async () => {
    wirePhaseSpies();
    runTurnSpy.mockImplementation(() => emptyStream());
    const routingMod = await import('../features/providers/routing');
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
    expect(modelOverride).toBe('haiku-4.5');
  });

  it('auto-runs the first workflow agent by triggering a turn (sendTurn fires with promptPrefix)', async () => {
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

  it('reaches the provider spawn from a scratch standpoint when no project is mounted', async () => {
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

    useAppStore.setState({
      sessionProjectMounts: { [session.id]: [] },
      sessionWorktrees: { [session.id]: [] },
    } as never);

    await useAppStore.getState().sendTurn({
      sessionId: session.id,
      content: 'Survey the codebase.',
    });

    expect(runTurnSpy).toHaveBeenCalledTimes(1);
    const callArgs = runTurnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs['workingDir']).toBe('/tmp/goodboy-root/scratch/mountless');
    expect(String(callArgs['systemPrompt'])).toContain('[projects-scope]');
  });

  it('does NOT auto-run when no workflow is attached', async () => {
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

describe('spawnAgent, AGENT_KIND_DEFAULTS applied via CTA advance (#439)', () => {
  beforeEach(() => {
    wirePhaseSpies();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stores planner model override when spawning Plan step via CTA', async () => {
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

describe('spawnAgent, CTA auto-run next step (#442)', () => {
  beforeEach(() => {
    wirePhaseSpies();
    runTurnSpy.mockImplementation(() => emptyStream());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fires sendTurn with the step promptPrefix when spawnAgent is called with a stepId', async () => {
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
      .spawnAgent(session.id, { stepId: 's-plan' as StepId, focus: 'agent' });

    expect(useAppStore.getState().selectedAgentId[session.id]).toBe(agentId);
  });

  it('does NOT fire sendTurn when spawnAgent has no stepId (free session)', async () => {
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

describe('createSession, step.role drives agent kind over name inference (#793)', () => {
  function makeRoleWorkflow(role: AgentRole): Workflow {
    return {
      id: WORKFLOW_ID,
      workspaceId: WS_ID,
      name: 'Custom',
      description: 'single role-pinned step',
      steps: [
        {
          id: 's-only' as StepId,
          workflowId: WORKFLOW_ID,
          ordinal: 0,
          name: 'Scout',
          promptPrefix: '',
          role,
        },
      ],
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  beforeEach(() => {
    wirePhaseSpies();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the role-pinned kind even when the step name infers a different one', async () => {
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRoleWorkflow('implementer')] },
    });

    const { session } = await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'role wins',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    const insertArgs = phaseRunInsertSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs['kind']).toBe(kindForRole({ role: 'implementer' }));

    const state = useAppStore.getState();
    const agentId = state.selectedAgentId[session.id];
    expect(agentId).toBeDefined();
    expect(state.agentModelOverride[agentId!]).toBe(
      kindRouting({ kind: kindForRole({ role: 'implementer' }) }).model,
    );
  });

  it('falls back to name inference when the step has no role', async () => {
    useAppStore.setState({
      currentWorkspaceId: WS_ID,
      phaseTemplates: { [WS_ID]: [makeRefactorWorkflow()] },
    });

    await useAppStore.getState().createSession({
      workspaceId: WS_ID,
      goal: 'inference path',
      branchPrefix: 'kay',
      workflowId: WORKFLOW_ID,
    });

    const insertArgs = phaseRunInsertSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs['kind']).toBe('scout');
  });
});
