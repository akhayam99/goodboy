import { vi } from 'vitest';
import { createResolveQueryMocks } from './slices/resolve/testing/createResolveQueryMocks';
import { resetWorkflowTurnBreaker } from './slices/turn/workflowTurnBreaker';
import type { Notification } from '@goodboy/db';
import type {
  Agent,
  AgentId,
  BudgetAlert,
  BudgetRule,
  DiffComment,
  GhTokenStatus,
  IntegrationBinding,
  IntegrationCredential,
  IsoDateTime,
  OverrideSettings,
  PlanConsumption,
  PlanWithCount,
  Project,
  ProjectId,
  ProjectScript,
  ProjectScriptId,
  PullRequestState,
  Session,
  SessionId,
  Skill,
  TurnEvent,
  Workflow,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';

export const STORY_NOW = '2026-08-22T00:00:00.000Z' as IsoDateTime;

export const STORE_IMPORT_TIMEOUT_MS = 60_000;

export const importStoreModule = () => import('./store');

export type StoryStoreModule = Awaited<ReturnType<typeof importStoreModule>>;

export const importStore = async () => (await importStoreModule()).useAppStore;

export type StoryStore = Awaited<ReturnType<typeof importStore>>;

const getSetting: ReturnType<typeof vi.fn> = vi.fn<() => Promise<string | null>>(async () => null);
const countNotifications: ReturnType<typeof vi.fn> = vi.fn(async () => []);
const invokeBudgetRuleUpsert: ReturnType<typeof vi.fn> = vi.fn(async () => undefined);
const invokeSessionBudgetGet: ReturnType<typeof vi.fn> = vi.fn(async () => null);
const ghStatus: ReturnType<typeof vi.fn> = vi.fn<() => Promise<GhTokenStatus>>(async () => ({
  available: true,
  mode: 'gh-cli',
  scopes: [],
}));
const invokeScriptRun: ReturnType<typeof vi.fn> = vi.fn(async () => undefined);
const runAdhocScript: ReturnType<typeof vi.fn> = vi.fn(async () => 'run-adhoc');

const cleanWorkingTree = {
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0 },
} as never;

export const storySpies = {
  getSetting,
  setSetting: vi.fn(async () => undefined),
  listWorkspaces: vi.fn(async () => [] as ReadonlyArray<Workspace>),
  listProviderCredentials: vi.fn(async () => []),
  updateSessionState: vi.fn(async () => undefined),
  deleteFileVersionsForSession: vi.fn(async () => undefined),
  updateSessionMountLifecycle: vi.fn(async () => true),
  insertNotification: vi.fn(async () => undefined),
  listNotifications: vi.fn(async () => [] as ReadonlyArray<Notification>),
  countNotifications,
  markNotificationRead: vi.fn(async () => undefined),
  markAllNotificationsRead: vi.fn(async () => undefined),
  deleteNotification: vi.fn(async () => undefined),
  clearAllNotifications: vi.fn(async () => undefined),
  insertNudgeEvent: vi.fn(async () => undefined),
  updateNudgeEventOutcome: vi.fn(async () => undefined),
  insertDiffComment: vi.fn(async () => undefined),
  listDiffCommentsForSession: vi.fn(async () => [] as ReadonlyArray<DiffComment>),
  resolveDiffComment: vi.fn(async () => undefined),
  reopenDiffComment: vi.fn(async () => undefined),
  consumeDiffComments: vi.fn(async () => undefined),
  deleteDiffComment: vi.fn(async () => undefined),
  upsertIntegrationBinding: vi.fn(async () => undefined),
  listIntegrationBindingsForWorkspace: vi.fn(async () => [] as ReadonlyArray<IntegrationBinding>),
  getIntegrationBinding: vi.fn(async () => null as IntegrationBinding | null),
  deleteIntegrationBinding: vi.fn(async () => undefined),
  deleteIntegrationBindingsForProvider: vi.fn(async () => undefined),
  upsertIntegrationCredential: vi.fn(async () => undefined),
  deleteIntegrationCredential: vi.fn(async () => undefined),
  listIntegrationCredentials: vi.fn(async () => [] as ReadonlyArray<IntegrationCredential>),
  countWorkspacesPerIntegrationCredential: vi.fn(async () => ({}) as Record<string, number>),
  listProjectScripts: vi.fn(async () => [] as ReadonlyArray<ProjectScript>),
  upsertProjectScript: vi.fn(async () => undefined),
  deleteProjectScript: vi.fn(async () => undefined),
  runDbMigrations: vi.fn(async () => undefined),
  restoreMigrationSnapshot: vi.fn(async (_params: { readonly path: string }) => ''),
  listLiveRunIds: vi.fn(async () => new Set<string>()),
  invokeBudgetRuleList: vi.fn(async () => [] as ReadonlyArray<BudgetRule>),
  invokeBudgetRuleUpsert,
  invokeBudgetRuleDelete: vi.fn(async () => undefined),
  invokeBudgetAlertDismiss: vi.fn(async () => undefined),
  invokeSessionBudgetGet,
  invokeSessionBudgetSet: vi.fn(async () => undefined),
  invokeSkillList: vi.fn(async () => [] as ReadonlyArray<Skill>),
  invokeSkillUpsert: vi.fn(async () => undefined),
  invokeSkillDelete: vi.fn(async () => undefined),
  invokeSkillRescan: vi.fn(async () => [] as ReadonlyArray<Skill>),
  invokeWorkflowList: vi.fn(async () => [] as ReadonlyArray<Workflow>),
  invokeWorkflowUpsert: vi.fn(async () => undefined),
  invokeWorkflowDelete: vi.fn(async () => undefined),
  invokeWorkflowsForSession: vi.fn(async () => [] as ReadonlyArray<unknown>),
  invokeAgentInsert: vi.fn(),
  invokeAgentUpdateStatus: vi.fn(),
  invokeAgentSetVerbosity: vi.fn(async () => undefined),
  invokeAgentMarkViewed: vi.fn(async () => undefined),
  invokeAgentSetProviderSessionId: vi.fn(async () => undefined),
  invokeAgentSetDone: vi.fn(async () => undefined),
  invokeWorkspacesWithUnread: vi.fn(async () => [] as ReadonlyArray<WorkspaceId>),
  changeWorktreeBranch: vi.fn(async () => undefined),
  scanOrphanWorktrees: vi.fn(
    async () =>
      [] as ReadonlyArray<{
        path: string;
        name: string;
        isRegistered: boolean;
      }>,
  ),
  removeWorktreeFolder: vi.fn(async ({ path }: { readonly path: string }) => ({
    kind: 'removed' as const,
    path,
  })),
  listPlansForSession: vi.fn(async () => [] as ReadonlyArray<PlanWithCount>),
  upsertPlan: vi.fn(),
  setPlanStatus: vi.fn(async () => undefined),
  setPlanBody: vi.fn(async () => undefined),
  addPlanConsumption: vi.fn(async () => undefined),
  listConsumptionsForPlan: vi.fn(async () => [] as ReadonlyArray<PlanConsumption>),
  linearConnect: vi.fn(),
  linearDisconnect: vi.fn(async () => undefined),
  linearValidateConnection: vi.fn(),
  sentryValidateConnection: vi.fn(),
  sentryConnect: vi.fn(async () => undefined),
  gitlabValidateConnection: vi.fn(),
  gitlabConnect: vi.fn(async () => undefined),
  jiraValidateConnection: vi.fn(),
  jiraConnect: vi.fn(async () => undefined),
  slackValidateConnection: vi.fn(),
  slackConnect: vi.fn(async () => undefined),
  ghStatus,
  ghSetToken: vi.fn(),
  ghClearToken: vi.fn(async () => undefined),
  gitPush: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
  detectRepoSlug: vi.fn(async () => null as string | null),
  listPrsForBranch: vi.fn(async () => [] as ReadonlyArray<PullRequestState>),
  fetchLinkedIssues: vi.fn(async () => []),
  resolveReviewThread: vi.fn(async () => undefined),
  addReviewThreadReply: vi.fn(async () => ({ id: 'reply-id' })),
  invokeScriptRun,
  runAdhocScript,
  scanProjectScripts: vi.fn(
    async () =>
      [] as ReadonlyArray<{
        source: 'package-json' | 'composer';
        packageName: string;
        relDir: string;
        manager: string;
        scripts: ReadonlyArray<{ name: string; command: string }>;
      }>,
  ),
  invokeScriptListLive: vi.fn<
    () => Promise<
      ReadonlyArray<{
        runId: string;
        scriptId: ProjectScriptId;
        sessionId: SessionId;
        startedAt: number;
      }>
    >
  >(async () => {
    await storyInvoke('workspace_script_list_live');
    return [];
  }),
  invokeTerminalListLive: vi.fn<() => Promise<ReadonlyArray<{ id: string; cwd: string }>>>(
    async () => {
      await storyInvoke('terminal_list_live');
      return [];
    },
  ),
  invokeTerminalClose: vi.fn(async () => undefined),
  runTurn: vi.fn(),
  cancelTurn: vi.fn(async (_runId: unknown) => undefined),
  writeAttachment: vi.fn(async () => '.goodboy/attachments/spec.pdf'),
  tauriInvoke: vi.fn(async (_cmd?: unknown, _args?: unknown): Promise<unknown> => null),
  invokeAgentList: vi.fn(async (_sessionId?: unknown) => [] as ReadonlyArray<Agent>),
  invokeBudgetAlertsList: vi.fn(async () => [] as ReadonlyArray<BudgetAlert>),
  createWorktree: vi.fn(),
  createSessionDir: vi.fn(),
  sessionDirExists: vi.fn(async (_args: unknown) => true),
  scratchDirPrepare: vi.fn(async (_args: unknown) => '/tmp/goodboy-root/scratch/session-story'),
  scratchDirRemove: vi.fn(async (_args: unknown) => undefined),
  removeWorktree: vi.fn(async (_repoPath: string, _worktreePath: string) => undefined),
  removeWorktreeChecked: vi.fn(async (_args: { worktreePath: string }) => ({
    kind: 'removed',
    path: _args.worktreePath,
  })),
  worktreeWriterStatus: vi.fn(async (_args: { path: string }) => ({
    path: _args.path,
    holder: null,
    token: null,
    runId: null,
    isGranted: false,
    hasExited: false,
    waiting: [],
  })),
  removeSessionDirectory: vi.fn(async (_args: unknown) => undefined),
  worktreeStatus: vi.fn(async (_path: string) => cleanWorkingTree),
  gitCommonDirectory: vi.fn(
    async (_args: { readonly repoPath: string }): Promise<string | null> => null,
  ),
  worktreeChangedFiles: vi.fn(async (_path: string) => ({ files: [], numstat: '' })),
  insertSession: vi.fn(async () => undefined),
  insertSessionEvent: vi.fn(
    async (_params: { readonly event: { readonly kind: string } }) => undefined,
  ),
  insertSessionWorktree: vi.fn(async () => undefined),
  deleteSessionMount: vi.fn(async (_args: { readonly mountId: string }) => true),
  listSessionMounts: vi.fn(async () => [] as ReadonlyArray<Record<string, unknown>>),
  inspectWorktree: vi.fn(async ({ worktreePath }: { readonly worktreePath: string }) => ({
    kind: 'registered' as string,
    path: worktreePath,
    isMain: false,
    isLocked: false,
    lockReason: null as string | null,
  })),
  updateSessionWorktreeBranch: vi.fn(async () => undefined),
  updateSessionActiveProject: vi.fn(async () => undefined),
  updateSessionWriteDestination: vi.fn(async () => true),
  listWorktreesForSession: vi.fn(async () => [] as ReadonlyArray<never>),
  getWorkspaceById: vi.fn(async (): Promise<Workspace | null> => null),
  listProjectsForWorkspace: vi.fn(async () => [] as ReadonlyArray<Project>),
  upsertSessionExternalTask: vi.fn(async () => undefined),
  upsertContextSlot: vi.fn(async () => undefined),
  deleteSession: vi.fn(async () => undefined),
  acquireWorktreeWriter: vi.fn(async ({ path }: { readonly path: string }) =>
    freeWriterLease({ path }),
  ),
  releaseWorktreeWriter: vi.fn(async ({ path }: { readonly path: string }) =>
    freeWriterLease({ path }),
  ),
  cancelWorktreeWriter: vi.fn(async ({ path }: { readonly path: string }) =>
    freeWriterLease({ path }),
  ),
  abandonWorktreeWriter: vi.fn(async ({ path }: { readonly path: string }) =>
    freeWriterLease({ path }),
  ),
  listActiveResolveAttempts: vi.fn(async () => [] as ReadonlyArray<never>),
};

export const storyResolveQueries = createResolveQueryMocks();

const storyInvoke = (command: string) => storySpies.tauriInvoke(command);

const freeWriterLease = ({ path }: { readonly path: string }) => ({
  path,
  holder: null,
  token: null,
  runId: null,
  isGranted: false,
  hasExited: false,
  waiting: [],
});

export const resetStorySpies = () => {
  resetWorkflowTurnBreaker();
  for (const spy of Object.values(storySpies)) {
    spy.mockReset();
  }
  storyResolveQueries.resetResolveQueryMocks();
  for (const [name, value] of Object.entries(storyResolveQueries)) {
    if (name !== 'resetResolveQueryMocks') {
      (value as { readonly mockClear: () => void }).mockClear();
    }
  }
  for (const spy of [
    storySpies.acquireWorktreeWriter,
    storySpies.releaseWorktreeWriter,
    storySpies.cancelWorktreeWriter,
    storySpies.abandonWorktreeWriter,
  ]) {
    spy.mockImplementation(async ({ path }: { readonly path: string }) =>
      freeWriterLease({ path }),
    );
  }
  storySpies.listActiveResolveAttempts.mockImplementation(async () => []);
  storySpies.createWorktree.mockImplementation(async () => ({
    worktreePath: '/tmp/app/.goodboy/worktrees/goal-12345678',
    branchName: 'goodboy/goal-12345678',
    slug: 'goal-12345678',
    reused: false,
  }));
  storySpies.createSessionDir.mockImplementation(async () => ({
    worktreePath: '/tmp/app/sessions/goal-12345678',
    branchName: '',
    slug: 'goal-12345678',
    reused: false,
  }));
  storySpies.removeWorktreeChecked.mockImplementation(
    async ({ worktreePath }: { worktreePath: string }) => ({
      kind: 'removed',
      path: worktreePath,
    }),
  );
  storySpies.worktreeWriterStatus.mockImplementation(async ({ path }: { path: string }) =>
    freeWriterLease({ path }),
  );
  storySpies.gitCommonDirectory.mockImplementation(
    async ({ repoPath }: { readonly repoPath: string }) => `${repoPath}/.git`,
  );
  storySpies.deleteSessionMount.mockImplementation(async () => true);
  storySpies.listSessionMounts.mockImplementation(async () => []);
  storySpies.inspectWorktree.mockImplementation(
    async ({ worktreePath }: { readonly worktreePath: string }) => ({
      kind: 'registered',
      path: worktreePath,
      isMain: false,
      isLocked: false,
      lockReason: null,
    }),
  );
};

export const resetStoryStore = async () => {
  const { initialState, useAppStore } = await importStoreModule();
  resetStorySpies();
  useAppStore.setState(initialState);
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.clear();
  }
};

export const dbModuleMock = () => ({
  ...storyResolveQueries,
  listActiveResolveAttempts: storySpies.listActiveResolveAttempts,
  getSetting: storySpies.getSetting,
  setSetting: storySpies.setSetting,
  getWorkspaceById: storySpies.getWorkspaceById,
  listWorkspaces: storySpies.listWorkspaces,
  listProjectsForWorkspace: storySpies.listProjectsForWorkspace,
  listProviderCredentials: storySpies.listProviderCredentials,
  findProjectByRootPath: vi.fn(async () => null),
  getProjectById: vi.fn(async () => null),
  insertProject: vi.fn(async () => undefined),
  reconnectProject: vi.fn(async () => undefined),
  describeProjectAdoption: vi.fn(async () => null),
  moveProjectToWorkspace: vi.fn(async () => ({
    movedSessionCount: 0,
    ambiguousSessionCount: 0,
  })),
  mergeWorkspaces: vi.fn(async () => undefined),
  insertWorkspace: vi.fn(async () => undefined),
  disconnectWorkspace: vi.fn(async () => undefined),
  reconnectWorkspace: vi.fn(async () => undefined),
  touchWorkspaceLastAccessed: vi.fn(async () => undefined),
  findWorkspaceByRootPath: vi.fn(async () => null),
  insertMessage: vi.fn(async () => undefined),
  insertProviderRun: vi.fn(async () => undefined),
  updateProviderRunStatus: vi.fn(async () => undefined),
  insertTelemetry: vi.fn(async () => undefined),
  insertSession: storySpies.insertSession,
  insertSessionWorktree: storySpies.insertSessionWorktree,
  insertSessionEvent: storySpies.insertSessionEvent,
  renameSession: vi.fn(async () => undefined),
  deleteSession: storySpies.deleteSession,
  purgeSessionForDelete: vi.fn(async () => undefined),
  archiveSession: vi.fn(async () => undefined),
  unarchiveSession: vi.fn(async () => undefined),
  updateSessionConfig: vi.fn(async () => undefined),
  updateAgentConfig: vi.fn(async () => undefined),
  updateSessionPermissionMode: vi.fn(async () => undefined),
  updateSessionAutoRun: vi.fn(async () => undefined),
  updateSessionTitleUserEdited: vi.fn(async () => undefined),
  updateSessionState: storySpies.updateSessionState,
  updateSessionActiveProject: storySpies.updateSessionActiveProject,
  updateSessionWriteDestination: storySpies.updateSessionWriteDestination,
  listSessionsForWorkspace: vi.fn(async () => []),
  listArchivedSessionsForWorkspace: vi.fn(async () => []),
  listGoalAttachmentsForSession: vi.fn(async () => []),
  deleteFileVersionsForSession: storySpies.deleteFileVersionsForSession,
  getSessionMount: vi.fn(async () => null),
  deleteSessionMount: storySpies.deleteSessionMount,
  updateSessionMountLifecycle: storySpies.updateSessionMountLifecycle,
  detachSessionMounts: vi.fn(async () => undefined),
  listSessionMounts: storySpies.listSessionMounts,
  listMountOperations: vi.fn(async () => []),
  getMountOperation: vi.fn(async () => null),
  upsertMountOperation: vi.fn(async () => undefined),
  listUnsettledMountOperations: vi.fn(async () => []),
  listMountPathOwnership: vi.fn(async () => []),
  listMountPullRequestLinks: vi.fn(async () => []),
  upsertMountPullRequestLink: vi.fn(async () => true),
  listWorktreesForTask: vi.fn(async () => []),
  listWorktreesForSession: storySpies.listWorktreesForSession,
  listWorktreesForSessions: vi.fn(async () => new Map()),
  listAllSessionWorktrees: vi.fn(async () => []),
  deleteWorktreesForSession: vi.fn(async () => undefined),
  updateSessionWorktreeBranch: storySpies.updateSessionWorktreeBranch,
  updateSessionWorktreeRepoSlug: vi.fn(async () => undefined),
  listAllRetainedWorktreePaths: vi.fn(async () => []),
  deleteRetainedWorktreePath: vi.fn(async () => undefined),
  markRetainedWorktreePathChecked: vi.fn(async () => undefined),
  listWorktreeLedger: vi.fn(async () => []),
  recordOrphanWorktrees: vi.fn(async () => undefined),
  deleteWorktreeLedgerEntries: vi.fn(async () => undefined),
  setWorktreeLedgerSize: vi.fn(async () => undefined),
  setWorktreeLedgerKeep: vi.fn(async () => undefined),
  listWorktreeRoots: vi.fn(async () => []),
  registerWorktreeRoot: vi.fn(async () => undefined),
  markWorktreeRootScanned: vi.fn(async () => undefined),
  upsertSessionExternalTask: storySpies.upsertSessionExternalTask,
  deleteSessionExternalTask: vi.fn(async () => undefined),
  listExternalTasksForWorkspace: vi.fn(async () => []),
  listIntegrationBindingsForWorkspace: storySpies.listIntegrationBindingsForWorkspace,
  getIntegrationBinding: storySpies.getIntegrationBinding,
  upsertIntegrationBinding: storySpies.upsertIntegrationBinding,
  deleteIntegrationBinding: storySpies.deleteIntegrationBinding,
  deleteIntegrationBindingsForProvider: storySpies.deleteIntegrationBindingsForProvider,
  upsertIntegrationCredential: storySpies.upsertIntegrationCredential,
  deleteIntegrationCredential: storySpies.deleteIntegrationCredential,
  listIntegrationCredentials: storySpies.listIntegrationCredentials,
  countWorkspacesPerIntegrationCredential: storySpies.countWorkspacesPerIntegrationCredential,
  summarizeSessionTelemetry: vi.fn(async () => null),
  summarizeWorkspaceTelemetry: vi.fn(async () => null),
  summarizeWorkspaceProviderTelemetry: vi.fn(async () => []),
  listTelemetryForSession: vi.fn(async () => []),
  upsertContextSlot: storySpies.upsertContextSlot,
  listContextSlotsForSession: vi.fn(async () => []),
  insertContextSlotHistory: vi.fn(async () => undefined),
  listContextSlotHistory: vi.fn(async () => []),
  countContextSlotHistoryForSession: vi.fn(async () => ({})),
  listMessagesForSession: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  insertOpenQuestion: vi.fn(async () => undefined),
  markOpenQuestionsResolvedByText: vi.fn(async () => 0),
  listResolvedQuestionTextsForSession: vi.fn(async () => []),
  listOpenQuestionsForSession: vi.fn(async () => []),
  insertTurnEvent: vi.fn(async () => undefined),
  insertTurnEventsBatch: vi.fn(async () => undefined),
  listAgentsForSessions: vi.fn(async () => new Map()),
  listAgentRunIdsForSession: vi.fn(async () => new Map()),
  listAgentTurnSpanRoutes: vi.fn(async () => []),
  purgeAgentForDelete: vi.fn(async () => [] as ReadonlyArray<string>),
  listTurnEventsForAgent: vi.fn(async () => []),
  listTurnEventsForSession: vi.fn(async () => []),
  listTurnEventsForTask: vi.fn(async () => []),
  insertNotification: storySpies.insertNotification,
  listNotifications: storySpies.listNotifications,
  countNotifications: storySpies.countNotifications,
  NOTIFICATION_LIST_LIMIT: 200,
  markNotificationRead: storySpies.markNotificationRead,
  markAllNotificationsRead: storySpies.markAllNotificationsRead,
  deleteNotification: storySpies.deleteNotification,
  clearAllNotifications: storySpies.clearAllNotifications,
  insertNudgeEvent: storySpies.insertNudgeEvent,
  updateNudgeEventOutcome: storySpies.updateNudgeEventOutcome,
  listDiffCommentsForSession: storySpies.listDiffCommentsForSession,
  insertDiffComment: storySpies.insertDiffComment,
  resolveDiffComment: storySpies.resolveDiffComment,
  reopenDiffComment: storySpies.reopenDiffComment,
  consumeDiffComments: storySpies.consumeDiffComments,
  deleteDiffComment: storySpies.deleteDiffComment,
  listProjectScripts: storySpies.listProjectScripts,
  upsertProjectScript: storySpies.upsertProjectScript,
  deleteProjectScript: storySpies.deleteProjectScript,
  getGithubPrCache: vi.fn(async () => null),
  upsertGithubPrCache: vi.fn(async () => undefined),
  deleteGithubPrCache: vi.fn(async () => undefined),
  updateSessionWorkflowStep: vi.fn(async () => undefined),
  attachWorkflowToSession: vi.fn(async () => undefined),
  detachWorkflowFromSession: vi.fn(async () => undefined),
  updateWorkflowOrder: vi.fn(async () => undefined),
});

export const tauriCoreModuleMock = () => ({
  invoke: storySpies.tauriInvoke,
});

export const tauriEventModuleMock = () => ({ listen: vi.fn(async () => () => undefined) });

export const dbLibModuleMock = () => ({
  runDbMigrations: storySpies.runDbMigrations,
  restoreMigrationSnapshot: storySpies.restoreMigrationSnapshot,
  wipeDb: vi.fn(async () => undefined),
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
});

export const onboardingStoreModuleMock = () => ({
  hydrateOnboardingFromDb: vi.fn(async () => undefined),
});

export const turnModuleMock = () => ({
  runTurn: (args: unknown) => storySpies.runTurn(args),
  cancelTurn: (runId: unknown) => storySpies.cancelTurn(runId),
  listLiveRunIds: storySpies.listLiveRunIds,
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
  writeAttachment: () => storySpies.writeAttachment(),
});

export const permissionsModuleMock = () => ({
  invokePermissionRuleList: vi.fn(async () => []),
  invokePermissionRuleUpsert: vi.fn(async () => undefined),
  invokePermissionAuditInsert: vi.fn(async () => undefined),
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  invokeAuditRetryDrain: vi.fn(async () => []),
  invokeAuditRetryUpdate: vi.fn(async () => undefined),
  invokeAuditRetryDelete: vi.fn(async () => undefined),
  useEffectivePermissionRules: () => [],
});

export const providersModuleMock = () => ({
  buildProviderList: () => [{ id: 'anthropic', binary: 'claude', connection: 'connected' }],
  checkProviderAuth: vi.fn(async () => ({ state: 'connected', identity: 'test' })),
  getGeminiStatus: vi.fn(async () => null),
  getOpenCodeStatus: vi.fn(async () => null),
  getOpenRouterStatus: vi.fn(async () => null),
  getMoonshotStatus: vi.fn(async () => null),
});

export const routingModuleMock = () => ({
  resolveProviderForTurn: vi.fn(async () => ({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-3-5-sonnet-latest',
    reason: 'preference',
  })),
});

export const budgetModuleMock = () => ({
  invokeBudgetRuleList: storySpies.invokeBudgetRuleList,
  invokeBudgetRuleUpsert: storySpies.invokeBudgetRuleUpsert,
  invokeBudgetRuleDelete: storySpies.invokeBudgetRuleDelete,
  invokeBudgetAlertsList: storySpies.invokeBudgetAlertsList,
  invokeBudgetAlertDismiss: storySpies.invokeBudgetAlertDismiss,
  invokeSessionBudgetGet: storySpies.invokeSessionBudgetGet,
  invokeSessionBudgetSet: storySpies.invokeSessionBudgetSet,
  invokeCheckProviderBudget: vi.fn(async () => undefined),
});

export const skillsModuleMock = () => ({
  invokeSkillList: storySpies.invokeSkillList,
  invokeSkillUpsert: storySpies.invokeSkillUpsert,
  invokeSkillDelete: storySpies.invokeSkillDelete,
  invokeSkillRescan: storySpies.invokeSkillRescan,
  resolveSkillInvocation: vi.fn(),
});

export const workflowsModuleMock = () => ({
  invokeWorkflowList: storySpies.invokeWorkflowList,
  invokeWorkflowUpsert: storySpies.invokeWorkflowUpsert,
  invokeWorkflowDelete: storySpies.invokeWorkflowDelete,
  invokeWorkflowsForSession: storySpies.invokeWorkflowsForSession,
  invokeStepDefList: vi.fn(async () => []),
  invokeStepDefUpsert: vi.fn(),
  invokeStepDefDelete: vi.fn(),
  invokeAgentList: storySpies.invokeAgentList,
  invokeAgentInsert: storySpies.invokeAgentInsert,
  invokeAgentUpdateStatus: storySpies.invokeAgentUpdateStatus,
  invokeAgentSetVerbosity: storySpies.invokeAgentSetVerbosity,
  invokeAgentMarkViewed: storySpies.invokeAgentMarkViewed,
  invokeAgentSetProviderSessionId: storySpies.invokeAgentSetProviderSessionId,
  invokeAgentSetDone: storySpies.invokeAgentSetDone,
  invokeWorkspacesWithUnread: storySpies.invokeWorkspacesWithUnread,
});

export const plansModuleMock = () => ({
  listPlansForSession: storySpies.listPlansForSession,
  upsertPlan: storySpies.upsertPlan,
  setPlanStatus: storySpies.setPlanStatus,
  setPlanBody: storySpies.setPlanBody,
  deletePlan: vi.fn(),
  addPlanConsumption: storySpies.addPlanConsumption,
  listConsumptionsForPlan: storySpies.listConsumptionsForPlan,
});

export const worktreeModuleMock = () => ({
  createWorktree: (args: unknown) => storySpies.createWorktree(args),
  createSessionDir: (args: unknown) => storySpies.createSessionDir(args),
  removeWorktree: (repoPath: string, worktreePath: string) =>
    storySpies.removeWorktree(repoPath, worktreePath),
  removeWorktreeChecked: (args: { repoPath: string; worktreePath: string }) =>
    storySpies.removeWorktreeChecked(args),
  worktreeWriterStatus: (args: { path: string }) => storySpies.worktreeWriterStatus(args),
  worktreeDirectorySize: vi.fn(async ({ path }: { path: string }) => ({
    path,
    sizeBytes: 1024,
    isPartial: false,
    exists: true,
  })),
  removeSessionDirectory: (args: unknown) => storySpies.removeSessionDirectory(args),
  sessionDirExists: (args: unknown) => storySpies.sessionDirExists(args),
  scratchDirPrepare: (args: unknown) => storySpies.scratchDirPrepare(args),
  scratchDirRemove: (args: unknown) => storySpies.scratchDirRemove(args),
  worktreeChangedFiles: (path: string) => storySpies.worktreeChangedFiles(path),
  worktreeStatus: (path: string) => storySpies.worktreeStatus(path),
  gitCommonDirectory: (args: { readonly repoPath: string }) => storySpies.gitCommonDirectory(args),
  acquireWorktreeWriter: (args: { readonly path: string }) =>
    storySpies.acquireWorktreeWriter(args),
  releaseWorktreeWriter: (args: { readonly path: string }) =>
    storySpies.releaseWorktreeWriter(args),
  cancelWorktreeWriter: (args: { readonly path: string }) => storySpies.cancelWorktreeWriter(args),
  abandonWorktreeWriter: (args: { readonly path: string }) =>
    storySpies.abandonWorktreeWriter(args),
  holdsWorktreeWriter: vi.fn(() => false),
  changeWorktreeBranch: storySpies.changeWorktreeBranch,
  inspectWorktree: (args: { readonly worktreePath: string }) => storySpies.inspectWorktree(args),
  invalidateLocalBranchesCache: vi.fn(),
  scanOrphanWorktrees: storySpies.scanOrphanWorktrees,
  worktreeFolderFacts: vi.fn(async () => []),
  diskFree: vi.fn(async () => ({ freeBytes: null, totalBytes: null })),
  removeWorktreeFolder: storySpies.removeWorktreeFolder,
  listBranchCommits: vi.fn(async () => []),
  worktreeIsAncestor: vi.fn(async () => true),
  worktreeRemoteHead: vi.fn(async () => ''),
});

export const repoModuleMock = () => ({
  validateGitRepo: vi.fn(async () => ({ isRepo: true, rootPath: '/tmp/repo' })),
});

export const editorModuleMock = () => ({ detectEditors: vi.fn(async () => []) });

export const linearClientModuleMock = () => ({
  linearConnect: storySpies.linearConnect,
  linearDisconnect: storySpies.linearDisconnect,
  linearValidateConnection: storySpies.linearValidateConnection,
});

export const sentryClientModuleMock = () => ({
  sentryValidateConnection: storySpies.sentryValidateConnection,
  sentryConnect: storySpies.sentryConnect,
});

export const gitlabClientModuleMock = () => ({
  gitlabValidateConnection: storySpies.gitlabValidateConnection,
  gitlabConnect: storySpies.gitlabConnect,
  gitlabFetchAssignedIssues: vi.fn(async () => []),
  issueIdentifier: vi.fn(),
});

export const jiraClientModuleMock = () => ({
  jiraValidateConnection: storySpies.jiraValidateConnection,
  jiraConnect: storySpies.jiraConnect,
  jiraListIssues: vi.fn(async () => []),
});

export const slackClientModuleMock = () => ({
  slackValidateConnection: storySpies.slackValidateConnection,
  slackConnect: storySpies.slackConnect,
});

export const githubModuleMock = () => ({
  ghStatus: storySpies.ghStatus,
  ghSetToken: storySpies.ghSetToken,
  ghClearToken: storySpies.ghClearToken,
  gitPush: storySpies.gitPush,
  tauriGhRunner: { run: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })) },
  createTauriPrCacheStore: () => ({ get: vi.fn(), upsert: vi.fn(), delete: vi.fn() }),
});

export const coreModuleMock = async (importOriginal: () => Promise<Record<string, unknown>>) => ({
  ...(await importOriginal()),
  detectRepoSlug: storySpies.detectRepoSlug,
  listPrsForBranch: storySpies.listPrsForBranch,
  getPrForBranch: vi.fn(async () => null),
  fetchPrDetail: vi.fn(async () => null),
  fetchLinkedIssues: storySpies.fetchLinkedIssues,
  resolveReviewThread: storySpies.resolveReviewThread,
  addReviewThreadReply: storySpies.addReviewThreadReply,
  seedWorkflowLibrary: vi.fn(async () => undefined),
});

export const scriptsModuleMock = () => ({
  invokeScriptRun: storySpies.invokeScriptRun,
  invokeScriptListLive: storySpies.invokeScriptListLive,
  invokeScriptCancel: vi.fn(async () => undefined),
  listenScriptOutput: vi.fn(async () => () => undefined),
  listenScriptExit: vi.fn(async () => () => undefined),
  scanProjectScripts: storySpies.scanProjectScripts,
  runAdhocScript: storySpies.runAdhocScript,
});

export const terminalModuleMock = () => ({
  invokeTerminalOpen: vi.fn(async () => undefined),
  invokeTerminalListLive: storySpies.invokeTerminalListLive,
  invokeTerminalClose: storySpies.invokeTerminalClose,
  invokeTerminalWrite: vi.fn(async () => undefined),
  invokeTerminalResize: vi.fn(async () => undefined),
});

export const terminalOutputCacheModuleMock = () => ({
  clearTerminalCache: vi.fn(() => undefined),
});

export const openQuestionsModuleMock = () => ({
  useOpenQuestions: {
    getState: () => ({ loadQuestions: vi.fn(async () => undefined) }),
  },
});

export const configExportModuleMock = () => ({
  exportConfigToFile: vi.fn(async () => '/tmp/export.json'),
  importConfigFromFile: vi.fn(async () => null),
});

export const emptyOverrides: OverrideSettings = {
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
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
};

type WorkspaceOverridesInput = Partial<Workspace> & { readonly id: WorkspaceId };

export const buildStoryWorkspace = (overrides: WorkspaceOverridesInput): Workspace => ({
  name: 'Acme',
  slug: 'acme',
  overrides: emptyOverrides,
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
  ...overrides,
});

type ProjectOverridesInput = Partial<Project> & {
  readonly id: ProjectId;
  readonly workspaceId: WorkspaceId;
};

export const buildStoryProject = (overrides: ProjectOverridesInput): Project => ({
  name: 'app',
  rootPath: '/tmp/app',
  kind: 'repo',
  overrides: emptyOverrides,
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
  ...overrides,
});

type SessionOverridesInput = Partial<Session> & {
  readonly id: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const buildStorySession = (overrides: SessionOverridesInput): Session => ({
  goal: 'ship the thing',
  state: { kind: 'draft' },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  autoRun: false,
  titleUserEdited: false,
  workflowRuns: [],
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
  ...overrides,
});

type AgentOverridesInput = Partial<Agent> & {
  readonly id: AgentId;
  readonly sessionId: SessionId;
};

export const buildStoryAgent = (overrides: AgentOverridesInput): Agent => ({
  ordinal: 0,
  name: 'agent 1',
  status: 'pending',
  ...overrides,
});

export const connectedAnthropicState = () => ({
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

export async function* emptyTurnStream(): AsyncIterable<TurnEvent> {}

export const assistantTurnStream = (text: string) =>
  async function* stream(): AsyncIterable<TurnEvent> {
    yield {
      kind: 'assistant_text',
      runId: 'run-story' as never,
      delta: text,
      at: STORY_NOW,
    };
  };

export const recordedEventKinds = (): ReadonlyArray<string> =>
  storySpies.insertSessionEvent.mock.calls.map(([{ event }]) => event.kind);

export const recordedEvent = (
  kind: string,
): { readonly payload?: Record<string, unknown> } | undefined =>
  storySpies.insertSessionEvent.mock.calls
    .map(
      ([{ event }]) =>
        event as { readonly kind: string; readonly payload?: Record<string, unknown> },
    )
    .find((event) => event.kind === kind);
