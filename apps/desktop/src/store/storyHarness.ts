import { vi } from 'vitest';
import type { WorktreeWriterLease } from '../features/worktree/worktree';
import { createDbMock } from '../test/dbMock';
import { createInvokeMock, createInvokeRouter, type InvokeHandlers } from '../test/invokeMock';
import { createResolveQueryMocks } from './slices/resolve/testing/createResolveQueryMocks';
import { resetWorkflowTurnBreaker } from './slices/turn/workflowTurnBreaker';
import {
  aProject,
  aSession,
  aWorkspace,
  anAgent,
  EMPTY_OVERRIDES,
  TEST_NOW,
} from '@goodboy/types/testing';
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
  ProjectSentryLink,
  PullRequestState,
  Session,
  SessionId,
  Skill,
  TurnEvent,
  Workflow,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';

export {
  armedDbFaults,
  injectDbFault,
  openStorySqlite,
  rowsOf,
  sqliteDbLibModuleMock,
  storySqlite,
} from '../test/sqliteDb';

export const STORY_NOW: IsoDateTime = TEST_NOW;

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

type WorktreeBaseArgs = {
  readonly worktreePath: string;
  readonly baseBranch?: string | null;
};

type PermissionsModule = typeof import('../features/permissions/permissions');

type WorkflowsModule = typeof import('../features/workflows/workflows');

type PlansModule = typeof import('../features/plans/plans');

const cleanWorkingTree = {
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0 },
} as never;

const SLOT_SUMMARY_PREFIX = 'Current slot values:';

const TITLE_PROMPT_PREFIX = 'Write one imperative title';

type AuxArgs = {
  readonly args: {
    readonly providerId: string;
    readonly systemPrompt: string;
    readonly userMessage: string;
  };
};

export const storySummarizeSession =
  (stepSummary: string) =>
  ({ args }: AuxArgs) => {
    if (args.systemPrompt.startsWith(TITLE_PROMPT_PREFIX)) {
      return { stdout: '', stderr: 'no aux provider in tests', exitCode: 1 };
    }
    const text = args.userMessage.startsWith(SLOT_SUMMARY_PREFIX) ? '{"upserts":[]}' : stepSummary;
    return {
      stdout:
        args.providerId === 'anthropic'
          ? JSON.stringify({ result: text, subtype: 'success' })
          : text,
      stderr: '',
      exitCode: 0,
    };
  };

const storyInvokeHandlers = {
  gh_status: {
    available: false,
    mode: 'absent',
    version: null,
    user: null,
    scopes: [],
    scoped: false,
  },
  query_bridge_serving: false,
  get_workspace_overrides: null,
  get_session_overrides: null,
  set_workspace_overrides: null,
  boot_breadcrumb: null,
  log_provider_standing: null,
  claude_usage_probe: null,
  codex_rate_limits_probe: null,
  codex_rate_limits_latest: null,
  integration_credentials_adopt: 0,
  integration_credential_forget: null,
  file_versions_list_staged_snapshots: { runs: [], skipped: [] },
  file_versions_purge_session: null,
  chat_attachments_prune: 0,
  qa_deciding_workflow_runs: [],
  workspace_script_list_live: [],
  terminal_list_live: [],
  other_tools_scan: { status: 'ready', tools: [] },
  other_tools_cancel: null,
  summarize_session: storySummarizeSession('The step finished.'),
};

export const storySpies = {
  getSetting,
  setSetting: vi.fn(async () => undefined),
  markSessionOpened: vi.fn(async (_params: unknown) => undefined),
  updateProjectResolveCommitStyle: vi.fn(async () => undefined),
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
  deleteNotificationsByCoalesceKey: vi.fn(async () => undefined),
  clearResolvedHelperNotifications: vi.fn(async () => undefined),
  insertNudgeEvent: vi.fn(async () => undefined),
  updateNudgeEventOutcome: vi.fn(async () => undefined),
  insertDiffComment: vi.fn(async () => undefined),
  listDiffCommentsForSession: vi.fn(async () => [] as ReadonlyArray<DiffComment>),
  resolveDiffComment: vi.fn(async () => undefined),
  reopenDiffComment: vi.fn(async () => undefined),
  deleteDiffComment: vi.fn(async () => undefined),
  restoreDiffComment: vi.fn(async () => undefined),
  assignDiffCommentTarget: vi.fn(async () => undefined),
  upsertIntegrationBinding: vi.fn(async () => undefined),
  listIntegrationBindingsForWorkspace: vi.fn(async () => [] as ReadonlyArray<IntegrationBinding>),
  listProjectSentryLinks: vi.fn(
    async (_params?: unknown) => [] as ReadonlyArray<ProjectSentryLink>,
  ),
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
  invokeSessionBudgetClear: vi.fn(async () => undefined),
  invokeSkillList: vi.fn(async () => [] as ReadonlyArray<Skill>),
  invokeSkillUpsert: vi.fn(async () => undefined),
  invokeSkillDelete: vi.fn(async () => undefined),
  invokeSkillRescan: vi.fn(async () => [] as ReadonlyArray<Skill>),
  invokeWorkflowList: vi.fn(async () => [] as ReadonlyArray<Workflow>),
  invokeWorkflowUpsert: vi.fn(
    async (_args: Parameters<WorkflowsModule['invokeWorkflowUpsert']>[0]) =>
      undefined as Workflow | undefined,
  ),
  invokeWorkflowDelete: vi.fn(async () => undefined),
  invokeWorkflowsForSession: vi.fn(async () => [] as ReadonlyArray<unknown>),
  invokeAgentInsert: vi.fn(),
  invokeAgentUpdateStatus: vi.fn(),
  invokeAgentSetVerbosity: vi.fn(async () => undefined),
  invokeAgentMarkViewed: vi.fn<WorkflowsModule['invokeAgentMarkViewed']>(async () => undefined),
  invokeAgentSetProviderSessionId: vi.fn(async () => undefined),
  invokeAgentSetDone: vi.fn(async () => undefined),
  invokeWorkspacesWithUnread: vi.fn<WorkflowsModule['invokeWorkspacesWithUnread']>(async () => []),
  changeWorktreeBranch: vi.fn(async () => ({ adopted: false })),
  listLocalBranches: vi.fn(
    async () => [] as ReadonlyArray<{ name: string; inUse: boolean; hasUncommitted: boolean }>,
  ),
  listRemoteBranches: vi.fn(
    async () =>
      [] as ReadonlyArray<{
        name: string;
        author: string;
        sha: string;
        timestamp: number;
        hasLocal: boolean;
      }>,
  ),
  remoteBranchState: vi.fn(
    async () =>
      null as {
        remoteAhead: number;
        localOwn: number;
        remoteContainsLocal: boolean;
        remoteSha: string;
        localSha: string;
      } | null,
  ),
  moveToRemoteCommits: vi.fn(async () => undefined),
  ghOpenPrBranches: vi.fn(
    async () =>
      [] as ReadonlyArray<{
        number: number;
        title: string;
        headBranch: string;
        isDraft: boolean;
        author: string | null;
      }>,
  ),
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
  listPlansForSession: vi.fn<PlansModule['listPlansForSession']>(async () => []),
  upsertPlan: vi.fn<PlansModule['upsertPlan']>(),
  setPlanStatus: vi.fn(async () => undefined),
  setPlanBodyIfRevision: vi.fn<PlansModule['setPlanBodyIfRevision']>(
    async (_id, _title, _bodyMd, expectedRevision) => ({
      kind: 'saved',
      revision: expectedRevision + 1,
    }),
  ),
  addPlanConsumption: vi.fn<PlansModule['addPlanConsumption']>(),
  listConsumptionsForPlan: vi.fn<PlansModule['listConsumptionsForPlan']>(async () => []),
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
  updateReviewComment: vi.fn(async () => ({ id: 'reply-id', url: 'url' })),
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
  invokePermissionRuleList: vi.fn<PermissionsModule['invokePermissionRuleList']>(async () => []),
  invokePermissionRuleUpsert: vi.fn<PermissionsModule['invokePermissionRuleUpsert']>(),
  invokePermissionRuleDelete: vi.fn(async () => undefined),
  invokePermissionAuditInsert: vi.fn<
    (input: Parameters<PermissionsModule['invokePermissionAuditInsert']>[0]) => Promise<unknown>
  >(async () => undefined),
  invokeAuditRetryEnqueue: vi.fn<PermissionsModule['invokeAuditRetryEnqueue']>(
    async () => undefined,
  ),
  invokeAuditRetryDrain: vi.fn<PermissionsModule['invokeAuditRetryDrain']>(async () => []),
  invokeAuditRetryUpdate: vi.fn<PermissionsModule['invokeAuditRetryUpdate']>(async () => undefined),
  invokeAuditRetryDelete: vi.fn<PermissionsModule['invokeAuditRetryDelete']>(async () => undefined),
  runTurn: vi.fn(),
  cancelTurn: vi.fn(async (_runId: unknown) => undefined),
  writeAttachment: vi.fn(async () => '.goodboy/attachments/spec.pdf'),
  tauriInvoke: createInvokeMock({ handlers: storyInvokeHandlers, unknownResult: null }),
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
  worktreeWriterStatus: vi.fn(async (_args: { path: string }) =>
    freeWriterLease({ path: _args.path }),
  ),
  removeSessionDirectory: vi.fn(async (_args: unknown) => undefined),
  worktreeStatus: vi.fn(async (_path: string) => cleanWorkingTree),
  gitCommonDirectory: vi.fn(
    async (_args: { readonly repoPath: string }): Promise<string | null> => null,
  ),
  worktreeChangedFiles: vi.fn(async (_params: WorktreeBaseArgs) => ({
    files: [],
    numstat: '',
  })),
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
  listWorktreesForSession: vi.fn(
    async () => [] as ReadonlyArray<{ readonly worktreePath: string }>,
  ),
  getAgentById: vi.fn(async () => null as Agent | null),
  getWorkspaceById: vi.fn(
    async (_params: { readonly id: WorkspaceId }): Promise<Workspace | null> => null,
  ),
  listProjectsForWorkspace: vi.fn(
    async (_params: { readonly workspaceId: WorkspaceId }) => [] as ReadonlyArray<Project>,
  ),
  upsertSessionExternalTask: vi.fn(async () => undefined),
  upsertContextSlot: vi.fn(async () => undefined),
  deleteSession: vi.fn(async () => undefined),
  acquireWorktreeWriter: vi.fn(
    async ({ path }: { readonly path: string; readonly holder?: string }) =>
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

const freeWriterLease = ({ path }: { readonly path: string }): WorktreeWriterLease => ({
  path,
  holder: null,
  token: null,
  runId: null,
  isGranted: false,
  hasExited: false,
  waiting: [],
});

export const stubStoryInvoke = (overrides: InvokeHandlers) => {
  storySpies.tauriInvoke.mockImplementation(
    createInvokeRouter({ handlers: { ...storyInvokeHandlers, ...overrides }, unknownResult: null }),
  );
};

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

const { resetResolveQueryMocks: _resetResolveQueryMocks, ...storyResolveDbQueries } =
  storyResolveQueries;

export const storyDbStubs = () => ({
  ...storyResolveDbQueries,
  hasOtherSessionTurnSince: vi.fn(async () => false),
  insertAgentTurnSpan: vi.fn(async () => undefined),
  insertAgentHandoff: vi.fn(async () => undefined),
  countUserTextEvents: vi.fn(async () => 0),
  listSessionDecisions: vi.fn(async () => []),
  listSessionContextItemsForRole: vi.fn(async () => []),
  listSessionContextItems: vi.fn(async () => []),
  listWorkspaceLearnings: vi.fn(async () => []),
  listWorkspaceExternalTasks: vi.fn(async () => []),
  listProviderLimits: vi.fn(async () => []),
  listArtifactsForSession: vi.fn(async () => []),
  listSessionEvents: vi.fn(async () => []),
  listSessionTurnSpans: vi.fn(async () => []),
  listWorkspaceTurnSpans: vi.fn(async () => []),
  listTurnSpans: vi.fn(async () => []),
  listSettingsWithPrefix: vi.fn(async () => []),
  listResolveCheckRuns: vi.fn(async () => []),
  listPlansForSession: vi.fn(async () => []),
  getArtifactProvenance: vi.fn(async () => null),
  upsertWorkflow: vi.fn(async () => undefined),
  listActiveResolveAttempts: storySpies.listActiveResolveAttempts,
  getSetting: storySpies.getSetting,
  setSetting: storySpies.setSetting,
  updateProjectResolveCommitStyle: storySpies.updateProjectResolveCommitStyle,
  getWorkspaceById: storySpies.getWorkspaceById,
  listWorkspaces: storySpies.listWorkspaces,
  listDisconnectedWorkspaces: vi.fn(async () => [] as ReadonlyArray<Workspace>),
  listProjectsForWorkspace: storySpies.listProjectsForWorkspace,
  listAllProjectsForWorkspace: vi.fn(async () => [] as ReadonlyArray<Project>),
  listProviderCredentials: storySpies.listProviderCredentials,
  findProjectByRootPath: vi.fn(async () => null),
  findDisconnectedProjectByIdentity: vi.fn(async () => null),
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
  markSessionOpened: storySpies.markSessionOpened,
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
  listWorktreesForSession: storySpies.listWorktreesForSession,
  getAgentById: storySpies.getAgentById,
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
  replaceSessionTaskLinks: vi.fn(async () => true),
  deleteSessionExternalTask: vi.fn(async () => undefined),
  listExternalTasksForWorkspace: vi.fn(async () => []),
  listIntegrationBindingsForWorkspace: storySpies.listIntegrationBindingsForWorkspace,
  listProjectSentryLinks: storySpies.listProjectSentryLinks,
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
  listDormantSessionTelemetry: vi.fn(async () => []),
  listTelemetryForSession: vi.fn(async () => []),
  upsertContextSlot: storySpies.upsertContextSlot,
  listContextSlotsForSession: vi.fn(async () => []),
  insertContextSlotHistory: vi.fn(async () => undefined),
  listContextSlotHistory: vi.fn(async () => []),
  countContextSlotHistoryForSession: vi.fn(async () => ({})),
  listMessagesForSession: vi.fn(async () => []),
  listMessagesForAgent: vi.fn(async () => []),
  insertOpenQuestion: vi.fn(async () => ({ inserted: true })),
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
  insertNotification: storySpies.insertNotification,
  listNotifications: storySpies.listNotifications,
  countNotifications: storySpies.countNotifications,
  NOTIFICATION_LIST_LIMIT: 200,
  markNotificationRead: storySpies.markNotificationRead,
  markAllNotificationsRead: storySpies.markAllNotificationsRead,
  deleteNotification: storySpies.deleteNotification,
  clearAllNotifications: storySpies.clearAllNotifications,
  deleteNotificationsByCoalesceKey: storySpies.deleteNotificationsByCoalesceKey,
  clearResolvedHelperNotifications: storySpies.clearResolvedHelperNotifications,
  insertNudgeEvent: storySpies.insertNudgeEvent,
  updateNudgeEventOutcome: storySpies.updateNudgeEventOutcome,
  listDiffCommentsForSession: storySpies.listDiffCommentsForSession,
  insertDiffComment: storySpies.insertDiffComment,
  resolveDiffComment: storySpies.resolveDiffComment,
  reopenDiffComment: storySpies.reopenDiffComment,
  deleteDiffComment: storySpies.deleteDiffComment,
  restoreDiffComment: storySpies.restoreDiffComment,
  assignDiffCommentTarget: storySpies.assignDiffCommentTarget,
  listProjectScripts: storySpies.listProjectScripts,
  upsertProjectScript: storySpies.upsertProjectScript,
  deleteProjectScript: storySpies.deleteProjectScript,
  recordSecurityFindings: vi.fn(async () => undefined),
  listOpenSecurityFindings: vi.fn(async () => []),
  listDismissedSecurityFindings: vi.fn(async () => []),
  countOpenSecurityFindings: vi.fn(async () => 0),
  dismissSecurityFinding: vi.fn(async () => undefined),
  flagSecurityFindingAgain: vi.fn(async () => undefined),
  updateProjectGoodboyIgnore: vi.fn(async () => undefined),
  getGithubPrCache: vi.fn(async () => null),
  upsertGithubPrCache: vi.fn(async () => undefined),
  deleteGithubPrCache: vi.fn(async () => undefined),
  updateSessionWorkflowStep: vi.fn(async () => undefined),
  attachWorkflowToSession: vi.fn(async () => undefined),
  detachWorkflowFromSession: vi.fn(async () => undefined),
  updateWorkflowOrder: vi.fn(async () => undefined),
});

export const dbModuleMock = (stubs: Readonly<Record<string, unknown>> = {}) =>
  createDbMock({ ...storyDbStubs(), ...stubs });

export const tauriCoreModuleMock = () => ({
  invoke: storySpies.tauriInvoke,
});

export const tauriEventModuleMock = () => ({ listen: vi.fn(async () => () => undefined) });

export const dbLibModuleMock = () => ({
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
});

export const dbBootModuleMock = () => ({
  runDbMigrations: storySpies.runDbMigrations,
  restoreMigrationSnapshot: storySpies.restoreMigrationSnapshot,
  wipeDb: vi.fn(async () => undefined),
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
  invokePermissionRuleList: storySpies.invokePermissionRuleList,
  invokePermissionRuleUpsert: storySpies.invokePermissionRuleUpsert,
  invokePermissionRuleDelete: storySpies.invokePermissionRuleDelete,
  invokePermissionAuditInsert: storySpies.invokePermissionAuditInsert,
  invokeAuditRetryEnqueue: storySpies.invokeAuditRetryEnqueue,
  invokeAuditRetryDrain: storySpies.invokeAuditRetryDrain,
  invokeAuditRetryUpdate: storySpies.invokeAuditRetryUpdate,
  invokeAuditRetryDelete: storySpies.invokeAuditRetryDelete,
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
  invokeSessionBudgetClear: storySpies.invokeSessionBudgetClear,
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
  setPlanBodyIfRevision: storySpies.setPlanBodyIfRevision,
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
  worktreeChangedFiles: (params: WorktreeBaseArgs) => storySpies.worktreeChangedFiles(params),
  worktreeStatus: (path: string) => storySpies.worktreeStatus(path),
  gitCommonDirectory: (args: { readonly repoPath: string }) => storySpies.gitCommonDirectory(args),
  acquireWorktreeWriter: (args: { readonly path: string; readonly holder?: string }) =>
    storySpies.acquireWorktreeWriter(args),
  releaseWorktreeWriter: (args: { readonly path: string }) =>
    storySpies.releaseWorktreeWriter(args),
  cancelWorktreeWriter: (args: { readonly path: string }) => storySpies.cancelWorktreeWriter(args),
  abandonWorktreeWriter: (args: { readonly path: string }) =>
    storySpies.abandonWorktreeWriter(args),
  holdsWorktreeWriter: vi.fn(() => false),
  changeWorktreeBranch: storySpies.changeWorktreeBranch,
  listLocalBranches: storySpies.listLocalBranches,
  getCachedLocalBranches: vi.fn(() => undefined),
  listRemoteBranches: storySpies.listRemoteBranches,
  fetchRemoteBranches: vi.fn(async () => undefined),
  remoteBranchState: storySpies.remoteBranchState,
  moveToRemoteCommits: storySpies.moveToRemoteCommits,
  inspectWorktree: (args: { readonly worktreePath: string }) => storySpies.inspectWorktree(args),
  invalidateLocalBranchesCache: vi.fn(),
  scanOrphanWorktrees: storySpies.scanOrphanWorktrees,
  worktreeFolderFacts: vi.fn(async () => []),
  diskFree: vi.fn(async () => ({ freeBytes: null, totalBytes: null })),
  removeWorktreeFolder: storySpies.removeWorktreeFolder,
  listBranchCommits: vi.fn(async () => []),
  listBranchNames: vi.fn(async () => [] as ReadonlyArray<string>),
  worktreeIsAncestor: vi.fn(async () => true),
  worktreeRemoteHead: vi.fn(async () => ''),
});

export const repoModuleMock = () => ({
  validateGitRepo: vi.fn(async () => ({ isRepo: true, rootPath: '/tmp/repo' })),
  repoIdentity: vi.fn(async () => null),
  findMovedProjects: vi.fn(async () => []),
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
  ghOpenPrBranches: storySpies.ghOpenPrBranches,
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
  updateReviewComment: storySpies.updateReviewComment,
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

export const configExportModuleMock = () => ({
  chooseExportFile: vi.fn(async () => '/tmp/export.json'),
  chooseImportFile: vi.fn(async () => null),
  configExportPreview: vi.fn(async () => ({
    counts: {
      workspaces: 0,
      projects: 0,
      skills: 0,
      phaseTemplates: 0,
      permissionRules: 0,
      budgetRules: 0,
      scripts: 0,
      toolBindings: 0,
    },
    leftOutFindings: [],
  })),
  configExportWrite: vi.fn(async () => undefined),
  configImportPreview: vi.fn(async () => ({
    manifest: {
      schemaVersion: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      workspaceCount: 0,
      projectCount: 0,
      workflowCount: 0,
    },
    workspaceMatches: [],
    projectMatches: [],
    groupStats: [],
  })),
  configImportApply: vi.fn(async () => ({
    ok: true,
    errors: [],
    stats: {
      workspaces: 0,
      skills: 0,
      phaseTemplates: 0,
      permissionRules: 0,
      budgetRules: 0,
      scripts: 0,
      toolBindings: 0,
      unresolvedProjects: 0,
    },
  })),
});

export const emptyOverrides: OverrideSettings = EMPTY_OVERRIDES;

type WorkspaceOverridesInput = Partial<Workspace> & { readonly id: WorkspaceId };

export const buildStoryWorkspace = (overrides: WorkspaceOverridesInput): Workspace =>
  aWorkspace({ name: 'Acme', slug: 'acme', ...overrides });

type ProjectOverridesInput = Partial<Project> & {
  readonly id: ProjectId;
  readonly workspaceId: WorkspaceId;
};

export const buildStoryProject = (overrides: ProjectOverridesInput): Project =>
  aProject({ name: 'app', rootPath: '/tmp/app', ...overrides });

type SessionOverridesInput = Partial<Session> & {
  readonly id: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const buildStorySession = (overrides: SessionOverridesInput): Session =>
  aSession({ goal: 'ship the thing', ...overrides });

type AgentOverridesInput = Partial<Agent> & {
  readonly id: AgentId;
  readonly sessionId: SessionId;
};

export const buildStoryAgent = (overrides: AgentOverridesInput): Agent => anAgent(overrides);

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
