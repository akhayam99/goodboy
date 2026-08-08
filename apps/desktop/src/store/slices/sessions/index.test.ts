// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
  Message,
  MessageId,
  PendingResolution,
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
const deleteFileVersionsForSessionSpy = vi.fn(async () => undefined);
const listPendingResolutionsForSessionSpy = vi.fn(
  async () => [] as ReadonlyArray<PendingResolution>,
);

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
  upsertSessionExternalTask: vi.fn(async () => undefined),
  deleteSessionExternalTask: vi.fn(async () => undefined),
  listExternalTasksForWorkspace: vi.fn(async () => []),
  listContextSlotsForSession: vi.fn(async () => []),
  insertContextSlotHistory: vi.fn(async () => undefined),
  listContextSlotHistory: vi.fn(async () => []),
  listGoalAttachmentsForSession: vi.fn(async () => []),
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
  deleteFileVersionsForSession: deleteFileVersionsForSessionSpy,
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
  updateSessionActiveMount: vi.fn(async () => undefined),
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
  listPendingResolutionsForSession: listPendingResolutionsForSessionSpy,
  queuePendingResolution: vi.fn(async () => undefined),
  deletePendingResolution: vi.fn(async () => undefined),
  markPendingResolutionReplyPosted: vi.fn(async () => undefined),
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

vi.mock('../../../features/chat/turn', () => ({
  runTurn: vi.fn(),
  cancelTurn: vi.fn(async () => undefined),
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
const createSessionDirSpy = vi.fn();
const removeWorktreeSpy = vi.fn(async () => undefined);
const changeWorktreeBranchSpy = vi.fn(async () => undefined);

vi.mock('../../../features/worktree/worktree', () => ({
  createWorktree: createWorktreeSpy,
  createSessionDir: createSessionDirSpy,
  removeWorktree: removeWorktreeSpy,
  changeWorktreeBranch: changeWorktreeBranchSpy,
  worktreeChangedFiles: vi.fn(async () => []),
}));

vi.mock('../../../shared/lib/repo', () => ({
  validateGitRepo: vi.fn(async () => ({ isRepo: true, rootPath: '/tmp/repo' })),
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

async function getStore() {
  const mod = await import('../../store');
  return mod.useAppStore;
}

let resetState: Record<string, unknown> | null = null;

const STORE_IMPORT_TIMEOUT_MS = 60_000;

describe('store contract', () => {
  beforeAll(async () => {
    await getStore();
  }, STORE_IMPORT_TIMEOUT_MS);

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
    listPendingResolutionsForSessionSpy.mockResolvedValue([]);
    dbGetSettingSpy.mockResolvedValue(null);
    ghStatusSpy.mockResolvedValue({ available: true, mode: 'gh-cli', scopes: [] });

    const store = await getStore();
    if (!resetState) {
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
        sessionMounts: {},
        sessionActiveMount: {},
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
        sessionGithubPrs: {},
        sessionSelectedPrNumber: {},
        volatilePermissionAllows: new Set<string>(),
        agentModelOverride: {},
        agentProviderOverride: {},
        agentKindOverride: {},
        agentDraft: {},
        diffComments: {},
        sessionFileVersions: {},
        sessionFileVersionsLoading: {},
        sessionFileVersionSelectedPath: {},
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

    it('setCurrentSession rebuilds resolver verdicts from the persisted transcript', async () => {
      const store = await getStore();
      store.setState({ resolverThreadOutcomes: {} } as never);
      invokeAgentListSpy.mockResolvedValue([
        buildAgent({
          id: AGENT_ID,
          name: 'resolver',
          kind: 'resolver',
          status: 'completed',
          sourceThreadIds: ['PRRT_1'],
        }),
      ]);
      const { listMessagesForAgent } = await import('@goodboy/db');
      (listMessagesForAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'message-1' as MessageId,
          sessionId: SESSION_ID,
          agentId: AGENT_ID,
          role: 'assistant',
          content: '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">>',
          createdAt: NOW,
        } satisfies Message,
      ]);

      await store.getState().setCurrentSession(SESSION_ID);

      await vi.waitFor(() => {
        expect(store.getState().resolverThreadOutcomes[AGENT_ID]).toEqual({
          PRRT_1: { kind: 'resolved', commitSha: 'abcdef1234567890' },
        });
      });
    });

    it('loads pending resolutions on activation, so a session landing on a lens other than Overview still sees the retry strip', async () => {
      const store = await getStore();
      store.setState({ sessionPendingResolutions: {} });
      const pending: PendingResolution = {
        id: 'pending-1',
        sessionId: SESSION_ID,
        prNumber: 7,
        threadId: 'PRRT_2',
        commitSha: '',
        reply: null,
        outcome: 'wontfix',
        replyPostedAt: null,
        createdAt: NOW,
      };
      listPendingResolutionsForSessionSpy.mockResolvedValue([pending]);

      await store.getState().setCurrentSession(SESSION_ID);

      await vi.waitFor(() => {
        expect(store.getState().sessionPendingResolutions[SESSION_ID]).toEqual([pending]);
      });
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

    it('setSessionPermissionMode mutates the session row', async () => {
      const store = await getStore();
      store.setState({ sessions: [buildSession()] });
      await store.getState().setSessionPermissionMode(SESSION_ID, 'default');
      expect(store.getState().sessions[0]?.permissionMode).toBe('default');
    });

    it('archiveTask removes the session from active list and clears currentSessionId if it was current', async () => {
      const store = await getStore();
      store.setState({
        sessions: [buildSession()],
        currentSessionId: SESSION_ID,
        sessionGithubPrs: { [SESSION_ID]: [] },
        sessionSelectedPrNumber: { [SESSION_ID]: 40 },
      });
      await store.getState().archiveTask(SESSION_ID);
      const s = store.getState();
      expect(s.sessions).toEqual([]);
      expect(s.currentSessionId).toBeNull();
      expect(s.sessionGithubPrs[SESSION_ID]).toBeUndefined();
      expect(s.sessionSelectedPrNumber[SESSION_ID]).toBeUndefined();
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

    it('deleteTask removes an archived session from the archived cache', async () => {
      const store = await getStore();
      const archived: Session = {
        ...buildSession(),
        archivedAt: NOW,
      } as Session;
      store.setState({
        workspaces: [buildWorkspace()],
        currentWorkspaceId: WS_ID,
        currentSessionId: SESSION_ID,
        archivedSessions: { [WS_ID]: [archived] },
        sessionGithubPrs: { [SESSION_ID]: [] },
        sessionSelectedPrNumber: { [SESSION_ID]: 40 },
      });
      await store.getState().deleteTask(SESSION_ID);
      const s = store.getState();
      expect(s.archivedSessions[WS_ID]).toEqual([]);
      expect(s.currentSessionId).toBeNull();
      expect(s.sessionGithubPrs[SESSION_ID]).toBeUndefined();
      expect(s.sessionSelectedPrNumber[SESSION_ID]).toBeUndefined();
    });

    it('deleteTask purges file versions for a branchless session', async () => {
      const store = await getStore();
      store.setState({
        sessions: [buildSession()],
        workspaces: [buildWorkspace({ kind: 'simple', rootPath: '/tmp/simple-space' })],
        sessionBranches: { [SESSION_ID]: '' },
        sessionWorktrees: { [SESSION_ID]: ['/tmp/simple-space/sessions/test'] },
      });

      await store.getState().deleteTask(SESSION_ID);

      expect(deleteFileVersionsForSessionSpy).toHaveBeenCalledWith({
        db: expect.anything(),
        sessionId: SESSION_ID,
      });
    });

    describe('bulk archived ops', () => {
      function buildArchived(id: SessionId, goal: string): Session {
        return {
          ...buildSession({ id, goal }),
          archivedAt: NOW,
        } as Session;
      }

      it('bulkArchiveTask archives every selected active session', async () => {
        const store = await getStore();
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          sessions: [buildSession(), buildSession({ id: SESSION_ID_2, goal: 'two' })],
        });
        await store.getState().bulkArchiveTask([SESSION_ID, SESSION_ID_2]);
        expect(store.getState().sessions).toEqual([]);
      });

      it('bulkArchiveTask keeps archiving after one session fails and reports the failure', async () => {
        const store = await getStore();
        const { archiveSession } = await import('@goodboy/db');
        (archiveSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new Error('db down'),
        );
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          sessions: [buildSession(), buildSession({ id: SESSION_ID_2, goal: 'two' })],
        });
        await store.getState().bulkArchiveTask([SESSION_ID, SESSION_ID_2]);
        expect(store.getState().sessions.map((x) => x.id)).toEqual([SESSION_ID]);
        expect(insertNotificationSpy).toHaveBeenCalled();
      });

      it('bulkUnarchiveTask restores every selected session into the active list', async () => {
        const store = await getStore();
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
        });
        await store.getState().bulkUnarchiveTask([SESSION_ID, SESSION_ID_2]);
        const s = store.getState();
        expect(s.sessions.map((x) => x.id).sort()).toEqual([SESSION_ID, SESSION_ID_2].sort());
        expect(s.archivedSessions[WS_ID]).toEqual([]);
      });

      it('bulkUnarchiveTask keeps restoring after one session fails and reports the failure', async () => {
        const store = await getStore();
        const { unarchiveSession } = await import('@goodboy/db');
        (unarchiveSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new Error('db down'),
        );
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'bad'), buildArchived(SESSION_ID_2, 'good')],
          },
        });
        await store.getState().bulkUnarchiveTask([SESSION_ID, SESSION_ID_2]);
        const s = store.getState();
        expect(s.sessions.map((x) => x.id)).toEqual([SESSION_ID_2]);
        expect(s.archivedSessions[WS_ID]?.map((x) => x.id)).toEqual([SESSION_ID]);
        expect(insertNotificationSpy).toHaveBeenCalled();
      });

      it('bulkDeleteTask removes every selected session from the archived cache', async () => {
        const store = await getStore();
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
        });
        await store.getState().bulkDeleteTask([SESSION_ID, SESSION_ID_2]);
        expect(store.getState().archivedSessions[WS_ID]).toEqual([]);
      });

      it('bulkDeleteTask keeps deleting after one session throws', async () => {
        const store = await getStore();
        const MISSING = 'session-missing' as SessionId;
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
        });
        await store.getState().bulkDeleteTask([MISSING, SESSION_ID, SESSION_ID_2]);
        expect(store.getState().archivedSessions[WS_ID]).toEqual([]);
      });

      it('bulkDeleteTask reports the exact failed-of-total count when a delete throws', async () => {
        const store = await getStore();
        const MISSING = 'session-missing' as SessionId;
        const emitSpy = vi.fn<(...args: unknown[]) => Promise<undefined>>(async () => undefined);
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
          emitNotification: emitSpy as never,
        });
        await store.getState().bulkDeleteTask([MISSING, SESSION_ID]);
        expect(store.getState().archivedSessions[WS_ID]?.map((x) => x.id)).toEqual([SESSION_ID_2]);
        const summary = emitSpy.mock.calls.find((c) =>
          String((c as unknown[])[2]).startsWith('failed to delete'),
        );
        expect(summary?.[2]).toBe('failed to delete 1 of 2 sessions');
      });

      it('bulkDeleteTask deletes sequentially in the given id order', async () => {
        const store = await getStore();
        const { deleteSession } = await import('@goodboy/db');
        const spy = deleteSession as unknown as ReturnType<typeof vi.fn>;
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
        });
        await store.getState().bulkDeleteTask([SESSION_ID_2, SESSION_ID]);
        expect(spy.mock.calls.map((c) => c[1])).toEqual([SESSION_ID_2, SESSION_ID]);
      });

      it('bulkDeleteTask is a no-op and emits no notification for an empty selection', async () => {
        const store = await getStore();
        const { deleteSession } = await import('@goodboy/db');
        await store.getState().bulkDeleteTask([]);
        expect(deleteSession as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
        expect(insertNotificationSpy).not.toHaveBeenCalled();
      });

      it('bulkUnarchiveTask is a no-op and emits no notification for an empty selection', async () => {
        const store = await getStore();
        const { unarchiveSession } = await import('@goodboy/db');
        await store.getState().bulkUnarchiveTask([]);
        expect(unarchiveSession as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
        expect(insertNotificationSpy).not.toHaveBeenCalled();
      });

      it('bulkUnarchiveTask reports failed-of-total when every restore fails', async () => {
        const store = await getStore();
        const { unarchiveSession } = await import('@goodboy/db');
        (unarchiveSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error('db down'),
        );
        const emitSpy = vi.fn<(...args: unknown[]) => Promise<undefined>>(async () => undefined);
        store.setState({
          workspaces: [buildWorkspace()],
          currentWorkspaceId: WS_ID,
          archivedSessions: {
            [WS_ID]: [buildArchived(SESSION_ID, 'one'), buildArchived(SESSION_ID_2, 'two')],
          },
          emitNotification: emitSpy as never,
        });
        await store.getState().bulkUnarchiveTask([SESSION_ID, SESSION_ID_2]);
        const s = store.getState();
        expect(s.sessions).toEqual([]);
        expect(s.archivedSessions[WS_ID]?.map((x) => x.id).sort()).toEqual(
          [SESSION_ID, SESSION_ID_2].sort(),
        );
        const summary = emitSpy.mock.calls.find((c) =>
          String((c as unknown[])[2]).startsWith('failed to restore'),
        );
        expect(summary?.[2]).toBe('failed to restore 2 of 2 sessions');
      });
    });
  });

  describe('createSession simple workspace', () => {
    it('registers a simple session directory with the requested folder name and an empty branch', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      vi.mocked(db.listWorkspaces).mockResolvedValueOnce([
        buildWorkspace({
          rootPath: '/tmp/study-space',
          kind: 'simple',
        }),
      ]);
      createSessionDirSpy.mockResolvedValueOnce({
        worktreePath: '/tmp/study-space/sessions/MatchAnalysis_20260514',
        branchName: '',
        slug: 'MatchAnalysis_20260514',
        reused: false,
      });
      store.setState({ currentWorkspaceId: WS_ID });

      const { session, worktree } = await store.getState().createSession({
        workspaceId: WS_ID,
        goal: 'Study plan',
        folderName: 'MatchAnalysis_20260514',
      });

      expect(createSessionDirSpy).toHaveBeenCalledWith({
        basePath: '/tmp/study-space',
        slug: expect.stringMatching(/^study-plan-[a-f0-9]{8}$/),
        directoryName: 'MatchAnalysis_20260514',
        sessionId: session.id,
        workspaceId: WS_ID,
      });
      expect(createWorktreeSpy).not.toHaveBeenCalled();
      expect(worktree.branchName).toBe('');
      expect(vi.mocked(db.insertSessionWorktree)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          sessionId: session.id,
          worktreePath: worktree.worktreePath,
          branch: '',
          parallelIndex: 0,
        }),
      );
      expect(store.getState().sessionBranches[session.id]).toBe('');
    });

    it('seeds the workspace routing pool and includes its default provider', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      vi.mocked(db.listWorkspaces).mockResolvedValueOnce([
        buildWorkspace({
          rootPath: '/tmp/study-space',
          kind: 'simple',
        }),
      ]);
      createSessionDirSpy.mockResolvedValueOnce({
        worktreePath: '/tmp/study-space/sessions/Study plan',
        branchName: '',
        slug: 'Study plan',
        reused: false,
      });
      store.setState({
        currentWorkspaceId: WS_ID,
        workspaceOverrides: {
          [WS_ID]: {
            defaultProviderId: 'codex',
            enabledProviders: ['anthropic'],
          } as never,
        },
      });

      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'Study plan' });

      expect(createSessionDirSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          directoryName: 'Study plan',
        }),
      );
      expect(session.providerPreference).toEqual({
        defaultProvider: 'codex',
        allowTurnOverride: true,
        enabledProviders: ['anthropic', 'codex'],
      });
    });
  });

  describe('createSession composite workspace', () => {
    it('creates ordered member worktrees and hydrates their mounts', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const apiWorkspaceId = 'workspace-api' as WorkspaceId;
      const webWorkspaceId = 'workspace-web' as WorkspaceId;
      vi.mocked(db.listWorkspaces).mockResolvedValueOnce([
        buildWorkspace({
          rootPath: '/tmp/product',
          kind: 'composite',
          members: [
            { workspaceId: apiWorkspaceId, rootPath: '/tmp/api', mountName: 'api' },
            { workspaceId: webWorkspaceId, rootPath: '/tmp/web', mountName: 'web' },
          ],
        }),
      ]);
      createWorktreeSpy
        .mockResolvedValueOnce({
          worktreePath: '/tmp/product/ship-scope/api',
          branchName: 'ak/ship-scope-api',
          slug: 'ship-scope',
          reused: false,
        })
        .mockResolvedValueOnce({
          worktreePath: '/tmp/product/ship-scope/web',
          branchName: 'ak/ship-scope-web',
          slug: 'ship-scope',
          reused: false,
        });
      store.setState({ currentWorkspaceId: WS_ID });

      const { session, worktree } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'Ship scope' });

      expect(createWorktreeSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ repoPath: '/tmp/api', dirName: 'api' }),
      );
      expect(createWorktreeSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ repoPath: '/tmp/web', dirName: 'web' }),
      );
      expect(vi.mocked(db.insertSessionWorktree)).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          sessionId: session.id,
          worktreePath: worktree.worktreePath,
          parallelIndex: 0,
        }),
      );
      expect(vi.mocked(db.insertSessionWorktree)).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({
          sessionId: session.id,
          worktreePath: '/tmp/product/ship-scope/api',
          parallelIndex: 1,
          mountWorkspaceId: apiWorkspaceId,
          mountName: 'api',
        }),
      );
      expect(vi.mocked(db.insertSessionWorktree)).toHaveBeenNthCalledWith(
        3,
        expect.anything(),
        expect.objectContaining({
          sessionId: session.id,
          worktreePath: '/tmp/product/ship-scope/web',
          parallelIndex: 2,
          mountWorkspaceId: webWorkspaceId,
          mountName: 'web',
        }),
      );
      expect(store.getState().sessionMounts[session.id]).toEqual([
        {
          workspaceId: apiWorkspaceId,
          mountName: 'api',
          worktreePath: '/tmp/product/ship-scope/api',
          repoRoot: '/tmp/api',
          branch: 'ak/ship-scope-api',
        },
        {
          workspaceId: webWorkspaceId,
          mountName: 'web',
          worktreePath: '/tmp/product/ship-scope/web',
          repoRoot: '/tmp/web',
          branch: 'ak/ship-scope-web',
        },
      ]);
      expect(store.getState().sessionActiveMount[session.id]).toBeUndefined();
    });
  });

  describe('createSession external task', () => {
    const GITLAB_TASK = {
      provider: 'gitlab' as const,
      externalId: '101',
      identifier: 'acme/web#7',
      url: 'https://gitlab.com/acme/web/-/issues/7',
      title: 'Fix the thing',
    };

    async function primeWorktree() {
      const { listWorkspaces } = await import('@goodboy/db');
      (listWorkspaces as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        buildWorkspace(),
      ]);
      createWorktreeSpy.mockResolvedValueOnce({
        worktreePath: '/tmp/repo/wt',
        branchName: 'kay/101-fix-the-thing',
        slug: '101-fix-the-thing',
        reused: false,
      });
    }

    it('persists a gitlab external task and caches it on the session', async () => {
      const store = await getStore();
      store.setState({ currentWorkspaceId: WS_ID });
      await primeWorktree();
      const { upsertSessionExternalTask } = await import('@goodboy/db');
      const spy = upsertSessionExternalTask as unknown as ReturnType<typeof vi.fn>;

      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'do gitlab work', externalTask: GITLAB_TASK });

      expect(spy).toHaveBeenCalledTimes(1);
      const cached = store.getState().sessionExternalTasks[session.id];
      expect(cached?.[0]?.provider).toBe('gitlab');
      expect(cached?.[0]?.externalId).toBe('101');
      expect(cached?.[0]?.sessionId).toBe(session.id);
    });

    it('still creates the session but caches no task when persistence fails', async () => {
      const store = await getStore();
      store.setState({ currentWorkspaceId: WS_ID });
      await primeWorktree();
      const { upsertSessionExternalTask } = await import('@goodboy/db');
      (upsertSessionExternalTask as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('db down'),
      );

      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'do gitlab work', externalTask: GITLAB_TASK });

      expect(session.id).toBeDefined();
      expect(store.getState().sessionExternalTasks[session.id]).toBeUndefined();
    });
  });

  describe('createSession lands on Overview', () => {
    it('opens no studio and no lens for a newly created session', async () => {
      const store = await getStore();
      store.setState({ currentWorkspaceId: WS_ID });
      const { listWorkspaces } = await import('@goodboy/db');
      (listWorkspaces as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        buildWorkspace(),
      ]);
      createWorktreeSpy.mockResolvedValueOnce({
        worktreePath: '/tmp/repo/wt',
        branchName: 'kay/setup-workflow',
        slug: 'setup-workflow',
        reused: false,
      });

      const { session } = await store
        .getState()
        .createSession({ workspaceId: WS_ID, goal: 'ship it' });

      expect(store.getState().sessionStudio[session.id]).toBeNull();
      expect(store.getState().activeLens[session.id]).toBeNull();
    });
  });

  describe('session external task links', () => {
    const LINEAR_TASK: Omit<SessionExternalTask, 'sessionId'> = {
      provider: 'linear',
      externalId: 'linear-42',
      identifier: 'GB-42',
      url: 'https://linear.app/acme/issue/GB-42',
      title: 'Link this issue',
      createdAt: NOW,
    };
    const SENTRY_TASK: Omit<SessionExternalTask, 'sessionId'> = {
      provider: 'sentry',
      externalId: 'sentry-7',
      identifier: 'GOODBOY-7',
      url: 'https://sentry.io/organizations/acme/issues/7/',
      title: 'TypeError',
      createdAt: NOW,
    };

    it('persists and caches every linked task', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');

      await store.getState().linkSessionExternalTask(SESSION_ID, LINEAR_TASK);
      await store.getState().linkSessionExternalTask(SESSION_ID, SENTRY_TASK);

      expect(vi.mocked(db.upsertSessionExternalTask)).toHaveBeenCalledTimes(2);
      expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([
        { ...LINEAR_TASK, sessionId: SESSION_ID },
        { ...SENTRY_TASK, sessionId: SESSION_ID },
      ]);
    });

    it('stamps the branch the session is on when an issue is linked', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      store.setState({ sessionBranches: { [SESSION_ID]: 'ak/fix-auth' } });

      await store.getState().linkSessionExternalTask(SESSION_ID, LINEAR_TASK);

      const linkedTask = { ...LINEAR_TASK, sessionId: SESSION_ID, branch: 'ak/fix-auth' };
      expect(vi.mocked(db.upsertSessionExternalTask)).toHaveBeenCalledWith({
        db: expect.anything(),
        task: linkedTask,
      });
      expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([linkedTask]);
    });

    it('attributes a linked task to the active composite mount', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      const memberWorkspaceId = WS_ID_2;
      store.setState({
        sessions: [buildSession()],
        workspaces: [
          buildWorkspace({
            kind: 'composite',
            members: [
              { workspaceId: memberWorkspaceId, rootPath: '/tmp/member', mountName: 'member' },
              {
                workspaceId: 'workspace-3' as WorkspaceId,
                rootPath: '/tmp/other',
                mountName: 'other',
              },
            ],
          }),
        ],
        sessionMounts: {
          [SESSION_ID]: [
            {
              workspaceId: memberWorkspaceId,
              mountName: 'member',
              worktreePath: '/tmp/member-worktree',
              repoRoot: '/tmp/member',
              branch: 'ak/member',
            },
          ],
        },
        sessionActiveMount: { [SESSION_ID]: memberWorkspaceId },
      });

      await store.getState().linkSessionExternalTask(SESSION_ID, LINEAR_TASK);

      const linkedTask = {
        ...LINEAR_TASK,
        sessionId: SESSION_ID,
        mountWorkspaceId: memberWorkspaceId,
        branch: 'ak/member',
      };
      expect(vi.mocked(db.upsertSessionExternalTask)).toHaveBeenCalledWith({
        db: expect.anything(),
        task: linkedTask,
      });
      expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([linkedTask]);
    });

    it('persists a composite-key unlink and keeps the other tasks', async () => {
      const store = await getStore();
      const db = await import('@goodboy/db');
      store.setState({
        sessionExternalTasks: {
          [SESSION_ID]: [
            { ...LINEAR_TASK, sessionId: SESSION_ID },
            { ...SENTRY_TASK, sessionId: SESSION_ID },
          ],
        },
      });

      await store
        .getState()
        .unlinkSessionExternalTask(SESSION_ID, LINEAR_TASK.provider, LINEAR_TASK.externalId);

      expect(vi.mocked(db.deleteSessionExternalTask)).toHaveBeenCalledWith({
        db: expect.anything(),
        sessionId: SESSION_ID,
        provider: 'linear',
        externalId: 'linear-42',
      });
      expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([
        { ...SENTRY_TASK, sessionId: SESSION_ID },
      ]);
    });
  });

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

    it('setAgentConfig syncs provider and model pins used by turn routing', async () => {
      const store = await getStore();
      const agent = buildAgent({ id: AGENT_ID });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      await store.getState().setAgentConfig(SESSION_ID, AGENT_ID, {
        providerOverride: 'cursor',
        modelOverride: 'cursor-auto',
      });
      expect(store.getState().agentProviderOverride[AGENT_ID]).toBe('cursor');
      expect(store.getState().agentModelOverride[AGENT_ID]).toBe('cursor-auto');
      await store.getState().setAgentConfig(SESSION_ID, AGENT_ID, {
        providerOverride: null,
        modelOverride: null,
      });
      expect(store.getState().agentProviderOverride[AGENT_ID]).toBeUndefined();
      expect(store.getState().agentModelOverride[AGENT_ID]).toBeUndefined();
    });

    it('setAgentConfig syncs the effort used by turn routing', async () => {
      const store = await getStore();
      const agent = buildAgent({ id: AGENT_ID });
      store.setState({ sessionPhaseRuns: { [SESSION_ID]: [agent] } });
      await store.getState().setAgentConfig(SESSION_ID, AGENT_ID, { effort: 'high' });
      expect(store.getState().agentEffortOverride[AGENT_ID]).toBe('high');
      await store.getState().setAgentConfig(SESSION_ID, AGENT_ID, { effort: null });
      expect(store.getState().agentEffortOverride[AGENT_ID]).toBeUndefined();
    });
  });
});
