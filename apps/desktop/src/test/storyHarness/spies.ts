import { vi } from 'vitest';
import type {
  AcquireWriteSetParams,
  ReleaseWriteSetParams,
  WorktreeWriterLease,
  WriteSetLease,
} from '../../features/worktree/worktree';
import { createInvokeMock, createInvokeRouter } from '../invokeMock';
import type { InvokeHandlers } from '../invokeMock';
import { createResolveQueryMocks } from '../../store/slices/resolve/testing/createResolveQueryMocks';
import { resetWorkflowTurnBreaker } from '../../store/slices/turn/workflowTurnBreaker';
import { TEST_NOW } from '@goodboy/types/testing';
import type { Notification } from '@goodboy/db';
import type {
  Agent,
  BranchCommit,
  BudgetAlert,
  BudgetRule,
  DiffComment,
  GhTokenStatus,
  IntegrationBinding,
  IntegrationCredential,
  IsoDateTime,
  Project,
  ProjectScript,
  ProjectScriptId,
  ProjectSentryLink,
  PullRequestState,
  SessionId,
  Skill,
  Workflow,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';

export const STORY_NOW: IsoDateTime = TEST_NOW;

export const STORE_IMPORT_TIMEOUT_MS = 60_000;

const pristineActions = new WeakMap<object, Readonly<Record<string, unknown>>>();

type ActionsOfParams = {
  readonly state: object;
};

const actionsOf = ({ state }: ActionsOfParams): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(state).filter(([, value]) => typeof value === 'function'));

export const importStoreModule = async () => {
  const module = await import('../../store/store');
  if (!pristineActions.has(module.useAppStore)) {
    pristineActions.set(module.useAppStore, actionsOf({ state: module.useAppStore.getState() }));
  }
  return module;
};

export type StoryStoreModule = Awaited<ReturnType<typeof importStoreModule>>;

export const importStore = async () => (await importStoreModule()).useAppStore;

export type StoryStore = Awaited<ReturnType<typeof importStore>>;

export const getSetting = vi.fn<(db: unknown, key: string) => Promise<string | null>>(
  async () => null,
);

export const countNotifications: ReturnType<typeof vi.fn> = vi.fn(async () => []);

export const invokeBudgetRuleUpsert: ReturnType<typeof vi.fn> = vi.fn(async () => undefined);

export const invokeSessionBudgetGet: ReturnType<typeof vi.fn> = vi.fn(async () => null);

export const ghStatus: ReturnType<typeof vi.fn> = vi.fn<() => Promise<GhTokenStatus>>(async () => ({
  available: true,
  mode: 'gh-cli',
  scopes: [],
}));

export const invokeScriptRun: ReturnType<typeof vi.fn> = vi.fn(async () => undefined);

export const runAdhocScript: ReturnType<typeof vi.fn> = vi.fn(async () => 'run-adhoc');

export type WorktreeBaseArgs = {
  readonly worktreePath: string;
  readonly baseBranch?: string | null;
};

type PermissionsModule = typeof import('../../features/permissions/permissions');

type WorkflowsModule = typeof import('../../features/workflows/workflows');

type PlansModule = typeof import('../../features/plans/plans');

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
  worktree_deps_check: {
    state: 'not-applicable',
    command: null,
    source: null,
    folder: null,
    isFolderLink: false,
    outside: [],
  },
  workspaces_with_unread: [],
  workspaces_attention: [],
  get_workspace_overrides: null,
  get_session_overrides: null,
  session_budget_get: null,
  patch_workspace_overrides: null,
  boot_breadcrumb: null,
  log_provider_standing: null,
  claude_usage_probe: null,
  codex_rate_limits_probe: null,
  codex_rate_limits_latest: null,
  integration_credentials_adopt: 0,
  integration_credential_forget: null,
  file_versions_list_staged_snapshots: { runs: [], skipped: [] },
  file_versions_purge_session: null,
  file_versions_folder_list_staged: [],
  file_versions_folder_sessions: [],
  file_versions_folder_status: {
    folderPath: '',
    isReady: true,
    isTurnOpen: false,
    fileCount: 0,
    keptBytes: 0,
    skipped: [],
    method: null,
  },
  file_versions_folder_begin: {
    runId: '',
    wasReady: true,
    copied: 0,
    method: null,
    skipped: [],
    recovered: [],
  },
  file_versions_folder_finalize: { sessionId: '', runId: '', turn: null, kept: [] },
  file_versions_folder_discard: true,
  file_versions_folder_list_turns: [],
  chat_attachments_prune: 0,
  qa_deciding_workflow_runs: [],
  workspace_script_list_live: [],
  terminal_list_live: [],
  workspace_script_snapshot: { data: '', offset: 0, exitCode: null },
  terminal_snapshot: { data: '', offset: 0, exitCode: null },
  turn_list_live: [],
  other_tools_scan: { status: 'ready', tools: [] },
  other_tools_cancel: null,
  summarize_session: storySummarizeSession('The step finished.'),
  repo_base_divergence: {
    state: 'no-upstream',
    base: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    checkoutBranch: null,
    uncommitted: 0,
    message: null,
  },
};

type GetSettingsParams = {
  readonly db: unknown;
  readonly keys: ReadonlyArray<string>;
};

export const storySpies = {
  getSetting,
  getSettings: vi.fn(async ({ db, keys }: GetSettingsParams) => {
    const found = new Map<string, string>();
    for (const key of keys) {
      const value = await getSetting(db, key);
      if (value !== null) {
        found.set(key, value);
      }
    }
    return found;
  }),
  setSetting: vi.fn(async () => undefined),
  getWorkspaceValue: vi.fn<(params: unknown) => Promise<string | null>>(async () => null),
  setWorkspaceValue: vi.fn(async (_params: unknown) => undefined),
  insertWorkspaceValueIfAbsent: vi.fn(async (_params: unknown) => true),
  replaceWorkspaceValueIfUnchanged: vi.fn(async (_params: unknown) => true),
  getProjectValue: vi.fn<(params: unknown) => Promise<string | null>>(async () => null),
  setProjectValue: vi.fn(async (_params: unknown) => undefined),
  deleteProjectValue: vi.fn(async (_params: unknown) => undefined),
  insertProjectValueIfAbsent: vi.fn(async (_params: unknown) => true),
  replaceProjectValueIfUnchanged: vi.fn(async (_params: unknown) => true),
  listProjectValues: vi.fn(async (_params: unknown) => []),
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
  markNotificationsActed: vi.fn(async () => undefined),
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
  listQuietRuns: vi.fn(async (): Promise<ReadonlyArray<{ runId: string; quietMs: number }>> => []),
  invokeBudgetRuleList: vi.fn(async () => [] as ReadonlyArray<BudgetRule>),
  invokeBudgetRuleUpsert,
  invokeBudgetRuleDelete: vi.fn(async () => undefined),
  invokeBudgetAlertDismiss: vi.fn(async () => undefined),
  invokeSessionBudgetGet,
  invokeSessionBudgetSet: vi.fn(
    async (sessionId: string, softCapUsd: number, onExceed: string) => ({
      sessionId,
      softCapUsd,
      onExceed,
      warnRatio: 0.8,
    }),
  ),
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
  invokeWorkspacesAttention: vi.fn<WorkflowsModule['invokeWorkspacesAttention']>(async () => []),
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
  fetchPrDetail: vi.fn(async (): Promise<unknown> => null),
  gitlabListMrDiscussions: vi.fn(),
  bitbucketListPullRequestComments: vi.fn(),
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
  invokeScriptSnapshot: vi.fn<
    () => Promise<{ data: string; offset: number; exitCode: number | null }>
  >(async () => ({ data: '', offset: 0, exitCode: null })),
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
  worktreeGitDirectory: vi.fn(async (_args: WorktreeBaseArgs): Promise<string | null> => null),
  worktreeChangedFiles: vi.fn(async (_params: WorktreeBaseArgs) => ({
    files: [],
    numstat: '',
  })),
  listBranchCommits: vi.fn(
    async (_worktreePath: string): Promise<ReadonlyArray<BranchCommit>> => [],
  ),
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
  acquireWriteSet: vi.fn(async ({ paths }: AcquireWriteSetParams) => grantedWriteSet({ paths })),
  releaseWriteSet: vi.fn(async ({ entries }: ReleaseWriteSetParams) =>
    entries.map((entry) => entry.path),
  ),
  listActiveResolveAttempts: vi.fn(async () => [] as ReadonlyArray<never>),
};

export const storyResolveQueries = createResolveQueryMocks();

const storyInvoke = (command: string) => storySpies.tauriInvoke(command);

type GrantedWriteSetParams = Readonly<{ paths: ReadonlyArray<string> }>;

const grantedWriteSet = ({ paths }: GrantedWriteSetParams): WriteSetLease => ({
  isGranted: true,
  entries: paths.map((path) => ({ path, token: `token:${path}` })),
  blockedPath: null,
  blockedBy: null,
});

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
  storySpies.acquireWriteSet.mockImplementation(async ({ paths }) => grantedWriteSet({ paths }));
  storySpies.releaseWriteSet.mockImplementation(async ({ entries }) =>
    entries.map((entry) => entry.path),
  );
  storySpies.listActiveResolveAttempts.mockImplementation(async () => []);
  storySpies.listBranchCommits.mockImplementation(async () => []);
  storySpies.createWorktree.mockImplementation(async () => ({
    worktreePath: '/tmp/app/.goodboy/worktrees/goal-12345678',
    branchName: 'goodboy/goal-12345678',
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
  storySpies.worktreeGitDirectory.mockImplementation(async () => null);
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
  const { useAppStore } = await importStoreModule();
  resetStorySpies();
  useAppStore.setState({
    ...pristineActions.get(useAppStore),
    ...useAppStore.getInitialState(),
  });
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.clear();
  }
};
