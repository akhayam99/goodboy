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
const getWorkspaceIntegrationSpy = vi.fn(async () => null as WorkspaceIntegration | null);
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
  getWorkspaceIntegration: getWorkspaceIntegrationSpy,
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
const removeWorktreeSpy = vi.fn(async () => undefined);
const changeWorktreeBranchSpy = vi.fn(async () => undefined);

vi.mock('../../../features/worktree/worktree', () => ({
  createWorktree: createWorktreeSpy,
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

const sentryConnectSpy = vi.fn();
const sentryDisconnectSpy = vi.fn(async () => undefined);

vi.mock('../../../features/integrations/sentry/client', () => ({
  sentryConnect: sentryConnectSpy,
  sentryDisconnect: sentryDisconnectSpy,
}));

const gitlabConnectSpy = vi.fn();
const gitlabDisconnectSpy = vi.fn(async () => undefined);

vi.mock('../../../features/integrations/gitlab/client', () => ({
  gitlabConnect: gitlabConnectSpy,
  gitlabDisconnect: gitlabDisconnectSpy,
  gitlabFetchAssignedIssues: vi.fn(async () => []),
  issueIdentifier: vi.fn(),
}));

const jiraValidateConnectionSpy = vi.fn();
const jiraDisconnectSpy = vi.fn(async () => undefined);

vi.mock('../../../features/integrations/jira/client', () => ({
  jiraValidateConnection: jiraValidateConnectionSpy,
  jiraDisconnect: jiraDisconnectSpy,
  jiraListIssues: vi.fn(async () => []),
}));

const slackValidateConnectionSpy = vi.fn();
const slackConnectSpy = vi.fn(async () => undefined);
const slackDisconnectSpy = vi.fn(async () => undefined);

vi.mock('../../../features/integrations/slack/client', () => ({
  slackValidateConnection: slackValidateConnectionSpy,
  slackConnect: slackConnectSpy,
  slackDisconnect: slackDisconnectSpy,
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
    getWorkspaceIntegrationSpy.mockResolvedValue(null);
    listDiffCommentsSpy.mockResolvedValue([]);
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

    it('connectSentry upserts a sentry row, derives config, and caches it', async () => {
      const store = await getStore();
      sentryConnectSpy.mockResolvedValueOnce({
        slug: 'desktop',
        name: 'Desktop',
        organization: { slug: 'goodboy', name: 'Goodboy' },
      });
      const out = await store.getState().connectSentry(WS_ID, 'tok', 'goodboy', 'desktop');
      expect(out.slug).toBe('desktop');
      expect(sentryConnectSpy).toHaveBeenCalledWith(WS_ID, 'tok', 'goodboy', 'desktop');
      expect(upsertWorkspaceIntegrationSpy).toHaveBeenCalledTimes(1);
      const cached = store.getState().workspaceIntegrations[WS_ID];
      const sentry = cached?.find((i) => i.provider === 'sentry');
      expect(sentry).toBeDefined();
      expect(sentry?.credentialKey).toBe(`goodboy.workspace.${WS_ID}.sentry`);
      expect(sentry?.config).toEqual({
        org: 'goodboy',
        project: 'desktop',
        projectName: 'Desktop',
        orgName: 'Goodboy',
      });
    });

    it('connectSentry reuses an existing row id and createdAt on reconnect', async () => {
      const store = await getStore();
      const existing: WorkspaceIntegration = {
        id: 'sentry-old' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'sentry',
        config: { org: 'goodboy', project: 'old', projectName: 'Old' },
        credentialKey: `goodboy.workspace.${WS_ID}.sentry`,
        createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      };
      store.setState({ workspaceIntegrations: { [WS_ID]: [existing] } });
      sentryConnectSpy.mockResolvedValueOnce({
        slug: 'new',
        name: 'New',
        organization: { slug: 'goodboy', name: 'Goodboy' },
      });
      await store.getState().connectSentry(WS_ID, 'tok', 'goodboy', 'new');
      const cached = store.getState().workspaceIntegrations[WS_ID] ?? [];
      const sentryRows = cached.filter((i) => i.provider === 'sentry');
      expect(sentryRows).toHaveLength(1);
      expect(sentryRows[0]?.id).toBe('sentry-old');
      expect(sentryRows[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect((sentryRows[0]?.config as { project: string }).project).toBe('new');
    });

    it('connectSentry preserves a coexisting linear row', async () => {
      const store = await getStore();
      const linear: WorkspaceIntegration = {
        id: 'lin-1' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'linear',
        config: { workspaceUrlKey: 'k', viewerUserId: 'u', viewerName: 'n' },
        credentialKey: 'k',
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({ workspaceIntegrations: { [WS_ID]: [linear] } });
      sentryConnectSpy.mockResolvedValueOnce({
        slug: 'desktop',
        name: 'Desktop',
        organization: { slug: 'goodboy', name: 'Goodboy' },
      });
      await store.getState().connectSentry(WS_ID, 'tok', 'goodboy', 'desktop');
      const providers = (store.getState().workspaceIntegrations[WS_ID] ?? [])
        .map((i) => i.provider)
        .sort();
      expect(providers).toEqual(['linear', 'sentry']);
    });

    it('connectSentry propagates a backend error and leaves cache untouched', async () => {
      const store = await getStore();
      sentryConnectSpy.mockRejectedValueOnce(new Error('invalid token'));
      await expect(
        store.getState().connectSentry(WS_ID, 'bad', 'goodboy', 'desktop'),
      ).rejects.toThrow('invalid token');
      expect(upsertWorkspaceIntegrationSpy).not.toHaveBeenCalled();
      expect(store.getState().workspaceIntegrations[WS_ID]).toBeUndefined();
    });

    it('disconnectSentry calls backend + db and removes only the sentry row', async () => {
      const store = await getStore();
      const linear: WorkspaceIntegration = {
        id: 'lin-1' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'linear',
        config: { workspaceUrlKey: 'k', viewerUserId: 'u', viewerName: 'n' },
        credentialKey: 'k',
        createdAt: NOW,
        updatedAt: NOW,
      };
      const sentry: WorkspaceIntegration = {
        id: 'sentry-1' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'sentry',
        config: { org: 'goodboy', project: 'desktop' },
        credentialKey: `goodboy.workspace.${WS_ID}.sentry`,
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({ workspaceIntegrations: { [WS_ID]: [linear, sentry] } });
      await store.getState().disconnectSentry(WS_ID);
      expect(sentryDisconnectSpy).toHaveBeenCalledWith(WS_ID);
      expect(deleteWorkspaceIntegrationSpy).toHaveBeenCalledWith(
        expect.anything(),
        WS_ID,
        'sentry',
      );
      expect(store.getState().workspaceIntegrations[WS_ID]).toEqual([linear]);
    });

    it('connectGitlab upserts a row carrying host + user config and caches it', async () => {
      const store = await getStore();
      gitlabConnectSpy.mockResolvedValueOnce({ id: 99, username: 'amin', name: 'Amin K' });
      const out = await store.getState().connectGitlab(WS_ID, 'https://gitlab.example.com', 'tok');
      expect(out.id).toBe(99);
      expect(gitlabConnectSpy).toHaveBeenCalledWith(WS_ID, 'https://gitlab.example.com', 'tok');
      expect(upsertWorkspaceIntegrationSpy).toHaveBeenCalledTimes(1);
      const cached = store
        .getState()
        .workspaceIntegrations[WS_ID]?.find((i) => i.provider === 'gitlab');
      expect(cached?.config).toEqual({
        userName: 'Amin K',
        userId: '99',
        host: 'https://gitlab.example.com',
      });
      expect(cached?.credentialKey).toBe(`goodboy.workspace.${WS_ID}.gitlab`);
    });

    it('connectGitlab preserves id + createdAt and refreshes host on reconnect', async () => {
      const store = await getStore();
      const existing: WorkspaceIntegration = {
        id: 'gl-keep' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'gitlab',
        config: { userName: 'old', userId: '1', host: 'https://gitlab.com' },
        credentialKey: `goodboy.workspace.${WS_ID}.gitlab`,
        createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      };
      store.setState({ workspaceIntegrations: { [WS_ID]: [existing] } });
      gitlabConnectSpy.mockResolvedValueOnce({ id: 2, username: 'amin', name: 'Amin K' });
      await store.getState().connectGitlab(WS_ID, 'https://self.hosted', 'tok2');
      const rows = store.getState().workspaceIntegrations[WS_ID] ?? [];
      const gitlab = rows.filter((i) => i.provider === 'gitlab');
      expect(gitlab).toHaveLength(1);
      expect(gitlab[0]?.id).toBe('gl-keep');
      expect(gitlab[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(gitlab[0]?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
      expect((gitlab[0]?.config as { host: string }).host).toBe('https://self.hosted');
    });

    it('disconnectGitlab removes only the gitlab row, leaving other providers intact', async () => {
      const store = await getStore();
      const linear: WorkspaceIntegration = {
        id: 'li-1' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'linear',
        config: { workspaceUrlKey: 'k', viewerUserId: 'u', viewerName: 'n' },
        credentialKey: 'k',
        createdAt: NOW,
        updatedAt: NOW,
      };
      const gitlab: WorkspaceIntegration = {
        id: 'gl-1' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'gitlab',
        config: { userName: 'a', userId: '1', host: 'https://gitlab.com' },
        credentialKey: 'g',
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({ workspaceIntegrations: { [WS_ID]: [linear, gitlab] } });
      await store.getState().disconnectGitlab(WS_ID);
      expect(gitlabDisconnectSpy).toHaveBeenCalledWith(WS_ID);
      expect(deleteWorkspaceIntegrationSpy).toHaveBeenCalledWith(
        expect.anything(),
        WS_ID,
        'gitlab',
      );
      const remaining = store.getState().workspaceIntegrations[WS_ID] ?? [];
      expect(remaining.map((i) => i.provider)).toEqual(['linear']);
    });

    it('connectJira caches the site, project and account details it validated', async () => {
      const store = await getStore();
      jiraValidateConnectionSpy.mockResolvedValueOnce({
        accountId: 'acc-7',
        displayName: 'Grace Hopper',
      });
      const out = await store.getState().connectJira({
        workspaceId: WS_ID,
        siteUrl: 'https://acme.atlassian.net',
        email: 'grace@acme.com',
        projectKey: 'ENG',
        apiToken: 'ATATT-x',
      });
      expect(out.accountId).toBe('acc-7');
      const cached = store
        .getState()
        .workspaceIntegrations[WS_ID]?.find((i) => i.provider === 'jira');
      expect(cached?.config).toEqual({
        accountId: 'acc-7',
        displayName: 'Grace Hopper',
        siteUrl: 'https://acme.atlassian.net',
        email: 'grace@acme.com',
        projectKey: 'ENG',
      });
      expect(cached?.credentialKey).toBe(`goodboy.workspace.${WS_ID}.jira`);
    });

    it('connectJira keeps the row identity and refreshes the project on reconnect', async () => {
      const store = await getStore();
      const existing: WorkspaceIntegration = {
        id: 'ji-keep' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'jira',
        config: {
          siteUrl: 'https://acme.atlassian.net',
          email: 'grace@acme.com',
          projectKey: 'OLD',
        },
        credentialKey: `goodboy.workspace.${WS_ID}.jira`,
        createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      };
      store.setState({ workspaceIntegrations: { [WS_ID]: [existing] } });
      jiraValidateConnectionSpy.mockResolvedValueOnce({
        accountId: 'acc-7',
        displayName: 'Grace Hopper',
      });
      await store.getState().connectJira({
        workspaceId: WS_ID,
        siteUrl: 'https://acme.atlassian.net',
        email: 'grace@acme.com',
        projectKey: 'ENG',
        apiToken: 'ATATT-x',
      });
      const rows = (store.getState().workspaceIntegrations[WS_ID] ?? []).filter(
        (i) => i.provider === 'jira',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe('ji-keep');
      expect(rows[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect((rows[0]?.config as { projectKey: string }).projectKey).toBe('ENG');
    });

    it('disconnectJira drops the cached token and only the jira row', async () => {
      const store = await getStore();
      const linear: WorkspaceIntegration = {
        id: 'li-2' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'linear',
        config: { workspaceUrlKey: 'k', viewerUserId: 'u', viewerName: 'n' },
        credentialKey: 'k',
        createdAt: NOW,
        updatedAt: NOW,
      };
      const jira: WorkspaceIntegration = {
        id: 'ji-1' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'jira',
        config: {
          siteUrl: 'https://acme.atlassian.net',
          email: 'grace@acme.com',
          projectKey: 'ENG',
        },
        credentialKey: 'j',
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({ workspaceIntegrations: { [WS_ID]: [linear, jira] } });
      await store.getState().disconnectJira({ workspaceId: WS_ID });
      expect(jiraDisconnectSpy).toHaveBeenCalledWith({ workspaceId: WS_ID });
      expect(deleteWorkspaceIntegrationSpy).toHaveBeenCalledWith(expect.anything(), WS_ID, 'jira');
      const remaining = store.getState().workspaceIntegrations[WS_ID] ?? [];
      expect(remaining.map((i) => i.provider)).toEqual(['linear']);
    });

    it('connectSlack probes the token, stores it, then caches the team it answered with', async () => {
      const store = await getStore();
      slackValidateConnectionSpy.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });

      const out = await store
        .getState()
        .connectSlack({ workspaceId: WS_ID, botToken: ' xoxb-secret ' });

      expect(out.teamId).toBe('T01');
      expect(slackValidateConnectionSpy).toHaveBeenCalledWith({ botToken: ' xoxb-secret ' });
      expect(slackConnectSpy).toHaveBeenCalledWith({
        workspaceId: WS_ID,
        botToken: ' xoxb-secret ',
      });
      const cached = store
        .getState()
        .workspaceIntegrations[WS_ID]?.find((i) => i.provider === 'slack');
      expect(cached?.config).toEqual({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });
      expect(cached?.credentialKey).toBe(`goodboy.workspace.${WS_ID}.slack`);
    });

    it('connectSlack writes the database row before the keychain, so a failure between them never orphans a live token', async () => {
      const store = await getStore();
      slackValidateConnectionSpy.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });

      await store.getState().connectSlack({ workspaceId: WS_ID, botToken: 'xoxb-secret' });

      const dbCallOrder = upsertWorkspaceIntegrationSpy.mock.invocationCallOrder[0];
      const keychainCallOrder = slackConnectSpy.mock.invocationCallOrder[0];
      expect(dbCallOrder).toBeDefined();
      expect(keychainCallOrder).toBeDefined();
      expect(dbCallOrder as number).toBeLessThan(keychainCallOrder as number);
    });

    it('connectSlack rolls back the freshly written database row when the keychain write fails', async () => {
      const store = await getStore();
      slackValidateConnectionSpy.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });
      slackConnectSpy.mockRejectedValueOnce(new Error('keychain unavailable'));

      await expect(
        store.getState().connectSlack({ workspaceId: WS_ID, botToken: 'xoxb-secret' }),
      ).rejects.toThrow(/keychain unavailable/);

      expect(upsertWorkspaceIntegrationSpy).toHaveBeenCalledTimes(1);
      expect(deleteWorkspaceIntegrationSpy).toHaveBeenCalledWith(expect.anything(), WS_ID, 'slack');
      expect(store.getState().workspaceIntegrations[WS_ID] ?? []).toEqual([]);
    });

    it('connectSlack restores the database row when the in-memory store is stale', async () => {
      const store = await getStore();
      const existing: WorkspaceIntegration = {
        id: 'sl-db-existing' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'slack',
        config: { teamId: 'T00', teamName: 'Old', botUserId: 'U00' },
        credentialKey: `goodboy.workspace.${WS_ID}.slack`,
        createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      };
      getWorkspaceIntegrationSpy.mockResolvedValueOnce(existing);
      slackValidateConnectionSpy.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'NewTeam',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });
      slackConnectSpy.mockRejectedValueOnce(new Error('keychain unavailable'));

      await expect(
        store.getState().connectSlack({ workspaceId: WS_ID, botToken: 'xoxb-new' }),
      ).rejects.toThrow(/keychain unavailable/);

      expect(deleteWorkspaceIntegrationSpy).not.toHaveBeenCalled();
      expect(upsertWorkspaceIntegrationSpy).toHaveBeenLastCalledWith(expect.anything(), existing);
    });

    it('connectSlack preserves the keychain error when database rollback fails', async () => {
      const store = await getStore();
      slackValidateConnectionSpy.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });
      slackConnectSpy.mockRejectedValueOnce(new Error('keychain unavailable'));
      deleteWorkspaceIntegrationSpy.mockRejectedValueOnce(new Error('rollback failed'));

      await expect(
        store.getState().connectSlack({ workspaceId: WS_ID, botToken: 'xoxb-secret' }),
      ).rejects.toThrow(/keychain unavailable/);
    });

    it('connectSlack restores the prior row when a reconnect fails the keychain write', async () => {
      const store = await getStore();
      const existing: WorkspaceIntegration = {
        id: 'sl-keep' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'slack',
        config: { teamId: 'T00', teamName: 'Old', botUserId: 'U00' },
        credentialKey: `goodboy.workspace.${WS_ID}.slack`,
        createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      };
      getWorkspaceIntegrationSpy.mockResolvedValueOnce(existing);
      store.setState({ workspaceIntegrations: { [WS_ID]: [existing] } });
      slackValidateConnectionSpy.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'NewTeam',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });
      slackConnectSpy.mockRejectedValueOnce(new Error('keychain unavailable'));

      await expect(
        store.getState().connectSlack({ workspaceId: WS_ID, botToken: 'xoxb-new' }),
      ).rejects.toThrow(/keychain unavailable/);

      expect(upsertWorkspaceIntegrationSpy).toHaveBeenLastCalledWith(expect.anything(), existing);
      expect(deleteWorkspaceIntegrationSpy).not.toHaveBeenCalled();
      const stillSlack = store
        .getState()
        .workspaceIntegrations[WS_ID]?.find((i) => i.provider === 'slack');
      expect(stillSlack?.config).toEqual({ teamId: 'T00', teamName: 'Old', botUserId: 'U00' });
    });

    it('connectSlack never stores a token the probe rejected', async () => {
      const store = await getStore();
      slackValidateConnectionSpy.mockRejectedValueOnce(new Error('invalid_auth'));

      await expect(
        store.getState().connectSlack({ workspaceId: WS_ID, botToken: 'xoxb-bad' }),
      ).rejects.toThrow(/invalid_auth/);

      expect(slackConnectSpy).not.toHaveBeenCalled();
      expect(upsertWorkspaceIntegrationSpy).not.toHaveBeenCalled();
      expect(store.getState().workspaceIntegrations[WS_ID] ?? []).toEqual([]);
    });

    it('connectSlack keeps the row identity when the same workspace reconnects', async () => {
      const store = await getStore();
      const existing: WorkspaceIntegration = {
        id: 'sl-keep' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'slack',
        config: { teamId: 'T00', teamName: 'Old', botUserId: 'U00' },
        credentialKey: `goodboy.workspace.${WS_ID}.slack`,
        createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
      };
      getWorkspaceIntegrationSpy.mockResolvedValueOnce(existing);
      store.setState({ workspaceIntegrations: { [WS_ID]: [existing] } });
      slackValidateConnectionSpy.mockResolvedValueOnce({
        teamId: 'T01',
        teamName: 'Acme',
        botUserId: 'U09',
        botUserName: 'goodboy',
      });

      await store.getState().connectSlack({ workspaceId: WS_ID, botToken: 'xoxb-secret' });

      const rows = (store.getState().workspaceIntegrations[WS_ID] ?? []).filter(
        (i) => i.provider === 'slack',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe('sl-keep');
      expect(rows[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect((rows[0]?.config as { teamName: string }).teamName).toBe('Acme');
    });

    it('disconnectSlack drops the cached token and only the slack row', async () => {
      const store = await getStore();
      const linear: WorkspaceIntegration = {
        id: 'li-3' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'linear',
        config: { workspaceUrlKey: 'k', viewerUserId: 'u', viewerName: 'n' },
        credentialKey: 'k',
        createdAt: NOW,
        updatedAt: NOW,
      };
      const slack: WorkspaceIntegration = {
        id: 'sl-1' as WorkspaceIntegrationId,
        workspaceId: WS_ID,
        provider: 'slack',
        config: { teamId: 'T01', teamName: 'Acme', botUserId: 'U09' },
        credentialKey: 's',
        createdAt: NOW,
        updatedAt: NOW,
      };
      store.setState({ workspaceIntegrations: { [WS_ID]: [linear, slack] } });

      await store.getState().disconnectSlack({ workspaceId: WS_ID });

      expect(slackDisconnectSpy).toHaveBeenCalledWith({ workspaceId: WS_ID });
      expect(deleteWorkspaceIntegrationSpy).toHaveBeenCalledWith(expect.anything(), WS_ID, 'slack');
      const remaining = store.getState().workspaceIntegrations[WS_ID] ?? [];
      expect(remaining.map((i) => i.provider)).toEqual(['linear']);
    });

    it('disconnectGithub clears the workspace-scoped keychain token only', async () => {
      const store = await getStore();

      await store.getState().disconnectGithub({ workspaceId: WS_ID });

      expect(ghClearTokenSpy).toHaveBeenCalledWith(WS_ID);
      expect(deleteWorkspaceIntegrationSpy).not.toHaveBeenCalled();
    });
  });
});
