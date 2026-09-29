import { createResolveSlice } from './slices/resolve';
import { createReviewNavigationSlice } from './slices/review-navigation';
import { reviewNavigationInitialState } from './slices/review-navigation/state';
import { resolveInitialState } from './slices/resolve/state';
import { create } from 'zustand';
import type {
  AgentId,
  SessionId,
  FileVersionId,
  IntegrationCredentialId,
  WorkspaceId,
  WorkspaceIntegrationProvider,
  MountId,
  PrSeries,
  PrSeriesMember,
  PrSeriesView,
  GhTokenStatus,
  PrMergeMethod,
  SlackIntegrationConfig,
  PrReviewDraft,
} from '@goodboy/types';
import type { ExtractedReviewComment } from '@goodboy/core';
import { buildProviderList } from '../features/providers/providers';
import { createNotificationsSlice } from './slices/notifications';
import { createNudgesSlice } from './slices/nudges';
import { createArtifactsSlice, artifactsInitialState } from './slices/artifacts';
import { createPlansSlice } from './slices/plans';
import { createOpenQuestionsSlice } from './slices/open-questions';
import { createSlackDraftsSlice } from './slices/slack-drafts';
import type { DecideSessionSlackDraftParams } from './slices/slack-drafts';
import { createBudgetSlice } from './slices/budget';
import { createSkillsSlice } from './slices/skills';
import { createStorageSlice } from './slices/storage';
import { createDiffCommentsSlice } from './slices/diff-comments';
import { createFileVersionsSlice } from './slices/file-versions';
import { createSessionEventsSlice } from './slices/session-events';
import { createAttachmentsSlice } from './slices/attachments';
import { createGithubSlice } from './slices/github';
import type { CreatePrInput } from './slices/github/createPrForSession';
import type { RefreshPrOptions } from './slices/github/refreshMountPr';
import type { PrWriteOptions } from './slices/github/prWriteOptions';
import { createGitlabMrSlice, initialGitlabMrState } from './slices/gitlab-mr';
import type { CreateMrInput, MergeMrInput, RefreshMrOptions } from './slices/gitlab-mr';
import {
  createBitbucketPrSlice,
  initialBitbucketPrState,
  type BitbucketPrCommentParams,
  type BitbucketPrReplyParams,
  type BitbucketPrWriteParams,
  type RefreshSessionBitbucketPrOptions,
} from './slices/bitbucket-pr';
import {
  createSlackThreadsSlice,
  initialSlackThreadsState,
  type RefreshSlackThreadOptions,
  type SlackChannelParams,
  type SlackReactionParams,
  type SlackReplyParams,
  type SlackThreadParams,
  type SlackWorkspaceParams,
} from './slices/slack-threads';
import { createReviewDraftsSlice } from './slices/review-drafts';
import type {
  AddReviewDraftInput,
  PublishPrReviewOpts,
  PublishPrReviewResult,
  ReviewSubmission,
} from './slices/review-drafts';
import { createIntegrationsSlice } from './slices/integrations';
import { createSidebarSlice } from './slices/sidebar';
import { createSessionViewSlice } from './slices/session-view';
import { createSessionFiltersSlice } from './slices/sessionFilters';
import { createInitialSessionViewState } from './slices/session-view/createInitialSessionViewState';
import { createTerminalSlice } from './slices/terminal';
import { createScriptsSlice } from './slices/scripts';
import { initialScriptsState } from './slices/scripts/state';
import { createPermissionsSlice } from './slices/permissions';
import {
  createProvidersSlice,
  INITIAL_CONNECT_MAP,
  INITIAL_LIFECYCLE_MAP,
} from './slices/providers';
import { createAgentsSlice } from './slices/agents';
import { createAgentQueueSlice } from './slices/agentQueue';
import { createArtifactDraftsSlice } from './slices/artifactDrafts';
import { createWorkflowDraftsSlice } from './slices/workflowDrafts';
import { createWorkflowStudioSlice } from './slices/workflowStudio';
import { initialWorkflowStudioState } from './slices/workflowStudio/state';
import { createWorkflowRoutingSlice } from './slices/workflowRouting';
import { initialWorkflowRoutingState } from './slices/workflowRouting/state';
import { createSlotsSlice } from './slices/slots';
import { createOverridesSlice } from './slices/overrides';
import { createCredentialsSlice } from './slices/credentials';
import { createWorkflowsSlice } from './slices/workflows';
import { createSettingsSlice } from './slices/settings';
import { createBackupSlice } from './slices/backup';
import { backupInitialState } from './slices/backup/state';
import { budgetInitialState } from './slices/budget/state';
import { createTranscriptsSlice } from './slices/transcripts';
import { createSummariesSlice } from './slices/summaries';
import { createSessionsSlice } from './slices/sessions';
import { createWorkspacesSlice } from './slices/workspaces';
import { createProjectsSlice } from './slices/projects';
import { createProjectMountsSlice } from './slices/project-mounts';
import { projectMountsInitialState } from './slices/project-mounts/state';
import { createProjectRelocationSlice } from './slices/project-relocation';
import { projectRelocationInitialState } from './slices/project-relocation/state';
import { createMountCleanupSlice, mountCleanupInitialState } from './slices/mount-cleanup';
import { createHistorySlice, historyInitialState } from './slices/history';
import { createScribeSlice, scribeInitialState } from './slices/scribe';
import type { RequestScribeInput, SettleScribeInput } from './slices/scribe/types';
import type {
  ApplyHistoryDraftInput,
  ApplyHistoryRewriteInput,
  ApplyHistoryRewriteOutcome,
  EditHistoryDraftInput,
  HistoryMountInput,
  HistoryIdentity,
  HistoryRunOrigin,
  RebaseBranchOutcome,
  SettleHistoryRewriterInput,
  StartHistoryRewriterInput,
} from './slices/history/types';
import type { StartHistoryRewriterOutcome } from './slices/history/startHistoryRewriter';
import type { RestoreHistoryInput, RestoreHistoryOutcome } from './slices/history/restoreHistory';
import type { BringOriginOutcome } from './slices/history/bringOriginIntoHistory';
import { createPrSeriesSlice, prSeriesInitialState } from './slices/pr-series';
import { createPrWritesSlice } from './slices/pr-writes';
import { prWritesInitialState } from './slices/pr-writes/state';
import { createSessionSyncSlice } from './slices/session-sync';
import { sessionSyncInitialState } from './slices/session-sync/state';
import { createIssueBriefsSlice } from './slices/issue-briefs';
import { issueBriefsInitialState } from './slices/issue-briefs/state';
import { createDurationEstimatesSlice } from './slices/durationEstimates';
import { durationEstimatesInitialState } from './slices/durationEstimates/state';
import { createProviderLimitsSlice } from './slices/providerLimits';
import { providerLimitsInitialState } from './slices/providerLimits/state';
import { createSentryLinksSlice } from './slices/sentryLinks';
import { sentryLinksInitialState } from './slices/sentryLinks/state';
import { createHandoffsSlice } from './slices/handoffs';
import { createSecurityFindingsSlice } from './slices/security-findings';
import { createBranchCleanupSlice } from './slices/branch-cleanup';
import { createStarredIssuesSlice } from './slices/starred-issues';
import { createSearchIndexSlice } from './slices/search-index';
import { createChatsSlice } from './slices/chats';
import { handoffsInitialState } from './slices/handoffs/state';
import type {
  CreatePrSeriesInput,
  LoadPrSeriesInput,
  SetPrSeriesMemberInput,
} from './slices/pr-series';
import { createPresenceSlice } from './slices/presence';
import { createTurnSlice } from './slices/turn';
import { createWorktreesSlice } from './slices/worktrees';
import { createBootSlice } from './slices/boot';
import { createUpdaterSlice } from './slices/updater';
import { initialUpdaterState } from './slices/updater/state';
import { createChangelogSlice } from './slices/changelog';
import { initialChangelogState } from './slices/changelog/state';
import { createBugReportDraftSlice } from './slices/bugReportDraft';
import { createSessionDraftSlice } from './slices/sessionDraft';
import { createContextDrawerSlice } from './slices/contextDrawer';
import { initialContextDrawerState } from './slices/contextDrawer/state';
import { createDecisionsSlice } from './slices/decisions';
import { initialDecisionsState } from './slices/decisions/state';
import { initialSessionDraftState } from './slices/sessionDraft/state';
import { createDrawerSlice } from './slices/drawer';
import { createNavigationSlice } from './slices/navigation';
import { initialNavigationState } from './slices/navigation/types';
import { initialDrawerState } from './slices/drawer/state';
import { initialBugReportDraftState } from './slices/bugReportDraft/state';
import type { LinearViewer } from '../features/integrations/linear/client';
import type { SentryProject } from '../features/integrations/sentry/client';
import type { GitlabUser } from '../features/integrations/gitlab/client';
import type { BitbucketConnection } from '../features/integrations/bitbucket/client';
import type { SlackConnection } from '../features/integrations/slack/client';
import type { JiraUser } from '../features/integrations/jira/client';
import type { ProviderSpendEntry } from './slices/budget';
import type { AppState } from './types';
export type { ProviderSpendEntry };
export type { AppState } from './types';

type AppActions = {
  loadIntegrations(workspaceId: WorkspaceId): Promise<void>;
  loadIntegrationCredentials(): Promise<void>;
  forgetIntegrationCredential(params: { credentialId: IntegrationCredentialId }): Promise<void>;
  disconnectIntegration(params: {
    workspaceId: WorkspaceId;
    provider: WorkspaceIntegrationProvider;
  }): Promise<void>;
  connectLinear(params: {
    workspaceId: WorkspaceId;
    token: string | null;
    credentialId: IntegrationCredentialId | null;
  }): Promise<LinearViewer>;
  connectSentry(params: {
    workspaceId: WorkspaceId;
    token: string | null;
    org: string | null;
    project: string | null;
    credentialId: IntegrationCredentialId | null;
  }): Promise<SentryProject>;
  connectGitlab(params: {
    workspaceId: WorkspaceId;
    host: string;
    token: string | null;
    credentialId: IntegrationCredentialId | null;
  }): Promise<GitlabUser>;
  connectJira(params: {
    workspaceId: WorkspaceId;
    siteUrl: string;
    email: string;
    projectKey: string;
    apiToken: string | null;
    credentialId: IntegrationCredentialId | null;
  }): Promise<JiraUser>;
  connectBitbucket(params: {
    workspaceId: WorkspaceId;
    workspaceSlug: string;
    email: string;
    apiToken: string | null;
    credentialId: IntegrationCredentialId | null;
  }): Promise<BitbucketConnection>;
  connectSlack(params: {
    workspaceId: WorkspaceId;
    userToken: string | null;
    credentialId: IntegrationCredentialId | null;
  }): Promise<SlackConnection>;
  updateSlackConfig(params: {
    workspaceId: WorkspaceId;
    config: SlackIntegrationConfig;
  }): Promise<void>;
  rebaseBranch(input: HistoryMountInput): Promise<RebaseBranchOutcome>;
  applyHistoryRewrite(input: ApplyHistoryRewriteInput): Promise<ApplyHistoryRewriteOutcome>;
  pushHistoryRewrite(input: {
    sessionId: SessionId;
    mountId: MountId;
    origin: HistoryRunOrigin;
    planId: string | null;
    expectedRemoteSha: string | null;
    identity: HistoryIdentity | null;
  }): Promise<ApplyHistoryRewriteOutcome>;
  startHistoryRewriter(input: StartHistoryRewriterInput): Promise<StartHistoryRewriterOutcome>;
  settleHistoryRewriter(input: SettleHistoryRewriterInput): Promise<void>;
  loadHistoryDraft(input: HistoryMountInput): Promise<void>;
  editHistoryDraft(input: EditHistoryDraftInput): Promise<void>;
  undoHistoryDraft(input: HistoryMountInput): Promise<boolean>;
  discardHistoryDraft(input: HistoryMountInput): Promise<void>;
  dismissHistoryRun(input: HistoryMountInput): void;
  applyHistoryDraft(input: ApplyHistoryDraftInput): Promise<ApplyHistoryRewriteOutcome>;
  applyRewrittenHistory(input: ApplyHistoryDraftInput): Promise<ApplyHistoryRewriteOutcome>;
  rewriteDraftWithAgent(input: HistoryMountInput & { note?: string }): Promise<void>;
  restoreHistory(input: RestoreHistoryInput): Promise<RestoreHistoryOutcome>;
  bringOriginIntoHistory(input: HistoryMountInput): Promise<BringOriginOutcome>;
  requestScribe(input: RequestScribeInput): Promise<string>;
  settleScribe(input: SettleScribeInput): Promise<void>;
  refreshPrDescription(input: { sessionId: SessionId; mountId: MountId }): Promise<boolean>;
  createPrSeries(input: CreatePrSeriesInput): Promise<PrSeries>;
  setPrSeriesMember(input: SetPrSeriesMemberInput): Promise<PrSeriesMember>;
  loadPrSeries(input: LoadPrSeriesInput): Promise<ReadonlyArray<PrSeriesView>>;
  refreshGithubStatus(): Promise<void>;
  refreshGithubConnection(params: { readonly workspaceId: WorkspaceId | null }): Promise<void>;
  setGithubToken(params: {
    readonly token: string;
    readonly workspaceId: WorkspaceId | null;
  }): Promise<GhTokenStatus>;
  clearGithubToken(params: { readonly workspaceId: WorkspaceId | null }): Promise<void>;
  refreshSessionPr(sessionId: SessionId, opts?: RefreshPrOptions): Promise<void>;
  refreshSessionPrDetail(
    sessionId: SessionId,
    opts?: { mountId?: MountId; force?: boolean; silent?: boolean; retries?: number },
  ): Promise<void>;
  selectSessionPr(sessionId: SessionId, prNumber: number, mountId?: MountId): Promise<void>;
  sweepGithub(opts?: { skipUnknownPr?: boolean }): void;
  pushSessionBranch(input: {
    sessionId: SessionId;
    mountId: MountId;
  }): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }>;
  createPrForSession(input: CreatePrInput): Promise<void>;
  markPrReady(sessionId: SessionId, prNumber?: number, opts?: PrWriteOptions): Promise<void>;
  convertPrToDraft(sessionId: SessionId, prNumber?: number): Promise<void>;
  mergePr(
    sessionId: SessionId,
    prNumber?: number,
    method?: PrMergeMethod,
    opts?: PrWriteOptions,
  ): Promise<void>;
  refreshSessionMr(sessionId: SessionId, opts?: RefreshMrOptions): Promise<void>;
  loadReviewDrafts(sessionId: SessionId): Promise<void>;
  addReviewDraft(input: AddReviewDraftInput): Promise<PrReviewDraft>;
  updateReviewDraft(id: string, body: string): Promise<void>;
  discardReviewDraft(id: string): Promise<void>;
  queueAgentReviewComments(
    sessionId: SessionId,
    agentId: AgentId,
    markers: ReadonlyArray<ExtractedReviewComment>,
  ): Promise<void>;
  publishPrReview(sessionId: SessionId, opts: PublishPrReviewOpts): Promise<PublishPrReviewResult>;
  setReviewSubmission(params: {
    readonly sessionId: SessionId;
    readonly patch: Partial<ReviewSubmission>;
  }): void;
  submitReview(params: { readonly sessionId: SessionId }): Promise<PublishPrReviewResult>;
  discardReview(params: { readonly sessionId: SessionId }): Promise<void>;
  createMrForSession(input: CreateMrInput): Promise<void>;
  mergeMrForSession(input: MergeMrInput): Promise<void>;
  refreshSessionBitbucketPr(
    sessionId: SessionId,
    opts?: RefreshSessionBitbucketPrOptions,
  ): Promise<void>;
  selectSessionBitbucketPr(
    sessionId: SessionId,
    pullRequestId: number | null,
    mountId?: MountId,
  ): Promise<void>;
  approveBitbucketPr(params: BitbucketPrWriteParams): Promise<void>;
  unapproveBitbucketPr(params: BitbucketPrWriteParams): Promise<void>;
  requestBitbucketPrChanges(params: BitbucketPrWriteParams): Promise<void>;
  withdrawBitbucketPrChanges(params: BitbucketPrWriteParams): Promise<void>;
  mergeBitbucketPr(params: BitbucketPrWriteParams): Promise<void>;
  declineBitbucketPr(params: BitbucketPrWriteParams): Promise<void>;
  commentOnBitbucketPr(params: BitbucketPrCommentParams): Promise<void>;
  replyToBitbucketPrComment(params: BitbucketPrReplyParams): Promise<void>;
  refreshSlackChannels(params: SlackWorkspaceParams): Promise<void>;
  refreshSlackUsers(params: SlackWorkspaceParams): Promise<void>;
  refreshSlackThreadHeads(params: SlackChannelParams): Promise<void>;
  refreshSlackThread(params: SlackThreadParams, options?: RefreshSlackThreadOptions): Promise<void>;
  replyToSlackThread(params: SlackReplyParams): Promise<void>;
  addSlackReaction(params: SlackReactionParams): Promise<void>;
  closePr(sessionId: SessionId, prNumber?: number): Promise<void>;
  reopenPr(sessionId: SessionId, prNumber?: number): Promise<void>;
  editPr(
    sessionId: SessionId,
    prNumber: number,
    opts: { title?: string; body?: string },
  ): Promise<void>;
  requestReview(
    sessionId: SessionId,
    prNumber: number,
    reviewers: ReadonlyArray<string>,
  ): Promise<void>;
  loadDiffComments(sessionId: SessionId): Promise<void>;
  addDiffComment(
    sessionId: SessionId,
    filePath: string,
    body: string,
    anchor?: import('@goodboy/types').DiffCommentAnchor,
    author?: import('@goodboy/db').DiffCommentAuthor,
  ): Promise<void>;
  resolveDiffComment(sessionId: SessionId, commentId: string): Promise<void>;
  reopenDiffComment(sessionId: SessionId, commentId: string): Promise<void>;
  deleteDiffComment(sessionId: SessionId, commentId: string): Promise<void>;
  loadSessionFileVersions(params: { sessionId: SessionId; force?: boolean }): Promise<void>;
  selectSessionFileVersionPath(params: { sessionId: SessionId; relativePath: string | null }): void;
  restoreSessionFileVersion(params: {
    sessionId: SessionId;
    versionId: FileVersionId;
    sessionDir: string;
  }): Promise<void>;
  deleteSessionFileVersion(params: {
    sessionId: SessionId;
    versionId: FileVersionId;
  }): Promise<void>;
  deleteAllSessionFileVersions(params: { sessionId: SessionId }): Promise<void>;
  loadSessionSlackDrafts(sessionId: SessionId): Promise<void>;
  decideSessionSlackDraft(params: DecideSessionSlackDraftParams): Promise<void>;
};

export type AppStore = AppState &
  AppActions &
  ReturnType<typeof createArtifactsSlice> &
  ReturnType<typeof createResolveSlice> &
  ReturnType<typeof createReviewNavigationSlice> &
  ReturnType<typeof createPrWritesSlice> &
  ReturnType<typeof createSessionSyncSlice> &
  ReturnType<typeof createIssueBriefsSlice> &
  ReturnType<typeof createDurationEstimatesSlice> &
  ReturnType<typeof createProviderLimitsSlice> &
  ReturnType<typeof createProjectRelocationSlice> &
  ReturnType<typeof createBackupSlice> &
  ReturnType<typeof createSentryLinksSlice> &
  ReturnType<typeof createStorageSlice> &
  ReturnType<typeof createHandoffsSlice> &
  ReturnType<typeof createSecurityFindingsSlice> &
  ReturnType<typeof createBranchCleanupSlice> &
  ReturnType<typeof createStarredIssuesSlice> &
  ReturnType<typeof createSearchIndexSlice> &
  ReturnType<typeof createChatsSlice> &
  ReturnType<typeof createUpdaterSlice> &
  ReturnType<typeof createChangelogSlice> &
  ReturnType<typeof createBugReportDraftSlice> &
  ReturnType<typeof createSessionDraftSlice> &
  ReturnType<typeof createContextDrawerSlice> &
  ReturnType<typeof createDecisionsSlice> &
  ReturnType<typeof createDrawerSlice> &
  ReturnType<typeof createNavigationSlice> &
  ReturnType<typeof createSidebarSlice> &
  ReturnType<typeof createSessionFiltersSlice> &
  ReturnType<typeof createSettingsSlice> &
  ReturnType<typeof createBootSlice> &
  ReturnType<typeof createPresenceSlice> &
  ReturnType<typeof createNotificationsSlice> &
  ReturnType<typeof createNudgesSlice> &
  ReturnType<typeof createTerminalSlice> &
  ReturnType<typeof createScriptsSlice> &
  ReturnType<typeof createPermissionsSlice> &
  ReturnType<typeof createSessionViewSlice> &
  ReturnType<typeof createSessionsSlice> &
  ReturnType<typeof createTranscriptsSlice> &
  ReturnType<typeof createSummariesSlice> &
  ReturnType<typeof createSessionEventsSlice> &
  ReturnType<typeof createAttachmentsSlice> &
  ReturnType<typeof createWorktreesSlice> &
  ReturnType<typeof createTurnSlice> &
  ReturnType<typeof createAgentsSlice> &
  ReturnType<typeof createAgentQueueSlice> &
  ReturnType<typeof createWorkspacesSlice> &
  ReturnType<typeof createProjectsSlice> &
  ReturnType<typeof createProjectMountsSlice> &
  ReturnType<typeof createMountCleanupSlice> &
  ReturnType<typeof createWorkflowsSlice> &
  ReturnType<typeof createWorkflowDraftsSlice> &
  ReturnType<typeof createWorkflowStudioSlice> &
  ReturnType<typeof createWorkflowRoutingSlice> &
  ReturnType<typeof createSlotsSlice> &
  ReturnType<typeof createOverridesSlice> &
  ReturnType<typeof createCredentialsSlice> &
  ReturnType<typeof createProvidersSlice> &
  ReturnType<typeof createPlansSlice> &
  ReturnType<typeof createOpenQuestionsSlice> &
  ReturnType<typeof createArtifactDraftsSlice> &
  ReturnType<typeof createSkillsSlice> &
  ReturnType<typeof createBudgetSlice>;

export const initialState: AppState = {
  ...initialUpdaterState,
  ...initialChangelogState,
  ...initialBugReportDraftState,
  ...initialSessionDraftState,
  ...initialContextDrawerState,
  ...initialDecisionsState,
  ...initialDrawerState,
  ...initialNavigationState,
  ...initialScriptsState,
  ...projectRelocationInitialState,
  ...backupInitialState,
  ...budgetInitialState,
  ...createInitialSessionViewState({}),
  selectedProjectIds: {},
  workspaces: [],
  disconnectedWorkspaces: [],
  projects: [],
  workspaceIntegrations: {},
  integrationCredentials: [],
  integrationCredentialUsage: {},
  projectGitStatus: {},
  projectCheckoutPulling: {},
  projectFetchedAt: {},
  projectCheckoutResult: {},
  sessionExternalTasks: {},
  sessionEvents: {},
  currentWorkspaceId: null,
  windowPresence: {},
  sessions: [],
  archivedSessions: {},
  currentSessionId: null,
  settings: {},
  sessionSummary: null,
  providerStatus: null,
  cursorStatus: null,
  codexStatus: null,
  geminiStatus: null,
  authResults: null,
  providers: buildProviderList({
    anthropic: null,
    cursor: null,
    codex: null,
    gemini: null,
    opencode: null,
    openrouter: null,
    moonshot: null,
  }),
  providerLifecycle: INITIAL_LIFECYCLE_MAP,
  providerConnect: INITIAL_CONNECT_MAP,
  cliRequirements: [],
  providerCredentials: [],
  providerCooldowns: {},
  hydrated: false,
  bootPhase: 'pending',
  bootFailedPhase: null,
  newerDatabase: null,
  error: null,
  transcripts: {},
  messages: {},
  sessionWorktrees: {},
  sessionWorktreeRecords: {},
  orphanWorktrees: {},
  sessionProjectMounts: {},
  ...projectMountsInitialState,
  ...mountCleanupInitialState,
  ...historyInitialState,
  ...scribeInitialState,
  ...prSeriesInitialState,
  ...prWritesInitialState,
  ...sessionSyncInitialState,
  ...issueBriefsInitialState,
  ...durationEstimatesInitialState,
  ...providerLimitsInitialState,
  ...sentryLinksInitialState,
  ...handoffsInitialState,
  sessionLanguageAnchor: {},
  sessionActiveProject: {},
  sessionBranches: {},
  sessionTelemetry: {},
  workspaceSummary: null,
  sessionSlots: {},
  slotHistory: {},
  slotHistoryCounts: {},
  sessionSlotsLoad: {},
  summarizerStatus: {},
  storageStats: null,
  storageStatsLoading: false,
  storageFolders: [],
  storageRoots: [],
  storageSizeCache: {},
  storageMeasuringPath: null,
  storageRemovingPaths: {},
  storageOutcome: null,
  storageFocus: null,
  storageScope: null,
  storageArtifacts: [],
  storageDeletingArtifacts: {},
  budgetRules: [],
  sessionBudgets: {},
  providerSpendBreakdown: [],
  budgetAlerts: [],
  skills: {},
  phaseTemplates: {},
  stepLibrary: {},
  sessionWorkflows: {},
  sessionPhaseRuns: {},
  orchestratingWorkflowRuns: {},
  decisionRestartMarks: {},
  orchestratorReadingHints: {},
  pendingOrchestrations: {},
  pendingAdvanceSessions: new Set<SessionId>(),
  announcedWorkflowBlocks: {},
  announcedRunBudget: {},
  selectedAgentId: {},
  agentRunHistory: {},
  runRouting: {},
  agentTurnState: {},
  clusterStartAttempts: {},
  clusterStepStartAttempts: {},
  workflowContinueAttempts: {},
  stepSummaryDegraded: {},
  degradedStepOutputs: {},
  scoutSelfExploreTasked: {},
  unknownPayloadCounts: {},
  detectedEditors: [],
  workspaceOverrides: {},
  sessionOverrides: {},
  unreadWorkspaceIds: new Set<WorkspaceId>(),
  sessionPanelExpanded: {},
  githubStatus: null,
  githubWorkspaceStatus: {},
  mountGithub: {},
  mountSelectedPr: {},
  sessionGithub: {},
  sessionProjectPrs: {},
  sessionSelectedPrNumber: {},
  ...initialGitlabMrState,
  ...initialBitbucketPrState,
  ...initialSlackThreadsState,
  reviewDrafts: {},
  reviewSubmission: {},
  volatilePermissionAllows: new Set<string>(),
  agentModelOverride: {},
  agentProviderOverride: {},
  agentEffortOverride: {},
  agentKindOverride: {},
  ...resolveInitialState,
  ...reviewNavigationInitialState,
  ...artifactsInitialState,
  agentDraft: {},
  workflowDrafts: {},
  artifactDrafts: {},
  ...initialWorkflowStudioState,
  ...initialWorkflowRoutingState,
  agentAttachments: {},
  agentQueue: {},
  diffComments: {},
  sessionFileVersions: {},
  sessionFileVersionsLoading: {},
  sessionFileVersionSelectedPath: {},
  sessionAttachments: {},
  workflowRunAttachments: {},
  notifications: [],
  notificationsLoading: false,
  notificationCounts: [],
  notificationScope: 'workspace',
  hasOlderNotifications: false,
  sessionPlans: {},
  sessionNudges: {},
  planConsumptions: {},
  sessionOpenQuestions: {},
  sessionAnsweredQuestions: {},
  sessionDismissedQuestions: {},
  sessionQuestionsLoadError: {},
  sessionSlackDrafts: {},
  openQuestionScrollTarget: null,
  sessionLoading: {},
  boardReady: true,
  terminalSessions: {},
  terminalTabs: {},
  activeTerminalTab: {},
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,
  ...createNotificationsSlice(set, get),
  ...createNudgesSlice(set, get),
  ...createArtifactsSlice(set, get),
  ...createPlansSlice(set, get),
  ...createOpenQuestionsSlice(set, get),
  ...createSlackDraftsSlice(set),
  ...createBudgetSlice(set, get),
  ...createSkillsSlice(set, get),
  ...createStorageSlice(set, get),
  ...createDiffCommentsSlice(set, get),
  ...createFileVersionsSlice(set, get),
  ...createSessionEventsSlice(set, get),
  ...createAttachmentsSlice(set, get),
  ...createGithubSlice(set, get),
  ...createGitlabMrSlice(set, get),
  ...createBitbucketPrSlice(set, get),
  ...createSlackThreadsSlice(set, get),
  ...createReviewDraftsSlice(set, get),
  ...createIntegrationsSlice(set, get),
  ...createSidebarSlice(set, get),
  ...createSessionViewSlice(set, get),
  ...createSessionFiltersSlice({ set, get }),
  ...createTerminalSlice(set, get),
  ...createScriptsSlice(set, get),
  ...createPermissionsSlice(set, get),
  ...createProvidersSlice(set, get),
  ...createAgentsSlice(set, get),
  ...createAgentQueueSlice(set, get),
  ...createResolveSlice({ set, get }),
  ...createReviewNavigationSlice({ set, get }),
  ...createWorkflowDraftsSlice(set, get),
  ...createArtifactDraftsSlice(set, get),
  ...createWorkflowStudioSlice(set, get),
  ...createWorkflowRoutingSlice(set, get),
  ...createSlotsSlice(set, get),
  ...createOverridesSlice(set, get),
  ...createCredentialsSlice(set, get),
  ...createWorkflowsSlice(set, get),
  ...createSettingsSlice(set),
  ...createBackupSlice(set, get),
  ...createTranscriptsSlice(set, get),
  ...createSummariesSlice(set, get),
  ...createSessionsSlice(set, get),
  ...createWorkspacesSlice(set, get),
  ...createProjectsSlice(set, get),
  ...createProjectRelocationSlice(set, get),
  ...createProjectMountsSlice(set, get),
  ...createMountCleanupSlice(set, get),
  ...createHistorySlice(set, get),
  ...createScribeSlice(set, get),
  ...createPrSeriesSlice(set, get),
  ...createPrWritesSlice(set, get),
  ...createSessionSyncSlice(set, get),
  ...createIssueBriefsSlice(set, get),
  ...createDurationEstimatesSlice(set, get),
  ...createProviderLimitsSlice(set, get),
  ...createSentryLinksSlice(set, get),
  ...createHandoffsSlice(set, get),
  ...createSecurityFindingsSlice(set, get),
  ...createBranchCleanupSlice(set, get),
  ...createStarredIssuesSlice(set, get),
  ...createSearchIndexSlice(set, get),
  ...createChatsSlice(set, get),
  ...createPresenceSlice(set, get),
  ...createTurnSlice(set, get),
  ...createWorktreesSlice(set, get),
  ...createBootSlice(set, get),
  ...createUpdaterSlice(set, get),
  ...createChangelogSlice(set, get),
  ...createBugReportDraftSlice(set, get),
  ...createSessionDraftSlice(set, get),
  ...createContextDrawerSlice(set, get),
  ...createDecisionsSlice(set, get),
  ...createDrawerSlice(set, get),
  ...createNavigationSlice(set, get),
}));
