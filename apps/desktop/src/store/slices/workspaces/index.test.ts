// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  BudgetRule,
  BudgetAlert,
  ContextSlot,
  DiffComment,
  GhTokenStatus,
  IsoDateTime,
  PlanConsumption,
  PlanConsumptionId,
  PlanId,
  PlanWithCount,
  ProviderRunId,
  Session,
  SessionExternalTask,
  SessionId,
  Skill,
  SkillId,
  TelemetryRecord,
  TelemetryRecordId,
  TurnEvent,
  Workflow,
  WorkflowId,
  Workspace,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
  WorkspaceScript,
  WorkspaceScriptId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => null),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
}));

const dbSetSettingSpy = vi.fn(async () => undefined);
const dbGetSettingSpy: ReturnType<typeof vi.fn> = vi.fn<() => Promise<string | null>>(
  async () => null,
);
const insertNotificationSpy = vi.fn(async () => undefined);
const insertNudgeEventSpy = vi.fn(async () => undefined);
const updateNudgeOutcomeSpy = vi.fn(async () => undefined);
const insertDiffCommentSpy = vi.fn(async () => undefined);
const listDiffCommentsSpy = vi.fn(async () => [] as ReadonlyArray<DiffComment>);
const resolveDiffCommentDbSpy = vi.fn(async () => undefined);
const reopenDiffCommentDbSpy = vi.fn(async () => undefined);
const consumeDiffCommentsDbSpy = vi.fn(async () => undefined);
const deleteDiffCommentDbSpy = vi.fn(async () => undefined);
const upsertWorkspaceIntegrationSpy = vi.fn(async () => undefined);
const listIntegrationsForWorkspaceSpy = vi.fn(
  async () => [] as ReadonlyArray<WorkspaceIntegration>,
);
const deleteWorkspaceIntegrationSpy = vi.fn(async () => undefined);
const listWorkspaceScriptsSpy = vi.fn(async () => [] as ReadonlyArray<WorkspaceScript>);
const upsertWorkspaceScriptSpy = vi.fn(async () => undefined);
const deleteWorkspaceScriptSpy = vi.fn(async () => undefined);

vi.mock('@goodboy/db', () => ({
  getSetting: dbGetSettingSpy,
  setSetting: dbSetSettingSpy,
  insertMessage: vi.fn(async () => undefined),
  insertProviderRun: vi.fn(async () => undefined),
  insertSession: vi.fn(async () => undefined),
  insertSessionWorktree: vi.fn(async () => undefined),
  insertTelemetry: vi.fn(async () => undefined),
  insertTurnEventsBatch: vi.fn(async () => undefined),
  insertWorkspace: vi.fn(async () => undefined),
  disconnectWorkspace: vi.fn(async () => undefined),
  reconnectWorkspace: vi.fn(async () => undefined),
  touchWorkspaceLastAccessed: vi.fn(async () => undefined),
  updateWorkspaceKind: vi.fn(async () => undefined),
  renameWorkspace: vi.fn(async () => undefined),
  findWorkspaceByRootPath: vi.fn(async () => null),
  upsertSessionExternalTask: vi.fn(async () => undefined),
  deleteSessionExternalTask: vi.fn(async () => undefined),
  listExternalTasksForWorkspace: vi.fn(async () => []),
  listContextSlotsForSession: vi.fn(async () => []),
  insertContextSlotHistory: vi.fn(async () => undefined),
  listContextSlotHistory: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  listMessagesForSession: vi.fn(async () => []),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForSession: vi.fn(async () => []),
  listAgentRunIdsForSession: vi.fn(async () => new Map()),
  listSessionsForWorkspace: vi.fn(async () => []),
  listArchivedSessionsForWorkspace: vi.fn(async () => []),
  listTelemetryForSession: vi.fn(async () => []),
  listWorkspaces: vi.fn(async () => []),
  listWorktreesForSession: vi.fn(async () => []),
  listWorktreesForSessions: vi.fn(async () => new Map()),
  listAgentsForSessions: vi.fn(async () => new Map()),
  deleteWorktreesForSession: vi.fn(async () => undefined),
  updateSessionWorktreeBranch: vi.fn(async () => undefined),
  updateSessionWorktreePath: vi.fn(async () => undefined),
  listAllSessionWorktrees: vi.fn(async () => []),
  renameSession: vi.fn(async () => undefined),
  deleteSession: vi.fn(async () => undefined),
  archiveSession: vi.fn(async () => undefined),
  unarchiveSession: vi.fn(async () => undefined),
  updateSessionConfig: vi.fn(async () => undefined),
  updateAgentConfig: vi.fn(async () => undefined),
  updateAgentStatus: vi.fn(async () => undefined),
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(async () => undefined),
  updateSessionPermissionMode: vi.fn(async () => undefined),
  updateSessionAutoRun: vi.fn(async () => undefined),
  updateSessionTitleUserEdited: vi.fn(async () => undefined),
  updateSessionState: vi.fn(async () => undefined),
  attachWorkflowToSession: vi.fn(async () => undefined),
  detachWorkflowFromSession: vi.fn(async () => undefined),
  updateWorkflowOrder: vi.fn(async () => undefined),
  updateSessionWorkflowStep: vi.fn(async () => undefined),
  listWorkspaceScripts: listWorkspaceScriptsSpy,
  upsertWorkspaceScript: upsertWorkspaceScriptSpy,
  deleteWorkspaceScript: deleteWorkspaceScriptSpy,
  upsertContextSlot: vi.fn(async () => undefined),
  listOpenQuestionsForSession: vi.fn(async () => []),
  insertNudgeEvent: insertNudgeEventSpy,
  updateNudgeEventOutcome: updateNudgeOutcomeSpy,
  insertNotification: insertNotificationSpy,
  listNotifications: vi.fn(async () => []),
  countNotifications: vi.fn(async () => ({ total: 0, unread: 0 })),
  NOTIFICATION_LIST_LIMIT: 200,
  markAllNotificationsRead: vi.fn(async () => undefined),
  clearAllNotifications: vi.fn(async () => undefined),
  listDiffCommentsForSession: listDiffCommentsSpy,
  insertDiffComment: insertDiffCommentSpy,
  resolveDiffComment: resolveDiffCommentDbSpy,
  reopenDiffComment: reopenDiffCommentDbSpy,
  consumeDiffComments: consumeDiffCommentsDbSpy,
  deleteDiffComment: deleteDiffCommentDbSpy,
  listIntegrationsForWorkspace: listIntegrationsForWorkspaceSpy,
  upsertWorkspaceIntegration: upsertWorkspaceIntegrationSpy,
  deleteWorkspaceIntegration: deleteWorkspaceIntegrationSpy,
  insertOpenQuestion: vi.fn(async () => undefined),
  markOpenQuestionsResolvedByText: vi.fn(async () => 0),
  listResolvedQuestionTextsForSession: vi.fn(async () => []),
  insertTurnEvent: vi.fn(async () => undefined),
  getGithubPrCache: vi.fn(async () => null),
  upsertGithubPrCache: vi.fn(async () => undefined),
  deleteGithubPrCache: vi.fn(async () => undefined),
}));

vi.mock('../../../shared/lib/db', () => ({
  runDbMigrations: vi.fn(async () => undefined),
  wipeDb: vi.fn(async () => undefined),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('../../../shared/lib/ls-to-db-migration', () => ({
  migrateLsToDb: vi.fn(async () => undefined),
}));

vi.mock('../../../features/onboarding/onboarding-store', () => ({
  hydrateOnboardingFromDb: vi.fn(async () => undefined),
}));

const cancelTurnSpy = vi.fn(async () => undefined);
const listLiveRunIdsSpy = vi.fn(async () => new Set<string>());

vi.mock('../../../features/chat/turn', () => ({
  runTurn: vi.fn(),
  cancelTurn: cancelTurnSpy,
  listLiveRunIds: listLiveRunIdsSpy,
  writeAttachment: vi.fn(async () => 'rel/path'),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

vi.mock('../../../features/permissions/permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionRuleUpsert: vi.fn(async () => undefined),
  invokePermissionAuditInsert: vi.fn(async () => undefined),
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  invokeAuditRetryDrain: vi.fn(async () => []),
  invokeAuditRetryUpdate: vi.fn(async () => undefined),
  invokeAuditRetryDelete: vi.fn(async () => undefined),
}));

vi.mock('../../../features/providers/providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(async () => ({ state: 'connected', identity: 'test' })),
  getCursorStatus: vi.fn(async () => null),
  getCodexStatus: vi.fn(async () => null),
  getProviderStatus: vi.fn(async () => null),
}));

vi.mock('../../../features/providers/routing', () => ({
  resolveProviderForTurn: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-3-5-sonnet-latest',
    reason: 'preference',
  })),
}));

const invokeBudgetRuleListSpy = vi.fn(async () => [] as ReadonlyArray<BudgetRule>);
const invokeBudgetRuleUpsertSpy: ReturnType<typeof vi.fn> = vi.fn(async () => undefined);
const invokeBudgetRuleDeleteSpy = vi.fn(async () => undefined);
const invokeBudgetAlertsListSpy = vi.fn(async () => [] as ReadonlyArray<BudgetAlert>);
const invokeBudgetAlertDismissSpy = vi.fn(async () => undefined);
const invokeSessionBudgetGetSpy: ReturnType<typeof vi.fn> = vi.fn(async () => null);
const invokeSessionBudgetSetSpy = vi.fn(async () => undefined);

vi.mock('../../../features/budget/budget', () => ({
  invokeBudgetRuleList: invokeBudgetRuleListSpy,
  invokeBudgetRuleUpsert: invokeBudgetRuleUpsertSpy,
  invokeBudgetRuleDelete: invokeBudgetRuleDeleteSpy,
  invokeBudgetAlertsList: invokeBudgetAlertsListSpy,
  invokeBudgetAlertDismiss: invokeBudgetAlertDismissSpy,
  invokeSessionBudgetGet: invokeSessionBudgetGetSpy,
  invokeSessionBudgetSet: invokeSessionBudgetSetSpy,
  invokeCheckProviderBudget: vi.fn(async () => undefined),
}));

const invokeSkillListSpy = vi.fn(async () => [] as ReadonlyArray<Skill>);
const invokeSkillUpsertSpy = vi.fn(async () => undefined);
const invokeSkillDeleteSpy = vi.fn(async () => undefined);
const invokeSkillRescanSpy = vi.fn(async () => [] as ReadonlyArray<Skill>);

vi.mock('../../../features/skills/skills', () => ({
  invokeSkillList: invokeSkillListSpy,
  invokeSkillUpsert: invokeSkillUpsertSpy,
  invokeSkillDelete: invokeSkillDeleteSpy,
  invokeSkillRescan: invokeSkillRescanSpy,
  resolveSkillInvocation: vi.fn(),
}));

const invokeWorkflowListSpy = vi.fn(async () => [] as ReadonlyArray<Workflow>);
const invokeWorkflowUpsertSpy = vi.fn(async () => undefined);
const invokeWorkflowDeleteSpy = vi.fn(async () => undefined);
const invokeAgentListSpy = vi.fn(async () => [] as ReadonlyArray<Agent>);
const invokeAgentInsertSpy = vi.fn();
const invokeAgentUpdateStatusSpy = vi.fn();
const invokeAgentSetKindSpy = vi.fn(async () => undefined);
const invokeAgentSetVerbositySpy = vi.fn(async () => undefined);
const invokeAgentMarkViewedSpy = vi.fn(async () => undefined);
const invokeAgentSetProviderSessionIdSpy = vi.fn(async () => undefined);
const invokeWorkspacesWithUnreadSpy = vi.fn(async () => [] as ReadonlyArray<WorkspaceId>);

vi.mock('../../../features/workflows/workflows', () => ({
  invokeWorkflowList: invokeWorkflowListSpy,
  invokeWorkflowUpsert: invokeWorkflowUpsertSpy,
  invokeWorkflowDelete: invokeWorkflowDeleteSpy,
  invokeWorkflowsForSession: vi.fn(async () => [] as ReadonlyArray<Workflow>),
  invokeStepDefList: vi.fn(async () => []),
  invokeAgentList: invokeAgentListSpy,
  invokeAgentInsert: invokeAgentInsertSpy,
  invokeAgentUpdateStatus: invokeAgentUpdateStatusSpy,
  invokeAgentSetKind: invokeAgentSetKindSpy,
  invokeAgentSetVerbosity: invokeAgentSetVerbositySpy,
  invokeAgentMarkViewed: invokeAgentMarkViewedSpy,
  invokeAgentSetProviderSessionId: invokeAgentSetProviderSessionIdSpy,
  invokeWorkspacesWithUnread: invokeWorkspacesWithUnreadSpy,
}));

const createWorktreeSpy = vi.fn();
const removeWorktreeSpy = vi.fn(async () => undefined);
const changeWorktreeBranchSpy = vi.fn(async () => undefined);
const scanSimpleSessionsSpy = vi.fn(
  async () =>
    [] as ReadonlyArray<{
      readonly sessionId: SessionId;
      readonly workspaceId: WorkspaceId;
      readonly path: string;
    }>,
);
const simpleSessionDirExistsSpy = vi.fn(async () => true);
const writeSimpleSessionMarkerSpy = vi.fn(async () => undefined);

vi.mock('../../../features/worktree/worktree', () => ({
  createWorktree: createWorktreeSpy,
  removeWorktree: removeWorktreeSpy,
  changeWorktreeBranch: changeWorktreeBranchSpy,
  worktreeChangedFiles: vi.fn(async () => []),
  scanSimpleSessions: scanSimpleSessionsSpy,
  simpleSessionDirExists: simpleSessionDirExistsSpy,
  writeSimpleSessionMarker: writeSimpleSessionMarkerSpy,
}));

vi.mock('../../../shared/lib/repo', () => ({
  validateGitRepo: vi.fn(async () => ({
    isRepo: true,
    rootPath: '/tmp/repo',
    resolvedPath: '/tmp/repo',
    error: null,
  })),
  workspaceGitStatus: vi.fn(async () => ({
    state: 'ready',
    branch: 'main',
    headSubject: 'base',
    ahead: 0,
    behind: 0,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    changed: 0,
    hasUpstream: true,
  })),
  initRepoWithRemote: vi.fn(async () => ({
    rootPath: '/tmp/study-space',
    remoteUrl: 'https://github.com/acme/widgets.git',
    branch: 'main',
  })),
}));

const prepareSimpleWorkspaceSpy = vi.fn(async ({ path }: { path: string }) => path);

vi.mock('../../../features/workspace/prepareSimpleWorkspace', () => ({
  prepareSimpleWorkspace: prepareSimpleWorkspaceSpy,
}));

vi.mock('../../../shared/lib/editor', () => ({
  detectEditors: vi.fn(async () => []),
}));

const invokePlanListSpy = vi.fn(async () => [] as ReadonlyArray<PlanWithCount>);
const invokeUpsertPlanSpy = vi.fn();
const invokeSetPlanStatusSpy = vi.fn(async () => undefined);
const invokeSetPlanBodySpy = vi.fn(async () => undefined);
const invokeAddPlanConsumptionSpy = vi.fn(async () => undefined);
const invokeListConsumptionsForPlanSpy = vi.fn(async () => [] as ReadonlyArray<PlanConsumption>);

vi.mock('../../../features/plans/plans', () => ({
  listPlansForSession: invokePlanListSpy,
  upsertPlan: invokeUpsertPlanSpy,
  setPlanStatus: invokeSetPlanStatusSpy,
  setPlanBody: invokeSetPlanBodySpy,
  addPlanConsumption: invokeAddPlanConsumptionSpy,
  listConsumptionsForPlan: invokeListConsumptionsForPlanSpy,
}));

const linearConnectSpy = vi.fn();
const linearDisconnectSpy = vi.fn(async () => undefined);

vi.mock('../../../features/integrations/linear/client', () => ({
  linearConnect: linearConnectSpy,
  linearDisconnect: linearDisconnectSpy,
}));

const ghStatusSpy: ReturnType<typeof vi.fn> = vi.fn<() => Promise<GhTokenStatus>>(async () => ({
  available: true,
  mode: 'gh-cli',
  scopes: [],
}));
const ghSetTokenSpy = vi.fn();
const ghClearTokenSpy = vi.fn(async () => undefined);

vi.mock('../../../features/github/github', () => ({
  ghStatus: ghStatusSpy,
  ghSetToken: ghSetTokenSpy,
  ghClearToken: ghClearTokenSpy,
  tauriGhRunner: { run: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })) },
  createTauriPrCacheStore: () => ({ get: vi.fn(), upsert: vi.fn(), delete: vi.fn() }),
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    detectRepoSlug: vi.fn(async () => null),
    getPrForBranch: vi.fn(async () => null),
    fetchPrDetail: vi.fn(async () => null),
    fetchLinkedIssues: vi.fn(async () => []),
    resolveReviewThread: vi.fn(async () => undefined),
    addReviewThreadReply: vi.fn(async () => undefined),
    seedWorkflowLibrary: vi.fn(async () => undefined),
  };
});

vi.mock('../../../features/scripts/scripts', () => ({
  invokeScriptRun: vi.fn(async () => undefined),
  invokeScriptCancel: vi.fn(async () => undefined),
  listenScriptOutput: vi.fn(async () => () => undefined),
  listenScriptExit: vi.fn(async () => () => undefined),
}));

vi.mock('../../../features/terminal/terminal', () => ({
  invokeTerminalOpen: vi.fn(async () => undefined),
  invokeTerminalClose: vi.fn(async () => undefined),
}));

vi.mock('../../../features/context/components/QuestionsTab/useOpenQuestions', () => ({
  useOpenQuestions: {
    getState: () => ({ loadQuestions: vi.fn(async () => undefined) }),
  },
}));

vi.mock('../../../features/settings/config-export', () => ({
  exportConfigToFile: vi.fn(async () => '/tmp/export.json'),
  importConfigFromFile: vi.fn(async () => null),
}));

const WS_ID = 'workspace-1' as WorkspaceId;
const WS_ID_2 = 'workspace-2' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const SESSION_ID_2 = 'session-2' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const AGENT_ID_2 = 'agent-2' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const PLAN_ID = 'plan-1' as PlanId;
const NOW = '2026-05-28T00:00:00.000Z' as IsoDateTime;

function buildWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: WS_ID,
    name: 'ws',
    rootPath: '/tmp/repo',
    createdAt: NOW,
    updatedAt: NOW,
    lastAccessedAt: NOW,
    ...overrides,
  };
}

function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    workspaceId: WS_ID,
    goal: 'do a thing',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    autoRun: false,
    titleUserEdited: false,
    workflowRuns: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildWorktree(sessionId: SessionId, worktreePath: string, branch: string) {
  return {
    id: `wt_${sessionId}`,
    sessionId,
    worktreePath,
    branch,
    parallelIndex: 0,
    createdAt: Date.now(),
  };
}

function buildAgent(overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent {
  return {
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent 1',
    status: 'pending',
    ...overrides,
  };
}

function buildPlan(overrides: Partial<PlanWithCount> = {}): PlanWithCount {
  return {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    title: 't',
    bodyMd: 'b',
    status: 'active',
    consumptionCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

type RepoModule = typeof import('../../../shared/lib/repo');

function resetRepoMocks(repo: RepoModule) {
  vi.mocked(repo.validateGitRepo).mockReset();
  vi.mocked(repo.validateGitRepo).mockResolvedValue({
    isRepo: true,
    rootPath: '/tmp/study-space',
    resolvedPath: '/tmp/study-space',
    error: null,
  });
  vi.mocked(repo.initRepoWithRemote).mockReset();
  vi.mocked(repo.initRepoWithRemote).mockResolvedValue({
    rootPath: '/tmp/study-space',
    remoteUrl: 'https://github.com/acme/widgets.git',
    branch: 'main',
  });
}

async function getStore() {
  const mod = await import('../../store');
  return mod.useAppStore;
}

let resetState: Record<string, unknown> | null = null;

describe('store contract', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    invokeBudgetRuleListSpy.mockResolvedValue([]);
    invokeBudgetAlertsListSpy.mockResolvedValue([]);
    invokeSessionBudgetGetSpy.mockResolvedValue(null);
    invokeWorkflowListSpy.mockResolvedValue([]);
    invokeAgentListSpy.mockResolvedValue([]);
    invokeSkillListSpy.mockResolvedValue([]);
    invokeSkillRescanSpy.mockResolvedValue([]);
    invokePlanListSpy.mockResolvedValue([]);
    invokeListConsumptionsForPlanSpy.mockResolvedValue([]);
    invokeWorkspacesWithUnreadSpy.mockResolvedValue([]);
    listWorkspaceScriptsSpy.mockResolvedValue([]);
    listIntegrationsForWorkspaceSpy.mockResolvedValue([]);
    listDiffCommentsSpy.mockResolvedValue([]);
    dbGetSettingSpy.mockResolvedValue(null);
    ghStatusSpy.mockResolvedValue({ available: true, mode: 'gh-cli', scopes: [] });

    const store = await getStore();
    if (!resetState) {
      const snap = store.getState();
      resetState = {
        workspaces: [],
        workspaceIntegrations: {},
        workspaceGitStatus: {},
        sessionExternalTasks: {},
        currentWorkspaceId: null,
        sessions: [],
        archivedSessions: {},
        currentSessionId: null,
        settings: {},
        sessionSummary: null,
        providerStatus: null,
        cursorStatus: null,
        codexStatus: null,
        authResults: null,
        providers: snap.providers,
        hydrated: false,
        bootPhase: 'pending',
        error: null,
        transcripts: {},
        messages: {},
        sessionWorktrees: {},
        sessionBranches: {},
        sessionTelemetry: {},
        workspaceSummary: null,
        sessionSlots: {},
        slotHistory: {},
        summarizerStatus: {},
        budgetRules: [],
        sessionBudgets: {},
        providerSpendBreakdown: [],
        budgetAlerts: [],
        systemAlerts: [],
        skills: {},
        workspaceScripts: {},
        scriptRuns: {},
        phaseTemplates: {},
        sessionWorkflows: {},
        sessionPhaseRuns: {},
        selectedAgentId: {},
        agentRunHistory: {},
        agentTurnState: {},
        sessionMergeConflicts: {},
        unknownPayloadCounts: {},
        detectedEditors: [],
        workspaceOverrides: {},
        sessionOverrides: {},
        sidebarWorkspaceSearch: '',
        sidebarSessionSearch: '',
        unreadWorkspaceIds: new Set<WorkspaceId>(),
        sidebarStateFilter: [],
        sidebarProviderFilter: [],
        githubStatus: null,
        sessionGithub: {},
        volatilePermissionAllows: new Set<string>(),
        agentModelOverride: {},
        agentKindOverride: {},
        agentDraft: {},
        diffComments: {},
        notifications: [],
        sessionPlans: {},
        sessionNudges: {},
        planConsumptions: {},
        sessionOpenQuestions: {},
        sessionLoading: {},
        sessionViewPrefs: {},
        terminalSessions: {},
      };
    }
    store.setState(resetState as never);
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.clear();
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('workspaces', () => {
    it('addWorkspace inserts a fresh workspace into state', async () => {
      const store = await getStore();
      createWorktreeSpy.mockResolvedValueOnce({
        worktreePath: '/tmp/wt',
        branchName: 'b',
        slug: 's',
      });
      const created = await store.getState().addWorkspace({ rootPath: '/tmp/repo', name: 'app' });
      const wsList = store.getState().workspaces;
      expect(wsList).toHaveLength(1);
      expect(wsList[0]?.id).toBe(created.id);
      expect(wsList[0]?.name).toBe('app');
      expect(wsList[0]?.rootPath).toBe('/tmp/repo');
    });

    it('addWorkspace registers a folder with no git repository as a simple workspace', async () => {
      const store = await getStore();
      const repo = await import('../../../shared/lib/repo');
      resetRepoMocks(repo);
      vi.mocked(repo.validateGitRepo).mockResolvedValueOnce({
        isRepo: false,
        rootPath: null,
        resolvedPath: '/private/tmp/fresh-idea',
        error: 'not a git repository',
      });

      const created = await store.getState().addWorkspace({ rootPath: '/tmp/fresh-idea' });

      expect(created).toMatchObject({ kind: 'simple', rootPath: '/private/tmp/fresh-idea' });
      expect(store.getState().workspaces[0]?.kind).toBe('simple');
      expect(repo.initRepoWithRemote).not.toHaveBeenCalled();
    });

    it('addWorkspace still registers a git-backed folder as a repo workspace', async () => {
      const store = await getStore();
      const repo = await import('../../../shared/lib/repo');
      resetRepoMocks(repo);
      vi.mocked(repo.validateGitRepo).mockResolvedValueOnce({
        isRepo: true,
        rootPath: '/private/tmp/tracked',
        resolvedPath: '/private/tmp/tracked',
        error: null,
      });

      const created = await store.getState().addWorkspace({ rootPath: '/tmp/tracked' });

      expect(created).toMatchObject({ kind: 'repo', rootPath: '/private/tmp/tracked' });
    });

    it('addWorkspace still refuses a path that does not exist on disk', async () => {
      const store = await getStore();
      const repo = await import('../../../shared/lib/repo');
      resetRepoMocks(repo);
      vi.mocked(repo.validateGitRepo).mockResolvedValueOnce({
        isRepo: false,
        rootPath: null,
        resolvedPath: null,
        error: 'path does not exist: /tmp/nope',
      });

      await expect(store.getState().addWorkspace({ rootPath: '/tmp/nope' })).rejects.toThrow(
        /path does not exist/,
      );
      expect(store.getState().workspaces).toHaveLength(0);
    });

    it('loadWorkspaceGitStatus stores the git state of a dev workspace root', async () => {
      const store = await getStore();
      const repo = await import('../../../shared/lib/repo');
      vi.mocked(repo.workspaceGitStatus).mockResolvedValueOnce({
        state: 'absent',
        branch: null,
        headSubject: null,
        ahead: 0,
        behind: 0,
        staged: 0,
        unstaged: 0,
        untracked: 3,
        changed: 3,
        hasUpstream: false,
      });
      store.setState({ workspaces: [buildWorkspace({ rootPath: '/tmp/fresh-idea' })] });

      await store.getState().loadWorkspaceGitStatus({ workspaceId: WS_ID });

      expect(repo.workspaceGitStatus).toHaveBeenCalledWith({ workspacePath: '/tmp/fresh-idea' });
      expect(store.getState().workspaceGitStatus[WS_ID]?.state).toBe('absent');
    });

    it('loadWorkspaceGitStatus skips workspaces that are not git backed', async () => {
      const store = await getStore();
      const repo = await import('../../../shared/lib/repo');
      store.setState({ workspaces: [buildWorkspace({ kind: 'simple' })] });

      await store.getState().loadWorkspaceGitStatus({ workspaceId: WS_ID });

      expect(repo.workspaceGitStatus).not.toHaveBeenCalled();
      expect(store.getState().workspaceGitStatus[WS_ID]).toBeUndefined();
    });

    it('addSimpleWorkspace accepts a non-repository directory and persists its kind', async () => {
      const store = await getStore();
      const repo = await import('../../../shared/lib/repo');
      vi.mocked(repo.validateGitRepo).mockRejectedValueOnce(new Error('not a repository'));
      prepareSimpleWorkspaceSpy.mockResolvedValueOnce('/tmp/study-space');

      const created = await store
        .getState()
        .addSimpleWorkspace({ name: 'Study space', path: '/tmp/study-space' });

      expect(created).toMatchObject({
        name: 'Study space',
        rootPath: '/tmp/study-space',
        kind: 'simple',
      });
      expect(store.getState().workspaces[0]).toEqual(created);
      expect(repo.validateGitRepo).not.toHaveBeenCalled();
    });

    it('deleteWorkspace drops it from state and clears workspace-scoped caches when current', async () => {
      const store = await getStore();
      store.setState({
        workspaces: [buildWorkspace()],
        currentWorkspaceId: WS_ID,
        sessions: [buildSession()],
        currentSessionId: SESSION_ID,
      });
      await store.getState().deleteWorkspace(WS_ID);
      const s = store.getState();
      expect(s.workspaces).toHaveLength(0);
      expect(s.currentWorkspaceId).toBeNull();
      expect(s.currentSessionId).toBeNull();
      expect(s.sessions).toEqual([]);
    });

    it('deleteWorkspace throws when workspace does not exist', async () => {
      const store = await getStore();
      await expect(store.getState().deleteWorkspace(WS_ID)).rejects.toThrow(/workspace not found/);
    });

    it('setCurrentWorkspace recovers an orphaned running session+agent left over after a reload', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const turn = await import('../../../features/chat/turn');
      vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
        buildSession({ state: { kind: 'running', runId: RUN_ID, startedAt: NOW } }),
        buildSession({ id: SESSION_ID_2 }),
      ]);
      vi.mocked(db.listAgentsForSessions).mockResolvedValueOnce(
        new Map([[SESSION_ID, [buildAgent({ id: AGENT_ID, status: 'running', runId: RUN_ID })]]]),
      );
      vi.mocked(turn.listLiveRunIds).mockResolvedValueOnce(new Set([RUN_ID as string]));
      store.setState({ workspaces: [buildWorkspace()] });

      await store.getState().setCurrentWorkspace(WS_ID);

      const orphan = store.getState().sessions.find((s) => s.id === SESSION_ID);
      expect(orphan?.state.kind).toBe('idle');
      expect(store.getState().sessionPhaseRuns[SESSION_ID]?.[0]?.status).toBe('pending');
      expect(turn.cancelTurn).toHaveBeenCalledWith(RUN_ID);
      expect(db.updateAgentStatus).toHaveBeenCalledWith(expect.anything(), AGENT_ID, {
        status: 'pending',
      });
    });

    it('setCurrentWorkspace clears a dead running agent without cancelling (backend already gone)', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const turn = await import('../../../features/chat/turn');
      vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
        buildSession({ state: { kind: 'running', runId: RUN_ID, startedAt: NOW } }),
        buildSession({ id: SESSION_ID_2 }),
      ]);
      vi.mocked(db.listAgentsForSessions).mockResolvedValueOnce(
        new Map([[SESSION_ID, [buildAgent({ id: AGENT_ID, status: 'running', runId: RUN_ID })]]]),
      );
      vi.mocked(turn.listLiveRunIds).mockResolvedValueOnce(new Set<string>());
      store.setState({ workspaces: [buildWorkspace()] });

      await store.getState().setCurrentWorkspace(WS_ID);

      expect(store.getState().sessionPhaseRuns[SESSION_ID]?.[0]?.status).toBe('pending');
      expect(turn.cancelTurn).not.toHaveBeenCalled();
      expect(db.updateAgentStatus).toHaveBeenCalledWith(expect.anything(), AGENT_ID, {
        status: 'pending',
      });
    });

    it('loads every external task grouped by session', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const tasks: ReadonlyArray<SessionExternalTask> = [
        {
          sessionId: SESSION_ID,
          provider: 'linear',
          externalId: 'linear-1',
          identifier: 'GB-1',
          url: 'https://linear.app/acme/issue/GB-1',
          title: 'Linear task',
          createdAt: NOW,
        },
        {
          sessionId: SESSION_ID,
          provider: 'sentry',
          externalId: 'sentry-2',
          identifier: 'GOODBOY-2',
          url: 'https://sentry.io/organizations/acme/issues/2/',
          title: 'Sentry task',
          createdAt: NOW,
        },
      ];
      vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
        buildSession(),
        buildSession({ id: SESSION_ID_2 }),
      ]);
      vi.mocked(db.listExternalTasksForWorkspace).mockResolvedValueOnce(tasks);
      store.setState({ workspaces: [buildWorkspace()] });

      await store.getState().setCurrentWorkspace(WS_ID);

      expect(db.listExternalTasksForWorkspace).toHaveBeenCalledWith({
        db: expect.anything(),
        workspaceId: WS_ID,
      });
      expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual(tasks);
    });

    it('keys every loaded session so an absent key can only mean a missing load', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
        buildSession(),
        buildSession({ id: SESSION_ID_2 }),
      ]);
      vi.mocked(db.listExternalTasksForWorkspace).mockResolvedValueOnce([]);
      store.setState({ workspaces: [buildWorkspace()] });

      await store.getState().setCurrentWorkspace(WS_ID);

      const state = store.getState();
      expect(Object.keys(state.sessionExternalTasks).sort()).toEqual(
        [SESSION_ID, SESSION_ID_2].sort(),
      );
      expect(state.sessionExternalTasks[SESSION_ID]).toEqual([]);
      expect(state.sessionExternalTasks[SESSION_ID_2]).toEqual([]);
    });

    it('keys every session in the deferred workflow pass, empty attachments included', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
        buildSession(),
        buildSession({ id: SESSION_ID_2 }),
      ]);
      store.setState({ workspaces: [buildWorkspace()] });

      await store.getState().setCurrentWorkspace(WS_ID);

      await vi.waitFor(() => {
        expect(Object.keys(store.getState().sessionWorkflows).sort()).toEqual(
          [SESSION_ID, SESSION_ID_2].sort(),
        );
      });
      expect(store.getState().sessionWorkflows[SESSION_ID]).toEqual([]);
      expect(store.getState().sessionWorkflows[SESSION_ID_2]).toEqual([]);
    });

    it('renames a workspace without touching its path on disk', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      store.setState({ workspaces: [buildWorkspace({ name: 'ws', rootPath: '/tmp/repo' })] });

      const renamed = await store.getState().renameWorkspace({
        workspaceId: WS_ID,
        name: '  Billing platform  ',
      });

      expect(db.renameWorkspace).toHaveBeenCalledWith(expect.anything(), WS_ID, 'Billing platform');
      expect(renamed.name).toBe('Billing platform');
      expect(renamed.rootPath).toBe('/tmp/repo');
      expect(store.getState().workspaces[0]?.name).toBe('Billing platform');
    });

    it('refuses an empty display name', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      store.setState({ workspaces: [buildWorkspace({ name: 'ws' })] });

      await expect(
        store.getState().renameWorkspace({ workspaceId: WS_ID, name: '   ' }),
      ).rejects.toThrow('give the workspace a name');

      expect(db.renameWorkspace).not.toHaveBeenCalled();
      expect(store.getState().workspaces[0]?.name).toBe('ws');
    });

    it('converts a simple workspace into a repo, writing the kind last', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const repo = await import('../../../shared/lib/repo');
      resetRepoMocks(repo);
      const calls: string[] = [];
      vi.mocked(repo.initRepoWithRemote).mockImplementationOnce(async () => {
        calls.push('init');
        return {
          rootPath: '/tmp/study-space',
          remoteUrl: 'https://github.com/acme/widgets.git',
          branch: 'main',
        };
      });
      vi.mocked(repo.validateGitRepo).mockImplementationOnce(async () => {
        calls.push('validate');
        return {
          isRepo: true,
          rootPath: '/tmp/study-space',
          resolvedPath: '/tmp/study-space',
          error: null,
        };
      });
      vi.mocked(db.updateWorkspaceKind).mockImplementationOnce(async () => {
        calls.push('kind');
      });
      store.setState({
        workspaces: [buildWorkspace({ rootPath: '/tmp/study-space', kind: 'simple' })],
      });

      const converted = await store.getState().convertWorkspaceToRepo({
        workspaceId: WS_ID,
        remoteUrl: '  https://github.com/acme/widgets.git  ',
      });

      expect(calls).toEqual(['init', 'validate', 'kind']);
      expect(repo.initRepoWithRemote).toHaveBeenCalledWith({
        path: '/tmp/study-space',
        remoteUrl: 'https://github.com/acme/widgets.git',
      });
      expect(db.updateWorkspaceKind).toHaveBeenCalledWith({
        db: expect.anything(),
        id: WS_ID,
        kind: 'repo',
        rootPath: '/tmp/study-space',
      });
      expect(converted.kind).toBe('repo');
      expect(store.getState().workspaces[0]?.kind).toBe('repo');
    });

    it('persists the canonical root path git reported', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const repo = await import('../../../shared/lib/repo');
      resetRepoMocks(repo);
      vi.mocked(repo.validateGitRepo).mockResolvedValueOnce({
        isRepo: true,
        rootPath: '/private/tmp/study-space',
        resolvedPath: '/private/tmp/study-space',
        error: null,
      });
      store.setState({
        workspaces: [buildWorkspace({ rootPath: '/tmp/study-space', kind: 'simple' })],
      });

      const converted = await store.getState().convertWorkspaceToRepo({
        workspaceId: WS_ID,
        remoteUrl: 'https://github.com/acme/widgets.git',
      });

      expect(db.updateWorkspaceKind).toHaveBeenCalledWith({
        db: expect.anything(),
        id: WS_ID,
        kind: 'repo',
        rootPath: '/private/tmp/study-space',
      });
      expect(converted.rootPath).toBe('/private/tmp/study-space');
      expect(store.getState().workspaces[0]?.rootPath).toBe('/private/tmp/study-space');
    });

    it('leaves the kind alone when the folder is still not a repository', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const repo = await import('../../../shared/lib/repo');
      resetRepoMocks(repo);
      vi.mocked(repo.validateGitRepo).mockResolvedValueOnce({
        isRepo: false,
        rootPath: null,
        resolvedPath: '/tmp/study-space',
        error: 'not a git repository',
      });
      store.setState({
        workspaces: [buildWorkspace({ rootPath: '/tmp/study-space', kind: 'simple' })],
      });

      await expect(
        store.getState().convertWorkspaceToRepo({
          workspaceId: WS_ID,
          remoteUrl: 'https://github.com/acme/widgets.git',
        }),
      ).rejects.toThrow('not a git repository');

      expect(db.updateWorkspaceKind).not.toHaveBeenCalled();
      expect(store.getState().workspaces[0]?.kind).toBe('simple');
    });

    it('refuses to convert a workspace that already has a repository', async () => {
      const store = await getStore();
      const repo = await import('../../../shared/lib/repo');
      resetRepoMocks(repo);
      store.setState({ workspaces: [buildWorkspace({ kind: 'repo' })] });

      await expect(
        store.getState().convertWorkspaceToRepo({
          workspaceId: WS_ID,
          remoteUrl: 'https://github.com/acme/widgets.git',
        }),
      ).rejects.toThrow('only a simple workspace can become a dev project');

      expect(repo.initRepoWithRemote).not.toHaveBeenCalled();
    });

    it('relinks a moved simple session directory during workspace load', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const storedPath = '/tmp/study-space/sessions/study-plan';
      const movedPath = '/tmp/study-space/study-plan';
      vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
        buildSession(),
        buildSession({ id: SESSION_ID_2 }),
      ]);
      vi.mocked(db.listWorktreesForSessions).mockResolvedValueOnce(
        new Map([[SESSION_ID, [buildWorktree(SESSION_ID, storedPath, '')]]]),
      );
      scanSimpleSessionsSpy.mockResolvedValueOnce([
        { sessionId: SESSION_ID, workspaceId: WS_ID, path: movedPath },
      ]);
      simpleSessionDirExistsSpy.mockResolvedValueOnce(false);
      store.setState({
        workspaces: [
          buildWorkspace({
            rootPath: '/tmp/study-space',
            kind: 'simple',
          }),
        ],
      });

      await store.getState().setCurrentWorkspace(WS_ID);

      expect(db.updateSessionWorktreePath).toHaveBeenCalledWith({
        db: expect.anything(),
        sessionId: SESSION_ID,
        parallelIndex: 0,
        worktreePath: movedPath,
      });
      expect(store.getState().sessionWorktrees[SESSION_ID]).toEqual([movedPath]);
    });

    it('ignores a moved simple session directory from another workspace', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const storedPath = '/tmp/study-space/sessions/study-plan';
      const movedPath = '/tmp/study-space/study-plan';
      vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
        buildSession(),
        buildSession({ id: SESSION_ID_2 }),
      ]);
      vi.mocked(db.listWorktreesForSessions).mockResolvedValueOnce(
        new Map([[SESSION_ID, [buildWorktree(SESSION_ID, storedPath, '')]]]),
      );
      scanSimpleSessionsSpy.mockResolvedValueOnce([
        { sessionId: SESSION_ID, workspaceId: WS_ID_2, path: movedPath },
      ]);
      simpleSessionDirExistsSpy.mockResolvedValueOnce(false);
      store.setState({
        workspaces: [
          buildWorkspace({
            rootPath: '/tmp/study-space',
            kind: 'simple',
          }),
        ],
      });

      await store.getState().setCurrentWorkspace(WS_ID);

      expect(db.updateSessionWorktreePath).not.toHaveBeenCalled();
      expect(store.getState().sessionWorktrees[SESSION_ID]).toEqual([storedPath]);
    });

    it('backfills a marker for an existing unmarked simple session directory', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const storedPath = '/tmp/study-space/sessions/study-plan';
      vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
        buildSession(),
        buildSession({ id: SESSION_ID_2 }),
      ]);
      vi.mocked(db.listWorktreesForSessions).mockResolvedValueOnce(
        new Map([[SESSION_ID, [buildWorktree(SESSION_ID, storedPath, '')]]]),
      );
      scanSimpleSessionsSpy.mockResolvedValueOnce([]);
      simpleSessionDirExistsSpy.mockResolvedValueOnce(true);
      store.setState({
        workspaces: [
          buildWorkspace({
            rootPath: '/tmp/study-space',
            kind: 'simple',
          }),
        ],
      });

      await store.getState().setCurrentWorkspace(WS_ID);

      expect(writeSimpleSessionMarkerSpy).toHaveBeenCalledWith({
        path: storedPath,
        sessionId: SESSION_ID,
        workspaceId: WS_ID,
      });
      expect(db.updateSessionWorktreePath).not.toHaveBeenCalled();
      expect(store.getState().sessionWorktrees[SESSION_ID]).toEqual([storedPath]);
    });

    it('does not overwrite another session marker during backfill', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const storedPath = '/tmp/study-space/sessions/study-plan';
      vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
        buildSession(),
        buildSession({ id: SESSION_ID_2 }),
      ]);
      vi.mocked(db.listWorktreesForSessions).mockResolvedValueOnce(
        new Map([[SESSION_ID, [buildWorktree(SESSION_ID, storedPath, '')]]]),
      );
      scanSimpleSessionsSpy.mockResolvedValueOnce([
        { sessionId: SESSION_ID_2, workspaceId: WS_ID, path: storedPath },
      ]);
      simpleSessionDirExistsSpy.mockResolvedValueOnce(true);
      store.setState({
        workspaces: [
          buildWorkspace({
            rootPath: '/tmp/study-space',
            kind: 'simple',
          }),
        ],
      });

      await store.getState().setCurrentWorkspace(WS_ID);

      expect(writeSimpleSessionMarkerSpy).not.toHaveBeenCalled();
      expect(db.updateSessionWorktreePath).not.toHaveBeenCalled();
      expect(store.getState().sessionWorktrees[SESSION_ID]).toEqual([storedPath]);
    });

    it('never marks the git worktrees of a converted workspace as session folders', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const plainPath = '/tmp/study-space/sessions/study-plan';
      const worktreePath = '/tmp/study-space/.goodboy/worktrees/feat-x';
      vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
        buildSession(),
        buildSession({ id: SESSION_ID_2 }),
      ]);
      vi.mocked(db.listWorktreesForSessions).mockResolvedValueOnce(
        new Map([
          [SESSION_ID, [buildWorktree(SESSION_ID, plainPath, '')]],
          [SESSION_ID_2, [buildWorktree(SESSION_ID_2, worktreePath, 'ak/feat-x')]],
        ]),
      );
      scanSimpleSessionsSpy.mockResolvedValueOnce([]);
      store.setState({
        workspaces: [buildWorkspace({ rootPath: '/tmp/study-space', kind: 'repo' })],
      });

      await store.getState().setCurrentWorkspace(WS_ID);

      expect(writeSimpleSessionMarkerSpy).toHaveBeenCalledTimes(1);
      expect(writeSimpleSessionMarkerSpy).toHaveBeenCalledWith({
        path: plainPath,
        sessionId: SESSION_ID,
        workspaceId: WS_ID,
      });
      expect(store.getState().sessionWorktrees[SESSION_ID_2]).toEqual([worktreePath]);
    });

    it('setCurrentWorkspace(null) clears the active workspace and resets workspaceSummary etc.', async () => {
      const store = await getStore();
      store.setState({
        workspaces: [buildWorkspace()],
        currentWorkspaceId: WS_ID,
        workspaceSummary: { estimatedCostUsd: 1 } as never,
      });
      await store.getState().setCurrentWorkspace(null);
      const s = store.getState();
      expect(s.currentWorkspaceId).toBeNull();
      expect(s.providerSpendBreakdown).toEqual([]);
    });

    describe('boardReady flag', () => {
      it('sets boardReady=false before sessions load on workspace switch', async () => {
        const store = await getStore();
        store.setState({ workspaces: [buildWorkspace()], boardReady: true } as never);

        const promise = store.getState().setCurrentWorkspace(WS_ID);
        await Promise.resolve();

        expect(store.getState().boardReady).toBe(false);
        await promise;
      });

      it('releases boardReady=true for a workspace with no session branches', async () => {
        const store = await getStore();
        const db = await import('@goodboy/db');
        vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
          buildSession(),
          buildSession({ id: SESSION_ID_2 }),
        ]);
        vi.mocked(db.listWorktreesForSessions).mockResolvedValueOnce(new Map());

        store.setState({ workspaces: [buildWorkspace()] });
        await store.getState().setCurrentWorkspace(WS_ID);

        expect(store.getState().boardReady).toBe(true);
      });

      it('does NOT release boardReady=true when sessions have branches (delegated to sweepGithub)', async () => {
        const store = await getStore();
        const db = await import('@goodboy/db');
        vi.mocked(db.listSessionsForWorkspace).mockResolvedValueOnce([
          buildSession(),
          buildSession({ id: SESSION_ID_2 }),
        ]);
        vi.mocked(db.listWorktreesForSessions).mockResolvedValueOnce(
          new Map([
            [SESSION_ID, [buildWorktree(SESSION_ID, '/tmp/wt', 'feat/foo')]],
            [SESSION_ID_2, [buildWorktree(SESSION_ID_2, '/tmp/wt2', 'feat/bar')]],
          ]),
        );

        store.setState({ workspaces: [buildWorkspace()] });
        await store.getState().setCurrentWorkspace(WS_ID);

        expect(store.getState().boardReady).toBe(false);
      });

      it('boardReady stays false when workspace null (no id branch)', async () => {
        const store = await getStore();
        store.setState({ boardReady: true } as never);
        await store.getState().setCurrentWorkspace(null);
        expect(store.getState().boardReady).toBe(false);
      });
    });
  });
});
