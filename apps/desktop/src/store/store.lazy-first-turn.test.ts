import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Project,
  ProjectId,
  Session,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';

const runTurnSpy = vi.fn();
const createWorktreeSpy = vi.fn();
const insertSessionEventSpy = vi.fn(
  async (_params: { readonly event: { readonly kind: string } }) => undefined,
);
const insertSessionWorktreeSpy = vi.fn(async () => undefined);
const updateSessionWorktreeBranchSpy = vi.fn(async () => undefined);

vi.mock('../features/chat/turn', () => ({
  runTurn: (args: unknown) => runTurnSpy(args),
  cancelTurn: vi.fn(),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

vi.mock('../features/permissions/permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionAuditInsert: vi.fn(),
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  invokeAuditRetryDrain: vi.fn(async () => []),
  invokeAuditRetryUpdate: vi.fn(async () => undefined),
  invokeAuditRetryDelete: vi.fn(async () => undefined),
  useEffectivePermissionRules: () => [],
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

vi.mock('../shared/lib/db', () => ({
  runDbMigrations: vi.fn(),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('@goodboy/db', () => ({
  getSetting: vi.fn(),
  insertMessage: vi.fn(),
  insertProviderRun: vi.fn(),
  insertSession: vi.fn(),
  insertSessionWorktree: insertSessionWorktreeSpy,
  insertSessionEvent: insertSessionEventSpy,
  insertTelemetry: vi.fn(),
  insertWorkspace: vi.fn(),
  listContextSlotsForSession: vi.fn(async () => []),
  listMessagesForSession: vi.fn(async () => []),
  listSessionsForWorkspace: vi.fn(async () => []),
  listTelemetryForSession: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => []),
  listWorktreesForTask: vi.fn(async () => []),
  listWorktreesForSession: vi.fn(async () => []),
  deleteWorktreesForSession: vi.fn(),
  updateSessionWorktreeBranch: updateSessionWorktreeBranchSpy,
  updateSessionWorktreeRepoSlug: vi.fn(async () => undefined),
  updateSessionActiveProject: vi.fn(async () => undefined),
  setSetting: vi.fn(),
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(),
  updateSessionState: vi.fn(),
  upsertContextSlot: vi.fn(),
  insertOpenQuestion: vi.fn(async () => undefined),
  markOpenQuestionsResolvedByText: vi.fn(async () => 0),
  listResolvedQuestionTextsForSession: vi.fn(async () => []),
  insertTurnEvent: vi.fn(async () => undefined),
  insertTurnEventsBatch: vi.fn(async () => undefined),
  listWorktreesForSessions: vi.fn(async () => new Map()),
  listAgentsForSessions: vi.fn(async () => new Map()),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  insertNotification: vi.fn(async () => undefined),
  listNotifications: vi.fn(async () => []),
  countNotifications: vi.fn(async () => ({ total: 0, unread: 0 })),
  NOTIFICATION_LIST_LIMIT: 200,
  markAllNotificationsRead: vi.fn(async () => undefined),
  clearAllNotifications: vi.fn(async () => undefined),
  updateSessionWorkflowStep: vi.fn(),
  attachWorkflowToSession: vi.fn(),
  detachWorkflowFromSession: vi.fn(),
  updateWorkflowOrder: vi.fn(),
}));

vi.mock('../features/providers/providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(),
  getCursorStatus: vi.fn(),
  getCodexStatus: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../features/providers/routing', () => ({
  resolveProviderForTurn: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-3-5-sonnet-latest',
    reason: 'preference',
  })),
}));

vi.mock('../features/budget/budget', () => ({
  invokeBudgetRuleList: vi.fn(async () => []),
  invokeBudgetRuleUpsert: vi.fn(),
  invokeBudgetRuleDelete: vi.fn(),
  invokeBudgetAlertsList: vi.fn(async () => []),
  invokeBudgetAlertDismiss: vi.fn(),
  invokeSessionBudgetGet: vi.fn(),
  invokeSessionBudgetSet: vi.fn(),
  invokeCheckProviderBudget: vi.fn(),
}));

vi.mock('../features/skills/skills', () => ({
  invokeSkillList: vi.fn(async () => []),
  invokeSkillUpsert: vi.fn(),
  invokeSkillDelete: vi.fn(),
  invokeSkillRescan: vi.fn(),
  resolveSkillInvocation: vi.fn(),
}));

vi.mock('../features/workflows/workflows', () => ({
  invokeWorkflowList: vi.fn(async () => []),
  invokeWorkflowUpsert: vi.fn(),
  invokeWorkflowDelete: vi.fn(),
  invokeAgentList: vi.fn(async () => []),
  invokeAgentInsert: vi.fn(),
  invokeAgentUpdateStatus: vi.fn(),
}));

vi.mock('../features/worktree/worktree', () => ({
  createWorktree: (args: unknown) => createWorktreeSpy(args),
  createSessionDir: vi.fn(),
  removeWorktree: vi.fn(),
  writeSimpleSessionMarker: vi.fn(async () => undefined),
  simpleSessionDirExists: vi.fn(async () => true),
  worktreeChangedFiles: vi.fn(async () => []),
}));

vi.mock('../features/workspace/prepareSimpleWorkspace', () => ({
  prepareSimpleWorkspace: vi.fn(async ({ path }: { path: string }) => path),
}));

vi.mock('../shared/lib/repo', () => ({ validateGitRepo: vi.fn() }));

const NOW = '2026-08-22T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-lazy' as SessionId;
const WORKSPACE_ID = 'workspace-lazy' as WorkspaceId;
const AGENT_ID = 'agent-lazy' as AgentId;
const PROJECT_ID = 'project-app' as ProjectId;
const SECOND_PROJECT_ID = 'project-web' as ProjectId;
const CONTAINER = '/tmp/sessions/goal-12345678';

const buildProject = (overrides: Partial<Project> = {}): Project => ({
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'app',
  rootPath: '/tmp/app',
  kind: 'repo',
  overrides: {
    defaultProviderId: null,
    defaultWorkflowId: null,
    defaultBranchPrefix: null,
    parallelEnabled: null,
    defaultVerbosity: null,
    providerBindings: null,
    taskModels: null,
    roleModels: null,
    parallelAgents: null,
    providerPool: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const session: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'ship the thing',
  state: { kind: 'draft' },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  autoRun: false,
  titleUserEdited: false,
  workflowRuns: [],
  createdAt: NOW,
  updatedAt: NOW,
};

const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'agent 1',
  status: 'pending',
};

async function* emptyStream(): AsyncIterable<TurnEvent> {}

const spawnedArgs = (): Record<string, unknown> =>
  (runTurnSpy.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;

describe('sendTurn lazy materialization', () => {
  beforeEach(() => {
    runTurnSpy.mockReset();
    runTurnSpy.mockImplementation(() => emptyStream());
    createWorktreeSpy.mockReset();
    insertSessionEventSpy.mockClear();
    insertSessionWorktreeSpy.mockClear();
    updateSessionWorktreeBranchSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const setup = async (projects: ReadonlyArray<Project>) => {
    const { useAppStore } = await import('./store');
    useAppStore.setState({
      sessions: [session],
      projects,
      sessionWorktrees: { [SESSION_ID]: [CONTAINER] },
      sessionProjectMounts: { [SESSION_ID]: [] },
      sessionBranches: { [SESSION_ID]: '' },
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
      selectedAgentId: { [SESSION_ID]: AGENT_ID },
      providers: [
        {
          id: 'anthropic',
          binary: 'claude',
          connection: 'connected',
          name: 'Claude',
          installation: 'installed',
        } as never,
      ],
      authResults: { anthropic: { state: 'connected', identity: 'test' } } as never,
    });
    return useAppStore;
  };

  it('materializes the only project on the first turn and runs inside its worktree', async () => {
    const useAppStore = await setup([buildProject()]);
    createWorktreeSpy.mockResolvedValueOnce({
      worktreePath: `${CONTAINER}/app`,
      branchName: 'goodboy/goal-12345678',
      slug: 'goal-12345678',
      reused: false,
    });

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'go' });

    expect(createWorktreeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        repoPath: '/tmp/app',
        parentDir: CONTAINER,
        dirName: 'app',
      }),
    );
    expect(spawnedArgs()['workingDir']).toBe(`${CONTAINER}/app`);
    expect(String(spawnedArgs()['systemPrompt'])).toContain('[worktree-scope]');
    expect(useAppStore.getState().sessionBranches[SESSION_ID]).toBe('goodboy/goal-12345678');
    const kinds = insertSessionEventSpy.mock.calls.map(([{ event }]) => event.kind);
    expect(kinds).toContain('project_materialized');
  });

  it('keeps a multi-project session lazy and ships the workspace scope guard instead', async () => {
    const useAppStore = await setup([
      buildProject(),
      buildProject({ id: SECOND_PROJECT_ID, name: 'web', rootPath: '/tmp/web' }),
    ]);

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'go' });

    expect(createWorktreeSpy).not.toHaveBeenCalled();
    expect(spawnedArgs()['workingDir']).toBe(CONTAINER);
    const systemPrompt = String(spawnedArgs()['systemPrompt']);
    expect(systemPrompt).toContain('[workspace-scope]');
    expect(systemPrompt).toContain('app (repo) root: /tmp/app');
    expect(systemPrompt).toContain('NOT materialized');
  });

  it('still runs the turn in the container when the single-project materialization fails', async () => {
    const useAppStore = await setup([buildProject()]);
    createWorktreeSpy.mockRejectedValue(new Error('git is on fire'));

    await useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'go' });

    expect(spawnedArgs()['workingDir']).toBe(CONTAINER);
    expect(String(spawnedArgs()['systemPrompt'])).toContain('[workspace-scope]');
    const kinds = insertSessionEventSpy.mock.calls.map(([{ event }]) => event.kind);
    expect(kinds).toContain('project_materialization_refused');
  });
});
