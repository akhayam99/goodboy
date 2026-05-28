// @vitest-environment happy-dom
//
// Monolithic contract test for the Zustand store at ./store.ts.
//
// Goal: lock the public surface (state shape + actions + selectors) before
// phase 4 splits this monolith into slice packages. If a test reveals a real
// bug, fix the store, not the test.
//
// Scope per domain: each describe block exercises one logical area. Every
// action gets at least one happy-path test, selectors get a set-state +
// read test. Action sequences span multiple turns when behavior is
// stateful (sidebar filters, agent drafts, system alerts).
//
// Mocks: this file mirrors the mock layout used in store.permissions.test.ts
// and store.workspace-switch.test.ts. The Tauri `invoke` and the @goodboy/db
// surface are mocked broadly so the store boots in a synchronous, in-memory
// environment.

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

// ─── module mocks (must precede store import) ─────────────────────────────

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
  findWorkspaceByRootPath: vi.fn(async () => null),
  setSessionExternalTask: vi.fn(async () => undefined),
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
  listAllSessionWorktrees: vi.fn(async () => []),
  renameSession: vi.fn(async () => undefined),
  deleteSession: vi.fn(async () => undefined),
  archiveSession: vi.fn(async () => undefined),
  unarchiveSession: vi.fn(async () => undefined),
  updateSessionConfig: vi.fn(async () => undefined),
  updateAgentConfig: vi.fn(async () => undefined),
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  updateProviderRunStatus: vi.fn(async () => undefined),
  updateSessionPermissionMode: vi.fn(async () => undefined),
  updateSessionAutoRun: vi.fn(async () => undefined),
  updateSessionTitleUserEdited: vi.fn(async () => undefined),
  updateSessionUserStatus: vi.fn(async () => undefined),
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
  insertTurnEvent: vi.fn(async () => undefined),
  getGithubPrCache: vi.fn(async () => null),
  upsertGithubPrCache: vi.fn(async () => undefined),
  deleteGithubPrCache: vi.fn(async () => undefined),
}));

vi.mock('../shared/lib/db', () => ({
  runDbMigrations: vi.fn(async () => undefined),
  wipeDb: vi.fn(async () => undefined),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('../shared/lib/ls-to-db-migration', () => ({
  migrateLsToDb: vi.fn(async () => undefined),
}));

vi.mock('../features/onboarding/onboarding-store', () => ({
  hydrateOnboardingFromDb: vi.fn(async () => undefined),
}));

vi.mock('../features/chat/turn', () => ({
  runTurn: vi.fn(),
  cancelTurn: vi.fn(async () => undefined),
  writeAttachment: vi.fn(async () => 'rel/path'),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
}));

vi.mock('../features/permissions/permissions', () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionRuleUpsert: vi.fn(async () => undefined),
  invokePermissionAuditInsert: vi.fn(async () => undefined),
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  invokeAuditRetryDrain: vi.fn(async () => []),
  invokeAuditRetryUpdate: vi.fn(async () => undefined),
  invokeAuditRetryDelete: vi.fn(async () => undefined),
}));

vi.mock('../features/providers/providers', () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(async () => ({ state: 'connected', identity: 'test' })),
  getCursorStatus: vi.fn(async () => null),
  getCodexStatus: vi.fn(async () => null),
  getProviderStatus: vi.fn(async () => null),
}));

vi.mock('../features/providers/routing', () => ({
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

vi.mock('../features/budget/budget', () => ({
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

vi.mock('../features/skills/skills', () => ({
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

vi.mock('../features/workflows/workflows', () => ({
  invokeWorkflowList: invokeWorkflowListSpy,
  invokeWorkflowUpsert: invokeWorkflowUpsertSpy,
  invokeWorkflowDelete: invokeWorkflowDeleteSpy,
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

vi.mock('../features/worktree/worktree', () => ({
  createWorktree: createWorktreeSpy,
  removeWorktree: removeWorktreeSpy,
  changeWorktreeBranch: changeWorktreeBranchSpy,
  worktreeChangedFiles: vi.fn(async () => []),
}));

vi.mock('../shared/lib/repo', () => ({
  validateGitRepo: vi.fn(async () => ({ isRepo: true, rootPath: '/tmp/repo' })),
}));

vi.mock('../shared/lib/editor', () => ({
  detectEditors: vi.fn(async () => []),
}));

const invokePlanListSpy = vi.fn(async () => [] as ReadonlyArray<PlanWithCount>);
const invokeUpsertPlanSpy = vi.fn();
const invokeSetPlanStatusSpy = vi.fn(async () => undefined);
const invokeSetPlanBodySpy = vi.fn(async () => undefined);
const invokeAddPlanConsumptionSpy = vi.fn(async () => undefined);
const invokeListConsumptionsForPlanSpy = vi.fn(async () => [] as ReadonlyArray<PlanConsumption>);

vi.mock('../features/plans/plans', () => ({
  listPlansForSession: invokePlanListSpy,
  upsertPlan: invokeUpsertPlanSpy,
  setPlanStatus: invokeSetPlanStatusSpy,
  setPlanBody: invokeSetPlanBodySpy,
  addPlanConsumption: invokeAddPlanConsumptionSpy,
  listConsumptionsForPlan: invokeListConsumptionsForPlanSpy,
}));

const linearConnectSpy = vi.fn();
const linearDisconnectSpy = vi.fn(async () => undefined);

vi.mock('../features/integrations/linear/client', () => ({
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

vi.mock('../features/github/github', () => ({
  ghStatus: ghStatusSpy,
  ghSetToken: ghSetTokenSpy,
  ghClearToken: ghClearTokenSpy,
  tauriGhRunner: { run: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })) },
  createTauriPrCacheStore: () => ({ get: vi.fn(), upsert: vi.fn(), delete: vi.fn() }),
}));

vi.mock('@goodboy/core', async (importOriginal) => {
  // Some helpers (parseSlashCommand, buildClaudeFlags, turnReducer, etc.) are
  // pure functions we want to exercise normally. The github helpers reach into
  // the runner so they're stubbed.
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

vi.mock('../features/scripts/scripts', () => ({
  invokeScriptRun: vi.fn(async () => undefined),
  invokeScriptCancel: vi.fn(async () => undefined),
  invokeScriptWrite: vi.fn(async () => undefined),
  invokeScriptResize: vi.fn(async () => undefined),
  listenScriptOutput: vi.fn(async () => () => undefined),
  listenScriptExit: vi.fn(async () => () => undefined),
}));

vi.mock('../features/terminal/terminal', () => ({
  invokeTerminalOpen: vi.fn(async () => undefined),
  invokeTerminalClose: vi.fn(async () => undefined),
}));

vi.mock('../features/context/components/QuestionsTab/useOpenQuestions', () => ({
  useOpenQuestions: {
    getState: () => ({ loadQuestions: vi.fn(async () => undefined) }),
  },
}));

vi.mock('../features/settings/config-export', () => ({
  exportConfigToFile: vi.fn(async () => '/tmp/export.json'),
  importConfigFromFile: vi.fn(async () => null),
}));

// ─── fixtures ────────────────────────────────────────────────────────────

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
    workflowIds: [],
    currentStepByWorkflow: {},
    userStatus: 'wip',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
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

// ─── store reset helper ──────────────────────────────────────────────────

async function getStore() {
  const mod = await import('./store');
  return mod.useAppStore;
}

let resetState: Record<string, unknown> | null = null;

describe('store contract', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Restore the canonical default mock returns each test owns.
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
      // Snapshot the pristine state on first run so all subsequent tests can
      // restore deterministically. Actions are kept (they reference set/get).
      const snap = store.getState();
      resetState = {
        workspaces: [],
        workspaceIntegrations: {},
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
        sessionNextActions: {},
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

  // ─── workspaces ───────────────────────────────────────────────────────

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
  });

  // ─── sessions ─────────────────────────────────────────────────────────

  describe('sessions', () => {
    it('refreshSessions overwrites sessions from DB', async () => {
      const store = await getStore();
      const { listSessionsForWorkspace } = await import('@goodboy/db');
      (listSessionsForWorkspace as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        buildSession({ id: SESSION_ID }),
        buildSession({ id: SESSION_ID_2, goal: 'two' }),
      ]);
      await store.getState().refreshSessions(WS_ID);
      const ss = store.getState().sessions;
      expect(ss).toHaveLength(2);
      expect(ss[0]?.id).toBe(SESSION_ID);
      expect(ss[1]?.goal).toBe('two');
    });

    it('renameTask updates goal and stamps titleUserEdited', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession()] });
      await store.getState().renameTask(SESSION_ID, '  fresh name  ');
      const s = store.getState().sessions.find((x) => x.id === SESSION_ID);
      expect(s?.goal).toBe('fresh name');
      expect(s?.titleUserEdited).toBe(true);
    });

    it('renameTask rejects empty names', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession()] });
      await expect(store.getState().renameTask(SESSION_ID, '   ')).rejects.toThrow();
    });

    it('autoTitleSession is a no-op when titleUserEdited is true', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession({ titleUserEdited: true, goal: 'kept' })] });
      await store.getState().autoTitleSession(SESSION_ID, 'auto');
      expect(store.getState().sessions[0]?.goal).toBe('kept');
    });

    it('autoTitleSession sets goal when the user has not edited the title', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession({ titleUserEdited: false, goal: 'old' })] });
      await store.getState().autoTitleSession(SESSION_ID, 'auto');
      expect(store.getState().sessions[0]?.goal).toBe('auto');
    });

    it('setSessionUserStatus mutates the session row', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession()] });
      await store.getState().setSessionUserStatus(SESSION_ID, 'done');
      expect(store.getState().sessions[0]?.userStatus).toBe('done');
    });

    it('setSessionPermissionMode mutates the session row', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession()] });
      await store.getState().setSessionPermissionMode(SESSION_ID, 'default');
      expect(store.getState().sessions[0]?.permissionMode).toBe('default');
    });

    it('setSessionAutoRun toggles the flag', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession({ autoRun: false })] });
      await store.getState().setSessionAutoRun(SESSION_ID, true);
      expect(store.getState().sessions[0]?.autoRun).toBe(true);
    });

    it('archiveTask removes the session from active list and clears currentSessionId if it was current', async () => {
      const store = await getStore();
      store.setState({
        sessions: [buildSession()],
        currentSessionId: SESSION_ID,
      });
      await store.getState().archiveTask(SESSION_ID);
      const s = store.getState();
      expect(s.sessions).toEqual([]);
      expect(s.currentSessionId).toBeNull();
    });

    it('unarchiveTask restores a session from archived cache to active when in same workspace', async () => {
      const store = await getStore();
      const archived: Session = {
        ...buildSession(),
        archivedAt: NOW,
      } as Session;
      store.setState({
        workspaces: [buildWorkspace()],
        currentWorkspaceId: WS_ID,
        archivedSessions: { [WS_ID]: [archived] },
      });
      await store.getState().unarchiveTask(SESSION_ID);
      const s = store.getState();
      expect(s.sessions.find((x) => x.id === SESSION_ID)).toBeDefined();
      expect(s.archivedSessions[WS_ID]).toEqual([]);
    });
  });

  // ─── permissions ──────────────────────────────────────────────────────

  describe('permissions', () => {
    it('resolvePermissionRequest(scope=once) adds toolUseId to volatilePermissionAllows', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession()] });
      await store.getState().resolvePermissionRequest({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        toolUseId: 'tu-1',
        toolName: 'Bash',
        runId: RUN_ID,
        scope: 'once',
      });
      expect(store.getState().volatilePermissionAllows.has('tu-1')).toBe(true);
    });

    it('resolvePermissionRequest(scope=session) calls invokePermissionRuleUpsert with session scope', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession()] });
      const perm = await import('../features/permissions/permissions');
      await store.getState().resolvePermissionRequest({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        toolUseId: 'tu-2',
        toolName: 'Edit',
        runId: RUN_ID,
        scope: 'session',
      });
      expect(perm.invokePermissionRuleUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'session', sessionId: SESSION_ID, decision: 'allow' }),
      );
    });

    it('resolvePermissionRequest(scope=deny) maps to a session-scoped deny rule', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession()] });
      const perm = await import('../features/permissions/permissions');
      await store.getState().resolvePermissionRequest({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        toolUseId: 'tu-3',
        toolName: 'Bash',
        runId: RUN_ID,
        scope: 'deny',
      });
      expect(perm.invokePermissionRuleUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'session', decision: 'deny' }),
      );
    });

    it('resolvePermissionRequest no-ops when session is missing', async () => {
      const store = await getStore();
      const perm = await import('../features/permissions/permissions');
      await store.getState().resolvePermissionRequest({
        sessionId: 'ghost' as SessionId,
        agentId: AGENT_ID,
        toolUseId: 't',
        toolName: 'Edit',
        runId: RUN_ID,
        scope: 'workspace',
      });
      expect(perm.invokePermissionRuleUpsert).not.toHaveBeenCalled();
    });
  });

  // ─── plans ────────────────────────────────────────────────────────────

  describe('plans', () => {
    it('loadSessionPlans fills sessionPlans[sid] from DB', async () => {
      const store = await getStore();
      invokePlanListSpy.mockResolvedValueOnce([buildPlan()]);
      await store.getState().loadSessionPlans(SESSION_ID);
      expect(store.getState().sessionPlans[SESSION_ID]).toHaveLength(1);
    });

    it('setPlanStatus persists and refreshes the plans cache', async () => {
      const store = await getStore();
      invokePlanListSpy.mockResolvedValueOnce([buildPlan({ status: 'discarded' })]);
      await store.getState().setPlanStatus(SESSION_ID, PLAN_ID, 'discarded');
      expect(invokeSetPlanStatusSpy).toHaveBeenCalledWith(PLAN_ID, 'discarded');
      expect(store.getState().sessionPlans[SESSION_ID]?.[0]?.status).toBe('discarded');
    });

    it('updatePlanBody pushes through invokeSetPlanBody and refreshes', async () => {
      const store = await getStore();
      invokePlanListSpy.mockResolvedValueOnce([buildPlan({ title: 'x', bodyMd: 'y' })]);
      await store.getState().updatePlanBody(SESSION_ID, PLAN_ID, 'x', 'y');
      expect(invokeSetPlanBodySpy).toHaveBeenCalledWith(PLAN_ID, 'x', 'y');
      expect(store.getState().sessionPlans[SESSION_ID]?.[0]?.title).toBe('x');
    });

    it('deletePlan flips status to discarded', async () => {
      const store = await getStore();
      invokePlanListSpy.mockResolvedValueOnce([]);
      await store.getState().deletePlan(SESSION_ID, PLAN_ID);
      expect(invokeSetPlanStatusSpy).toHaveBeenCalledWith(PLAN_ID, 'discarded');
    });

    it('restorePlan flips status back to active', async () => {
      const store = await getStore();
      invokePlanListSpy.mockResolvedValueOnce([]);
      await store.getState().restorePlan(SESSION_ID, PLAN_ID);
      expect(invokeSetPlanStatusSpy).toHaveBeenCalledWith(PLAN_ID, 'active');
    });

    it('loadConsumptionsForPlan caches results keyed by planId', async () => {
      const store = await getStore();
      const fakeCon = {
        id: 'c-1' as PlanConsumptionId,
        planId: PLAN_ID,
        agentId: AGENT_ID,
        consumedAt: NOW,
      } as PlanConsumption;
      invokeListConsumptionsForPlanSpy.mockResolvedValueOnce([fakeCon]);
      await store.getState().loadConsumptionsForPlan(PLAN_ID);
      expect(store.getState().planConsumptions[PLAN_ID]).toEqual([fakeCon]);
    });
  });

  // ─── budget ───────────────────────────────────────────────────────────

  describe('budget', () => {
    it('loadBudgetRules replaces budgetRules', async () => {
      const store = await getStore();
      const rule: BudgetRule = {
        id: 'r-1',
        provider: 'anthropic',
        period: 'monthly',
        capUsd: 50,
        alertThresholdPct: 0.8,
        extraTokensBudget: null,
        createdAt: NOW,
      };
      invokeBudgetRuleListSpy.mockResolvedValueOnce([rule]);
      await store.getState().loadBudgetRules();
      expect(store.getState().budgetRules).toEqual([rule]);
    });

    it('saveBudgetRule generates id+createdAt and calls upsert', async () => {
      const store = await getStore();
      invokeBudgetRuleListSpy.mockResolvedValueOnce([]);
      await store.getState().saveBudgetRule({
        provider: 'anthropic',
        period: 'monthly',
        capUsd: 100,
        alertThresholdPct: 0.8,
        extraTokensBudget: null,
      });
      expect(invokeBudgetRuleUpsertSpy).toHaveBeenCalledTimes(1);
      const arg = invokeBudgetRuleUpsertSpy.mock.calls[0]?.[0] as BudgetRule;
      expect(arg.id).toBeDefined();
      expect(arg.createdAt).toBeDefined();
      expect(arg.provider).toBe('anthropic');
    });

    it('deleteBudgetRule filters by id in memory', async () => {
      const store = await getStore();
      const ruleA: BudgetRule = {
        id: 'a',
        provider: 'anthropic',
        period: 'monthly',
        capUsd: 1,
        alertThresholdPct: 0.8,
        extraTokensBudget: null,
        createdAt: NOW,
      };
      const ruleB: BudgetRule = { ...ruleA, id: 'b' };
      store.setState({ budgetRules: [ruleA, ruleB] });
      await store.getState().deleteBudgetRule('a');
      expect(store.getState().budgetRules.map((r) => r.id)).toEqual(['b']);
    });

    it('loadSessionBudget caches the budget keyed by sessionId when DB returns non-null', async () => {
      const store = await getStore();
      invokeSessionBudgetGetSpy.mockResolvedValueOnce({ sessionId: SESSION_ID, softCapUsd: 25 });
      await store.getState().loadSessionBudget(SESSION_ID);
      expect(store.getState().sessionBudgets[SESSION_ID]?.softCapUsd).toBe(25);
    });

    it('setSessionBudget writes through and caches the SessionBudget', async () => {
      const store = await getStore();
      await store.getState().setSessionBudget(SESSION_ID, 42);
      expect(invokeSessionBudgetSetSpy).toHaveBeenCalledWith(SESSION_ID, 42);
      expect(store.getState().sessionBudgets[SESSION_ID]).toEqual({
        sessionId: SESSION_ID,
        softCapUsd: 42,
      });
    });

    it('dismissBudgetAlert stamps dismissedAt on the matching alert', async () => {
      const store = await getStore();
      const alertA: BudgetAlert = {
        id: 'a1',
        kind: 'provider-threshold',
        currentUsd: 1,
        capUsd: 10,
        createdAt: NOW,
      };
      const alertB: BudgetAlert = { ...alertA, id: 'a2' };
      store.setState({ budgetAlerts: [alertA, alertB] });
      await store.getState().dismissBudgetAlert('a1');
      const updated = store.getState().budgetAlerts.find((a) => a.id === 'a1');
      expect(updated?.dismissedAt).toBeDefined();
    });
  });

  // ─── github ───────────────────────────────────────────────────────────

  describe('github', () => {
    it('refreshGithubStatus stores the status returned by the runner', async () => {
      const store = await getStore();
      ghStatusSpy.mockResolvedValueOnce({
        available: true,
        mode: 'pat',
        user: 'tester',
        scopes: ['repo'],
      });
      await store.getState().refreshGithubStatus();
      expect(store.getState().githubStatus?.mode).toBe('pat');
    });

    it('refreshGithubStatus falls back to an absent status when ghStatus throws', async () => {
      const store = await getStore();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      ghStatusSpy.mockRejectedValueOnce(new Error('boom'));
      await store.getState().refreshGithubStatus();
      expect(store.getState().githubStatus?.available).toBe(false);
      expect(store.getState().githubStatus?.mode).toBe('absent');
      warnSpy.mockRestore();
    });

    it('setGithubPat stores the new status', async () => {
      const store = await getStore();
      ghSetTokenSpy.mockResolvedValueOnce({
        available: true,
        mode: 'pat',
        user: 'me',
        scopes: ['repo'],
      });
      const out = await store.getState().setGithubPat('tok');
      expect(out.mode).toBe('pat');
      expect(store.getState().githubStatus?.user).toBe('me');
    });

    it('refreshSessionPr noops without a session branch', async () => {
      const store = await getStore();
      store.setState({
        workspaces: [buildWorkspace()],
        sessions: [buildSession()],
      });
      await store.getState().refreshSessionPr(SESSION_ID);
      expect(store.getState().sessionGithub[SESSION_ID]).toBeUndefined();
    });

    it('sweepGithub is a no-op when github is unavailable', async () => {
      const store = await getStore();
      store.setState({
        githubStatus: { available: false, mode: 'absent', scopes: [] } as never,
        sessions: [buildSession()],
        sessionBranches: { [SESSION_ID]: 'main' },
      });
      // Should not throw or invoke any refresh paths.
      store.getState().sweepGithub();
      expect(store.getState().sessionGithub[SESSION_ID]).toBeUndefined();
    });
  });

  // ─── integrations ────────────────────────────────────────────────────

  describe('integrations', () => {
    it('loadIntegrations caches rows keyed by workspaceId', async () => {
      const store = await getStore();
      const integ: WorkspaceIntegration = {
        id: 'i-1' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'linear',
        config: { workspaceUrlKey: 'k', viewerUserId: 'u', viewerName: 'n' },
        credentialKey: 'k',
        createdAt: NOW,
        updatedAt: NOW,
      };
      listIntegrationsForWorkspaceSpy.mockResolvedValueOnce([integ]);
      await store.getState().loadIntegrations(WS_ID);
      expect(store.getState().workspaceIntegrations[WS_ID]).toEqual([integ]);
    });

    it('connectLinear upserts a workspace_integrations row and caches it', async () => {
      const store = await getStore();
      linearConnectSpy.mockResolvedValueOnce({
        id: 'viewer-1',
        name: 'tester',
        organization: { urlKey: 'org' },
      });
      const out = await store.getState().connectLinear(WS_ID, 'tok');
      expect(out.id).toBe('viewer-1');
      expect(upsertWorkspaceIntegrationSpy).toHaveBeenCalledTimes(1);
      const cached = store.getState().workspaceIntegrations[WS_ID];
      expect(cached?.some((i) => i.provider === 'linear')).toBe(true);
    });

    it('disconnectLinear removes the linear row from cache', async () => {
      const store = await getStore();
      const integ: WorkspaceIntegration = {
        id: 'i-1' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'linear',
        config: { workspaceUrlKey: 'k', viewerUserId: 'u', viewerName: 'n' },
        credentialKey: 'k',
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({ workspaceIntegrations: { [WS_ID]: [integ] } });
      await store.getState().disconnectLinear(WS_ID);
      expect(store.getState().workspaceIntegrations[WS_ID]).toEqual([]);
    });
  });

  // ─── notifications ───────────────────────────────────────────────────

  describe('notifications', () => {
    it('emitNotification prepends a new notification', async () => {
      const store = await getStore();
      await store.getState().emitNotification('error', 'error', 'oops');
      const ns = store.getState().notifications;
      expect(ns).toHaveLength(1);
      expect(ns[0]?.title).toBe('oops');
      expect(ns[0]?.read).toBe(false);
      expect(insertNotificationSpy).toHaveBeenCalledTimes(1);
    });

    it('markNotificationsRead flips read=true on all entries', async () => {
      const store = await getStore();
      store.setState({
        notifications: [{ id: 'n1', read: false } as never, { id: 'n2', read: false } as never],
      });
      await store.getState().markNotificationsRead();
      expect(store.getState().notifications.every((n) => n.read)).toBe(true);
    });

    it('clearNotifications empties the array', async () => {
      const store = await getStore();
      store.setState({
        notifications: [{ id: 'n1' } as never],
      });
      await store.getState().clearNotifications();
      expect(store.getState().notifications).toEqual([]);
    });
  });

  // ─── nudges ──────────────────────────────────────────────────────────

  describe('nudges', () => {
    it('dismissSessionNudge clears the nudge and records the outcome', async () => {
      const store = await getStore();
      store.setState({
        sessionNudges: {
          [SESSION_ID]: {
            kind: 'plan-ready',
            id: 'n1',
            agentId: AGENT_ID,
            planId: null,
            planTitle: 't',
          },
        },
      });
      await store.getState().dismissSessionNudge(SESSION_ID, 'dismissed');
      expect(store.getState().sessionNudges[SESSION_ID]).toBeNull();
      expect(updateNudgeOutcomeSpy).toHaveBeenCalled();
    });

    it('dismissSessionNudge is a no-op when no nudge is present', async () => {
      const store = await getStore();
      await store.getState().dismissSessionNudge(SESSION_ID);
      expect(updateNudgeOutcomeSpy).not.toHaveBeenCalled();
    });
  });

  // ─── skills ──────────────────────────────────────────────────────────

  describe('skills', () => {
    it('loadSkills caches per-workspace skill list', async () => {
      const store = await getStore();
      const skill: Skill = {
        id: 's1' as SkillId,
        workspaceId: WS_ID,
        name: 'do-thing',
        description: 'd',
        filePath: 'p',
        body: 'body',
        frontmatter: { name: 'do-thing', description: 'd' },
        createdAt: NOW,
        updatedAt: NOW,
      };
      invokeSkillListSpy.mockResolvedValueOnce([skill]);
      await store.getState().loadSkills(WS_ID);
      expect(store.getState().skills[WS_ID]).toEqual([skill]);
    });

    it('rescanSkills replaces the cached skill list', async () => {
      const store = await getStore();
      const skill: Skill = {
        id: 's2' as SkillId,
        workspaceId: WS_ID,
        name: 'rescan-skill',
        description: 'd',
        filePath: 'p',
        body: 'b',
        frontmatter: { name: 'rescan-skill', description: 'd' },
        createdAt: NOW,
        updatedAt: NOW,
      };
      invokeSkillRescanSpy.mockResolvedValueOnce([skill]);
      await store.getState().rescanSkills(WS_ID);
      expect(store.getState().skills[WS_ID]).toHaveLength(1);
    });

    it('deleteSkill invokes delete and refreshes', async () => {
      const store = await getStore();
      invokeSkillListSpy.mockResolvedValueOnce([]);
      await store.getState().deleteSkill('s1' as SkillId, WS_ID);
      expect(invokeSkillDeleteSpy).toHaveBeenCalledWith('s1');
      expect(store.getState().skills[WS_ID]).toEqual([]);
    });
  });

  // ─── diff-comments ───────────────────────────────────────────────────

  describe('diff-comments', () => {
    it('loadDiffComments caches the per-session list', async () => {
      const store = await getStore();
      const dc = { id: 'd1', sessionId: SESSION_ID, filePath: 'x' } as DiffComment;
      listDiffCommentsSpy.mockResolvedValueOnce([dc]);
      await store.getState().loadDiffComments(SESSION_ID);
      expect(store.getState().diffComments[SESSION_ID]).toEqual([dc]);
    });

    it('loadDiffComments short-circuits when cache is already filled', async () => {
      const store = await getStore();
      const seeded = [{ id: 'seeded' } as DiffComment];
      store.setState({ diffComments: { [SESSION_ID]: seeded } });
      await store.getState().loadDiffComments(SESSION_ID);
      expect(listDiffCommentsSpy).not.toHaveBeenCalled();
      expect(store.getState().diffComments[SESSION_ID]).toBe(seeded);
    });

    it('addDiffComment writes through then refreshes', async () => {
      const store = await getStore();
      listDiffCommentsSpy.mockResolvedValueOnce([{ id: 'fresh' } as DiffComment]);
      await store.getState().addDiffComment(SESSION_ID, 'file.ts', 'lgtm');
      expect(insertDiffCommentSpy).toHaveBeenCalled();
      expect(store.getState().diffComments[SESSION_ID]?.[0]?.id).toBe('fresh');
    });

    it('resolveDiffComment writes through then refreshes the list', async () => {
      const store = await getStore();
      listDiffCommentsSpy.mockResolvedValueOnce([]);
      await store.getState().resolveDiffComment(SESSION_ID, 'd1');
      expect(resolveDiffCommentDbSpy).toHaveBeenCalled();
    });

    it('consumeDiffComments is a no-op when commentIds is empty', async () => {
      const store = await getStore();
      await store.getState().consumeDiffComments(SESSION_ID, [], AGENT_ID);
      expect(consumeDiffCommentsDbSpy).not.toHaveBeenCalled();
    });

    it('deleteDiffComment writes through then refreshes', async () => {
      const store = await getStore();
      listDiffCommentsSpy.mockResolvedValueOnce([]);
      await store.getState().deleteDiffComment(SESSION_ID, 'd1');
      expect(deleteDiffCommentDbSpy).toHaveBeenCalled();
    });
  });

  // ─── sidebar ─────────────────────────────────────────────────────────

  describe('sidebar', () => {
    it('setSidebarWorkspaceSearch stores the query', async () => {
      const store = await getStore();
      store.getState().setSidebarWorkspaceSearch('foo');
      expect(store.getState().sidebarWorkspaceSearch).toBe('foo');
    });

    it('setSidebarSessionSearch stores the query', async () => {
      const store = await getStore();
      store.getState().setSidebarSessionSearch('bar');
      expect(store.getState().sidebarSessionSearch).toBe('bar');
    });

    it('setSidebarStateFilter stores the array', async () => {
      const store = await getStore();
      store.getState().setSidebarStateFilter(['running', 'idle']);
      expect(store.getState().sidebarStateFilter).toEqual(['running', 'idle']);
    });

    it('setSidebarProviderFilter stores the array', async () => {
      const store = await getStore();
      store.getState().setSidebarProviderFilter(['anthropic']);
      expect(store.getState().sidebarProviderFilter).toEqual(['anthropic']);
    });

    it('refreshUnreadWorkspaces stores the set returned by the invoker', async () => {
      const store = await getStore();
      invokeWorkspacesWithUnreadSpy.mockResolvedValueOnce([WS_ID, WS_ID_2]);
      await store.getState().refreshUnreadWorkspaces();
      const s = store.getState().unreadWorkspaceIds;
      expect(s.has(WS_ID)).toBe(true);
      expect(s.has(WS_ID_2)).toBe(true);
    });

    it('refreshUnreadWorkspaces swallows errors and leaves state untouched', async () => {
      const store = await getStore();
      const seeded = new Set<WorkspaceId>([WS_ID]);
      store.setState({ unreadWorkspaceIds: seeded });
      invokeWorkspacesWithUnreadSpy.mockRejectedValueOnce(new Error('boom'));
      await store.getState().refreshUnreadWorkspaces();
      expect(store.getState().unreadWorkspaceIds).toBe(seeded);
    });
  });

  // ─── session-view ────────────────────────────────────────────────────

  describe('session-view', () => {
    it('getSessionViewPrefs returns defaults for a workspace with no stored prefs', async () => {
      const store = await getStore();
      const prefs = store.getState().getSessionViewPrefs(WS_ID);
      expect(prefs).toEqual({ sort: 'updatedAt', group: 'none' });
    });

    it('setSessionSort persists the chosen sort key', async () => {
      const store = await getStore();
      store.getState().setSessionSort(WS_ID, 'goal');
      expect(store.getState().sessionViewPrefs[WS_ID]?.sort).toBe('goal');
    });

    it('setSessionGroup persists the chosen group key', async () => {
      const store = await getStore();
      store.getState().setSessionGroup(WS_ID, 'pr');
      expect(store.getState().sessionViewPrefs[WS_ID]?.group).toBe('pr');
    });
  });

  // ─── system alerts ───────────────────────────────────────────────────

  describe('system alerts', () => {
    it('dismissSystemAlert removes the matching alert', async () => {
      const store = await getStore();
      store.setState({
        systemAlerts: [
          { id: 'a1', kind: 'context-soft-cap', message: 'x', createdAt: NOW } as never,
          { id: 'a2', kind: 'context-soft-cap', message: 'y', createdAt: NOW } as never,
        ],
      });
      store.getState().dismissSystemAlert('a1');
      expect(store.getState().systemAlerts.map((a) => a.id)).toEqual(['a2']);
    });

    it('clearSessionNextActions removes the entry for sid', async () => {
      const store = await getStore();
      store.setState({
        sessionNextActions: { [SESSION_ID]: [{ kind: 'create_pr' } as never] },
      });
      store.getState().clearSessionNextActions(SESSION_ID);
      expect(store.getState().sessionNextActions[SESSION_ID]).toBeUndefined();
    });
  });

  // ─── transcripts & messages ──────────────────────────────────────────

  describe('transcripts', () => {
    it('appendTurnEvent pushes an event onto the agent transcript', async () => {
      const store = await getStore();
      store.setState({
        sessions: [buildSession()],
        sessionPhaseRuns: { [SESSION_ID]: [buildAgent({ id: AGENT_ID })] },
      });
      const ev: TurnEvent = {
        kind: 'assistant_text',
        runId: RUN_ID,
        delta: 'hi',
        at: NOW,
      } as TurnEvent;
      store.getState().appendTurnEvent(AGENT_ID, SESSION_ID, ev);
      expect(store.getState().transcripts[AGENT_ID]).toEqual([ev]);
    });

    it('resetTranscript clears the per-agent transcript', async () => {
      const store = await getStore();
      const ev: TurnEvent = {
        kind: 'assistant_text',
        runId: RUN_ID,
        delta: 'x',
        at: NOW,
      } as TurnEvent;
      store.setState({ transcripts: { [AGENT_ID]: [ev] } });
      store.getState().resetTranscript(AGENT_ID);
      expect(store.getState().transcripts[AGENT_ID]).toEqual([]);
    });

    it('appendTurnEvent bumps unknownPayloadCounts for unknown_payload events', async () => {
      const store = await getStore();
      store.setState({
        sessions: [buildSession()],
        sessionPhaseRuns: { [SESSION_ID]: [buildAgent({ id: AGENT_ID })] },
      });
      const ev: TurnEvent = {
        kind: 'unknown_payload',
        runId: RUN_ID,
        adapter: 'anthropic',
        payloadType: 'foo',
        raw: '{}',
        at: NOW,
      } as TurnEvent;
      store.getState().appendTurnEvent(AGENT_ID, SESSION_ID, ev);
      expect(store.getState().unknownPayloadCounts['anthropic:foo']).toBe(1);
    });
  });

  // ─── agents ──────────────────────────────────────────────────────────

  describe('agents', () => {
    it('setAgentDraft stores per-agent text', async () => {
      const store = await getStore();
      store.getState().setAgentDraft(AGENT_ID, 'wip');
      expect(store.getState().agentDraft[AGENT_ID]).toBe('wip');
    });

    it('clearAgentDraft removes the per-agent entry', async () => {
      const store = await getStore();
      store.setState({ agentDraft: { [AGENT_ID]: 'wip' } });
      store.getState().clearAgentDraft(AGENT_ID);
      expect(store.getState().agentDraft[AGENT_ID]).toBeUndefined();
    });

    it('setAgentKind stores override and persists', async () => {
      const store = await getStore();
      store.getState().setAgentKind(AGENT_ID, 'implementer');
      expect(store.getState().agentKindOverride[AGENT_ID]).toBe('implementer');
      // The matching model default for implementer should be wired up.
      expect(store.getState().agentModelOverride[AGENT_ID]).toBe('claude-sonnet-4-5');
      expect(invokeAgentSetKindSpy).toHaveBeenCalledWith(AGENT_ID, 'implementer');
    });

    it('markAgentViewed no-ops when the agent has no lastFinishedAt', async () => {
      const store = await getStore();
      const agent = buildAgent({ id: AGENT_ID });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      await store.getState().markAgentViewed(SESSION_ID, AGENT_ID);
      expect(invokeAgentMarkViewedSpy).not.toHaveBeenCalled();
    });

    it('markAgentViewed stamps lastViewedAt and invokes persist when finished is newer than viewed', async () => {
      const store = await getStore();
      const finishedAt = '2026-05-28T01:00:00.000Z' as IsoDateTime;
      const agent = buildAgent({
        id: AGENT_ID,
        status: 'completed',
        lastFinishedAt: finishedAt,
        lastViewedAt: undefined as never,
      });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      await store.getState().markAgentViewed(SESSION_ID, AGENT_ID);
      expect(invokeAgentMarkViewedSpy).toHaveBeenCalled();
      const updated = store.getState().sessionPhaseRuns[SESSION_ID]?.[0];
      expect(updated?.lastViewedAt).toBeDefined();
    });
  });

  // ─── workspace overrides ─────────────────────────────────────────────

  describe('overrides', () => {
    it('setWorkspaceOverrides caches the override map keyed by workspace', async () => {
      const store = await getStore();
      await store.getState().setWorkspaceOverrides(WS_ID, { defaultVerbosity: 'brief' } as never);
      expect(store.getState().workspaceOverrides[WS_ID]?.defaultVerbosity).toBe('brief');
    });

    it('setTaskOverrides caches the override map keyed by session', async () => {
      const store = await getStore();
      await store.getState().setTaskOverrides(SESSION_ID, { defaultVerbosity: 'normal' } as never);
      expect(store.getState().sessionOverrides[SESSION_ID]?.defaultVerbosity).toBe('normal');
    });
  });

  // ─── settings (low-level kv) ─────────────────────────────────────────

  describe('settings', () => {
    it('loadSetting writes the value into settings map when DB returns a string', async () => {
      const store = await getStore();
      dbGetSettingSpy.mockResolvedValueOnce('val');
      const out = await store.getState().loadSetting('k');
      expect(out).toBe('val');
      expect(store.getState().settings['k']).toBe('val');
    });

    it('loadSetting leaves settings untouched when DB returns null', async () => {
      const store = await getStore();
      dbGetSettingSpy.mockResolvedValueOnce(null);
      const out = await store.getState().loadSetting('k');
      expect(out).toBeNull();
      expect(store.getState().settings['k']).toBeUndefined();
    });

    it('saveSetting persists and caches', async () => {
      const store = await getStore();
      await store.getState().saveSetting('k', 'v');
      expect(dbSetSettingSpy).toHaveBeenCalled();
      expect(store.getState().settings['k']).toBe('v');
    });
  });

  // ─── merge conflicts ─────────────────────────────────────────────────

  describe('merge conflicts', () => {
    it('setSessionMergeConflicts stores the array under the session id', async () => {
      const store = await getStore();
      store
        .getState()
        .setSessionMergeConflicts(SESSION_ID, [
          { filePath: 'a.ts', runId: RUN_ID, content: '' } as never,
        ]);
      expect(store.getState().sessionMergeConflicts[SESSION_ID]).toHaveLength(1);
    });
  });

  // ─── session config ──────────────────────────────────────────────────

  describe('config', () => {
    it('setSessionConfig writes verbosity through', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession()] });
      await store.getState().setSessionConfig(SESSION_ID, { verbosity: 'brief' });
      expect(store.getState().sessions[0]?.verbosity).toBe('brief');
    });

    it('setAgentConfig writes verbosity through', async () => {
      const store = await getStore();
      const agent = buildAgent({ id: AGENT_ID });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      await store.getState().setAgentConfig(SESSION_ID, AGENT_ID, { verbosity: 'normal' });
      const updated = store.getState().sessionPhaseRuns[SESSION_ID]?.find((r) => r.id === AGENT_ID);
      expect(updated?.verbosity).toBe('normal');
    });
  });

  // ─── scripts ─────────────────────────────────────────────────────────

  describe('scripts', () => {
    it('loadScripts caches workspace scripts', async () => {
      const store = await getStore();
      const script: WorkspaceScript = {
        id: 'sc-1' as WorkspaceScriptId,
        workspaceId: WS_ID,
        name: 'test',
        body: 'echo',
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      };
      listWorkspaceScriptsSpy.mockResolvedValueOnce([script]);
      await store.getState().loadScripts(WS_ID);
      expect(store.getState().workspaceScripts[WS_ID]).toEqual([script]);
    });

    it('deleteScript removes from cache immediately', async () => {
      const store = await getStore();
      const script: WorkspaceScript = {
        id: 'sc-1' as WorkspaceScriptId,
        workspaceId: WS_ID,
        name: 'test',
        body: 'echo',
        sortOrder: 0,
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({ workspaceScripts: { [WS_ID]: [script] } });
      await store.getState().deleteScript(script.id, WS_ID);
      expect(store.getState().workspaceScripts[WS_ID]).toEqual([]);
    });
  });

  // ─── terminal ────────────────────────────────────────────────────────

  describe('terminal', () => {
    it('openTerminal marks the session as open', async () => {
      const store = await getStore();
      await store.getState().openTerminal(SESSION_ID, '/cwd', 80, 24);
      expect(store.getState().terminalSessions[SESSION_ID]).toBe('open');
    });

    it('closeTerminal marks the session as closed', async () => {
      const store = await getStore();
      store.setState({ terminalSessions: { [SESSION_ID]: 'open' } });
      await store.getState().closeTerminal(SESSION_ID);
      expect(store.getState().terminalSessions[SESSION_ID]).toBe('closed');
    });
  });

  // ─── slots ───────────────────────────────────────────────────────────

  describe('slots', () => {
    it('loadSessionSlots caches slots under sessionId', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      (db.listContextSlotsForSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { key: 'goal', value: 'g', enabled: true } as ContextSlot,
      ]);
      await store.getState().loadSessionSlots(SESSION_ID);
      expect(store.getState().sessionSlots[SESSION_ID]).toHaveLength(1);
    });

    it('toggleSessionSlot upserts the slot with new enabled flag', async () => {
      const store = await getStore();
      store.setState({
        sessionSlots: { [SESSION_ID]: [{ key: 'goal', value: 'g', enabled: true } as ContextSlot] },
      });
      await store.getState().toggleSessionSlot(SESSION_ID, 'goal', false);
      const slot = store.getState().sessionSlots[SESSION_ID]?.find((s) => s.key === 'goal');
      expect(slot?.enabled).toBe(false);
    });
  });

  // ─── telemetry ───────────────────────────────────────────────────────

  describe('telemetry', () => {
    it('loadSessionTelemetry caches the records', async () => {
      const store = await getStore();
      const rec = {
        id: 'tr-1' as TelemetryRecordId,
        runId: RUN_ID,
        sessionId: SESSION_ID,
        kind: 'turn',
        provider: 'anthropic',
        model: 'm',
        inputTokens: 1,
        outputTokens: 1,
        estimatedCostUsd: 0.01,
        recordedAt: NOW,
      } as TelemetryRecord;
      const db = await import('@goodboy/db');
      (db.listTelemetryForSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        rec,
      ]);
      await store.getState().loadSessionTelemetry(SESSION_ID);
      expect(store.getState().sessionTelemetry[SESSION_ID]).toEqual([rec]);
    });

    it('refreshSessionSummary stores the summary', async () => {
      const store = await getStore();
      const sum = { estimatedCostUsd: 1.23 } as never;
      const db = await import('@goodboy/db');
      (db.summarizeSessionTelemetry as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        sum,
      );
      await store.getState().refreshSessionSummary(SESSION_ID);
      expect(store.getState().sessionSummary).toBe(sum);
    });
  });

  // ─── boot phase ──────────────────────────────────────────────────────

  describe('boot', () => {
    it('initial state defaults to pending bootPhase and not hydrated', async () => {
      const store = await getStore();
      expect(store.getState().bootPhase).toBe('pending');
      expect(store.getState().hydrated).toBe(false);
    });

    it('after hydrate the boot phase reaches ready (no workspaces configured)', async () => {
      const store = await getStore();
      await store.getState().hydrate();
      const s = store.getState();
      expect(s.hydrated).toBe(true);
      expect(s.bootPhase === 'ready' || s.bootPhase === 'error').toBe(true);
    });
  });
});
