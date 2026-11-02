import { vi } from 'vitest';
import type {
  AcquireWriteSetParams,
  ReleaseWriteSetParams,
} from '../../features/worktree/worktree';
import { createDbMock } from '../dbMock';
import { storyDbStubs } from './dbStubs';
import {
  type WorktreeBaseArgs,
  ghStatus,
  invokeBudgetRuleUpsert,
  invokeScriptRun,
  invokeSessionBudgetGet,
  runAdhocScript,
  storySpies,
} from './spies';

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
  listQuietRuns: storySpies.listQuietRuns,
  lookupDeliveryRun: vi.fn(async () => null),
  encodeAuthRequiredMessage: () => '',
  isAuthErrorMessage: () => false,
  writeAttachment: () => storySpies.writeAttachment(),
  deleteAttachment: () => storySpies.deleteAttachment(),
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
  invokeBudgetEmitAlerts: vi.fn(async () => []),
  invokeCheckProviderBudget: vi.fn(async () => undefined),
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
  invokeWorkspacesAttention: storySpies.invokeWorkspacesAttention,
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
  worktreeSnapshot: vi.fn(async () => ({ head: 'abc123', entries: [], isPartial: false })),
  worktreeTurnFiles: vi.fn(async () => ({ own: [], fromBase: [], isPartial: false })),
  carryIntoWorktree: vi.fn(async () => []),
  worktreeSetupProposal: vi.fn(async () => null),
  worktreeStatus: (path: string) => storySpies.worktreeStatus(path),
  gitCommonDirectory: (args: { readonly repoPath: string }) => storySpies.gitCommonDirectory(args),
  worktreeGitDirectory: ({ worktreePath }: WorktreeBaseArgs) =>
    storySpies.worktreeGitDirectory({ worktreePath }),
  acquireWorktreeWriter: (args: { readonly path: string; readonly holder?: string }) =>
    storySpies.acquireWorktreeWriter(args),
  releaseWorktreeWriter: (args: { readonly path: string }) =>
    storySpies.releaseWorktreeWriter(args),
  cancelWorktreeWriter: (args: { readonly path: string }) => storySpies.cancelWorktreeWriter(args),
  abandonWorktreeWriter: (args: { readonly path: string }) =>
    storySpies.abandonWorktreeWriter(args),
  holdsWorktreeWriter: vi.fn(() => false),
  acquireWriteSet: (args: AcquireWriteSetParams) => storySpies.acquireWriteSet(args),
  releaseWriteSet: (args: ReleaseWriteSetParams) => storySpies.releaseWriteSet(args),
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
  listBranchCommits: (worktreePath: string) => storySpies.listBranchCommits(worktreePath),
  listBranchNames: vi.fn(async () => [] as ReadonlyArray<string>),
  worktreeIsAncestor: vi.fn(async () => true),
  worktreeRemoteHead: vi.fn(async () => ''),
  worktreeDiffRange: vi.fn(async () => ''),
  worktreeCommitRange: vi.fn(async () => []),
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

type ThreadsClientParams = {
  readonly importOriginal: () => Promise<Record<string, unknown>>;
};

export const gitlabThreadsClientModuleMock = async ({ importOriginal }: ThreadsClientParams) => ({
  ...(await importOriginal()),
  gitlabListMrDiscussions: storySpies.gitlabListMrDiscussions,
});

export const bitbucketThreadsClientModuleMock = async ({
  importOriginal,
}: ThreadsClientParams) => ({
  ...(await importOriginal()),
  bitbucketListPullRequestComments: storySpies.bitbucketListPullRequestComments,
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
  fetchPrDetail: storySpies.fetchPrDetail,
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
  invokeScriptSnapshot: storySpies.invokeScriptSnapshot,
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
  invokeTerminalSnapshot: vi.fn(async () => ({ data: '', offset: 0, exitCode: null })),
});

type TerminalExitListener = (params: {
  readonly terminalId: string;
  readonly exitCode: number;
}) => void;

type SubscribeExitsParams = {
  readonly listener: TerminalExitListener;
};

const terminalExitListeners = new Set<TerminalExitListener>();

type EmitExitParams = {
  readonly terminalId: string;
  readonly exitCode: number;
};

export const emitTerminalExit = ({ terminalId, exitCode }: EmitExitParams): void => {
  for (const listener of [...terminalExitListeners]) {
    listener({ terminalId, exitCode });
  }
};

export const terminalOutputBusModuleMock = () => ({
  terminalOutputBus: {
    register: vi.fn(async () => undefined),
    subscribe: vi.fn(() => () => undefined),
    subscribeExits: vi.fn(({ listener }: SubscribeExitsParams) => {
      terminalExitListeners.add(listener);
      return () => {
        terminalExitListeners.delete(listener);
      };
    }),
    tailOf: vi.fn(() => null),
    forget: vi.fn(() => undefined),
  },
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
    sha256: 'sha-harborline',
    allowRules: [],
    scripts: [],
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
