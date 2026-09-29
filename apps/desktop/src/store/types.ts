import type { ArtifactsState } from './slices/artifacts/state';
import type { ExecutedAgentRouting } from './slices/turn/executedAgentRouting';
import type { ResolveState } from './slices/resolve/state';
import type { ReviewNavigationState } from './slices/review-navigation/state';
import type {
  StorageArtifact,
  StorageFocus,
  StorageScope,
  StorageFolder,
  StorageRemovalSummary,
  StorageRoot,
  StorageSizeCache,
  StorageStats,
} from './slices/storage/types';
import type { MountCleanupState } from './slices/mount-cleanup/state';
import type { HistoryState } from './slices/history/state';
import type { ScribeState } from './slices/scribe/state';
import type { PrSeriesState } from './slices/pr-series/state';
import type { PrWritesState } from './slices/pr-writes/state';
import type { SessionSyncState } from './slices/session-sync/state';
import type { IssueBriefsState } from './slices/issue-briefs/state';
import type { DurationEstimatesState } from './slices/durationEstimates/state';
import type { ProviderLimitsState } from './slices/providerLimits/state';
import type { ProjectRelocationState } from './slices/project-relocation/state';
import type { BackupState } from './slices/backup/state';
import type { SentryLinksState } from './slices/sentryLinks/state';
import type { Notification, NotificationCountBucket } from '@goodboy/db';
import type {
  Agent,
  AgentId,
  ArtifactId,
  BudgetAlert,
  BudgetRule,
  ContextSlot,
  ContextSlotHistoryEntry,
  DiffComment,
  EffortLevel,
  FileVersion,
  GhTokenStatus,
  GoalAttachment,
  IntegrationDraft,
  IsoDateTime,
  LinkedIssue,
  MountId,
  MountPullRequestIdentity,
  MountPullRequestLink,
  OpenQuestion,
  OpenQuestionId,
  OrchestratorRouting,
  PlanConsumption,
  PlanId,
  PlanWithCount,
  PrDetail,
  ProjectId,
  ProjectScript,
  ProviderId,
  ProviderRunId,
  PrReviewDraft,
  PullRequestState,
  SessionBudget,
  SessionId,
  SessionViewPrefs,
  Skill,
  StepDef,
  TurnState,
  Workflow,
  WorkflowRunId,
  WorkspaceId,
  WorkflowId,
} from '@goodboy/types';
import type { AgentKind } from '../features/session/agent-kind';
import type { GitlabMergeRequest } from '../features/integrations/gitlab/client';
import type {
  BitbucketPullRequest,
  BitbucketRepo,
} from '../features/integrations/bitbucket/client';
import type { SessionBitbucketPrEntry } from './slices/bitbucket-pr/state';
import type { SlackThreadsSliceState } from './slices/slack-threads/state';
import type { ScriptGroup, ScriptRunRecord } from '../features/scripts/scripts';
import type { DiscoveredScriptScan } from './slices/scripts/state';
import type { TerminalTab, TerminalTabId } from '../shared/types/terminal';
import type { DraftAttachment } from './slices/agents/setAgentAttachments';
import type { AgentQueuedTurn } from './slices/agentQueue/types';
import type { ProviderSpendEntry } from './slices/budget';
import type { BudgetSliceState } from './slices/budget/state';
import type { BugReportDraftState } from './slices/bugReportDraft/state';
import type { SessionDraftState } from './slices/sessionDraft/state';
import type { ContextDrawerSliceState } from './slices/contextDrawer/state';
import type { DecisionsSliceState } from './slices/decisions/state';
import type { DrawerSliceState } from './slices/drawer/state';
import type { NavigationSliceState } from './slices/navigation/types';
import type { ChangelogState } from './slices/changelog/state';
import type { ArtifactFilter } from '../features/artifacts/artifactCollection';
import type { ResolveItemDraft } from '../features/resolve/resolveItemDraft';
import type { ReviewSubmission } from './slices/review-drafts/reviewSubmission';
import type {
  ArtifactCreationTarget,
  DiffFocus,
  FocusedExternalTask,
  LensKind,
  ResolveQueueView,
  SessionCreation,
  SessionStudio,
} from './slices/session-view';
import type { UpdaterState } from './slices/updater/state';
import type { WorkflowBuilderDraft, WorkflowDraftKey } from './slices/workflowDrafts/types';
import type { SessionArtifactDrafts } from './slices/artifactDrafts/types';
import type { WorkflowGeneration, WorkflowStudioDraft } from './slices/workflowStudio/types';
import type { SessionFiltersState } from './slices/sessionFilters/state';
import type { WorkspacesState } from './slices/workspaces/state';
import type { ProjectsState } from './slices/projects/state';
import type { SessionsState } from './slices/sessions/state';
import type { SessionEventsState } from './slices/session-events/state';
import type { PresenceState } from './slices/presence/state';
import type { SettingsState } from './slices/settings/state';
import type { ProvidersState } from './slices/providers/state';
import type { CredentialsState } from './slices/credentials/state';
import type { IntegrationsState } from './slices/integrations/state';
import type { BootState } from './slices/boot/state';
import type { TranscriptsState } from './slices/transcripts/state';
import type { WorktreesState } from './slices/worktrees/state';
import type { ProjectMountsState } from './slices/project-mounts/state';
import type { OverridesState } from './slices/overrides/state';
import type { SidebarState } from './slices/sidebar/state';

export type SessionNudge =
  | {
      readonly kind: 'plan-ready';
      readonly id: string;
      readonly agentId: AgentId;
      readonly planId: PlanId | null;
      readonly planTitle: string;
    }
  | {
      readonly kind: 'handoff-suggested';
      readonly id: string;
      readonly agentId: AgentId;
      readonly targetKind: AgentKind;
      readonly reason: string;
      readonly planId: PlanId | null;
    };

export type SessionSlotsLoad = 'loaded' | 'failed';

export type SessionGitlabMrState = {
  readonly mr: GitlabMergeRequest | null;
  readonly fetchedAt: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
};

export type SessionGithubState = {
  readonly pr: PullRequestState | null;
  readonly linkedIssues: ReadonlyArray<LinkedIssue>;
  readonly fetchedAt: IsoDateTime | null;
  readonly failedAt: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly detail: PrDetail | null;
  readonly detailFetchedAt: IsoDateTime | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
};

export type MountGithubState = SessionGithubState & {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly revision: number;
  readonly repository: string | null;
  readonly host: string | null;
  readonly branch: string;
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly links: ReadonlyArray<MountPullRequestLink>;
};

export type MountGitlabMrState = SessionGitlabMrState & {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly revision: number;
  readonly host: string | null;
  readonly projectPath: string | null;
  readonly branch: string;
  readonly mrs: ReadonlyArray<GitlabMergeRequest>;
  readonly links: ReadonlyArray<MountPullRequestLink>;
};

export type MountBitbucketPrState = SessionBitbucketPrEntry & {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly revision: number;
  readonly host: string | null;
  readonly repo: BitbucketRepo | null;
  readonly repository: string | null;
  readonly branch: string;
  readonly prs: ReadonlyArray<BitbucketPullRequest>;
  readonly links: ReadonlyArray<MountPullRequestLink>;
};

export type SummarizerSessionStatus = {
  readonly status: 'idle' | 'running' | 'error';
  readonly lastUpdate: IsoDateTime | null;
  readonly error: string | null;
  readonly lastUsage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsd: number;
  } | null;
  readonly lastAttempt: {
    readonly turnInput: string;
    readonly turnOutput: string;
    readonly workingDir: string | null;
  } | null;
};

type PendingOrchestration = {
  readonly sessionId: SessionId;
  readonly bypassGate: boolean;
  readonly routing?: OrchestratorRouting;
};

type AppSliceState = ArtifactsState &
  BudgetSliceState &
  ResolveState &
  ReviewNavigationState &
  PrWritesState &
  SessionSyncState &
  IssueBriefsState &
  DurationEstimatesState &
  ProviderLimitsState &
  ProjectRelocationState &
  BackupState &
  SentryLinksState &
  UpdaterState &
  ChangelogState &
  SlackThreadsSliceState &
  BugReportDraftState &
  SessionDraftState &
  ContextDrawerSliceState &
  DecisionsSliceState &
  DrawerSliceState &
  NavigationSliceState &
  SessionFiltersState &
  WorkspacesState &
  ProjectsState &
  SessionsState &
  SessionEventsState &
  PresenceState &
  SettingsState &
  ProvidersState &
  CredentialsState &
  IntegrationsState &
  BootState &
  TranscriptsState &
  WorktreesState &
  ProjectMountsState &
  MountCleanupState &
  HistoryState &
  ScribeState &
  PrSeriesState &
  OverridesState &
  SidebarState;

export type NotificationScope = 'workspace' | 'all';

export type AppState = AppSliceState & {
  readonly sessionLanguageAnchor: Readonly<Record<SessionId, string>>;
  readonly sessionSlots: Readonly<Record<string, ReadonlyArray<ContextSlot>>>;
  readonly slotHistory: Readonly<
    Record<string, Readonly<Record<string, ReadonlyArray<ContextSlotHistoryEntry>>>>
  >;
  readonly slotHistoryCounts: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly sessionSlotsLoad: Readonly<Record<string, SessionSlotsLoad>>;
  readonly summarizerStatus: Readonly<Record<string, SummarizerSessionStatus>>;
  readonly storageStats: StorageStats | null;
  readonly storageStatsLoading: boolean;
  readonly storageFolders: ReadonlyArray<StorageFolder>;
  readonly storageRoots: ReadonlyArray<StorageRoot>;
  readonly storageSizeCache: StorageSizeCache;
  readonly storageMeasuringPath: string | null;
  readonly storageRemovingPaths: Readonly<Record<string, true>>;
  readonly storageOutcome: StorageRemovalSummary | null;
  readonly storageFocus: StorageFocus | null;
  readonly storageScope: StorageScope | null;
  readonly storageArtifacts: ReadonlyArray<StorageArtifact>;
  readonly storageDeletingArtifacts: Readonly<Record<string, true>>;
  readonly budgetRules: ReadonlyArray<BudgetRule>;
  readonly sessionBudgets: Readonly<Record<SessionId, SessionBudget>>;
  readonly providerSpendBreakdown: ReadonlyArray<ProviderSpendEntry>;
  readonly budgetAlerts: ReadonlyArray<BudgetAlert>;
  readonly skills: Readonly<Record<WorkspaceId, ReadonlyArray<Skill>>>;
  readonly projectScripts: Readonly<Record<WorkspaceId, ReadonlyArray<ProjectScript>>>;
  readonly scriptRuns: Readonly<Record<SessionId, Readonly<Record<string, ScriptRunRecord>>>>;
  readonly discoveredScripts: Readonly<
    Record<SessionId, Readonly<Record<string, ReadonlyArray<ScriptGroup>>>>
  >;
  readonly discoveredScriptScans: Readonly<
    Record<SessionId, Readonly<Record<string, DiscoveredScriptScan>>>
  >;
  readonly phaseTemplates: Readonly<Record<WorkspaceId, ReadonlyArray<Workflow>>>;
  readonly stepLibrary: Readonly<Record<WorkspaceId, ReadonlyArray<StepDef>>>;
  readonly sessionWorkflows: Readonly<Record<SessionId, ReadonlyArray<Workflow>>>;
  readonly sessionPhaseRuns: Readonly<Record<SessionId, ReadonlyArray<Agent>>>;
  readonly orchestratingWorkflowRuns: Readonly<Record<WorkflowRunId, boolean>>;
  readonly decisionRestartMarks: Readonly<Record<WorkflowRunId, number>>;
  readonly orchestratorReadingHints: Readonly<Record<WorkflowRunId, ReadonlyArray<string>>>;
  readonly pendingOrchestrations: Readonly<Record<WorkflowRunId, PendingOrchestration>>;
  readonly pendingAdvanceSessions: ReadonlySet<SessionId>;
  readonly announcedWorkflowBlocks: Readonly<Record<WorkflowRunId, string>>;
  readonly announcedRunBudget: Readonly<Record<WorkflowRunId, number>>;
  readonly selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
  readonly agentRunHistory: Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>>;
  readonly runRouting: Readonly<
    Record<AgentId, Readonly<Record<ProviderRunId, ExecutedAgentRouting>>>
  >;
  readonly agentTurnState: Readonly<Record<AgentId, TurnState>>;
  readonly clusterStartAttempts: Readonly<Record<AgentId, number>>;
  readonly clusterStepStartAttempts: Readonly<Record<AgentId, number>>;
  readonly workflowContinueAttempts: Readonly<Record<AgentId, number>>;
  readonly stepSummaryDegraded: Readonly<Record<AgentId, boolean>>;
  readonly degradedStepOutputs: Readonly<Record<AgentId, string>>;
  readonly scoutSelfExploreTasked: Readonly<Record<AgentId, true>>;
  readonly githubStatus: GhTokenStatus | null;
  readonly githubWorkspaceStatus: Readonly<Record<WorkspaceId, GhTokenStatus | null>>;
  readonly mountGithub: Readonly<Record<MountId, MountGithubState>>;
  readonly mountSelectedPr: Readonly<Record<MountId, MountPullRequestIdentity | null>>;
  readonly sessionGithub: Readonly<Record<SessionId, SessionGithubState>>;
  readonly sessionProjectPrs: Readonly<
    Record<SessionId, Readonly<Record<ProjectId, ReadonlyArray<PullRequestState>>>>
  >;
  readonly sessionSelectedPrNumber: Readonly<Record<SessionId, number | null>>;
  readonly mountGitlabMr: Readonly<Record<MountId, MountGitlabMrState>>;
  readonly sessionGitlabMr: Readonly<Record<SessionId, SessionGitlabMrState>>;
  readonly mountBitbucketPr: Readonly<Record<MountId, MountBitbucketPrState>>;
  readonly mountSelectedBitbucketPr: Readonly<Record<MountId, MountPullRequestIdentity | null>>;
  readonly sessionBitbucketPr: Readonly<Record<SessionId, SessionBitbucketPrEntry>>;
  readonly sessionBitbucketRepo: Readonly<Record<SessionId, BitbucketRepo>>;
  readonly reviewDrafts: Readonly<Record<SessionId, ReadonlyArray<PrReviewDraft>>>;
  readonly reviewSubmission: Readonly<Record<SessionId, ReviewSubmission>>;
  readonly volatilePermissionAllows: ReadonlySet<string>;
  readonly agentModelOverride: Readonly<Record<AgentId, string>>;
  readonly agentProviderOverride: Readonly<Record<AgentId, ProviderId>>;
  readonly agentEffortOverride: Readonly<Record<AgentId, EffortLevel>>;
  readonly agentKindOverride: Readonly<Record<AgentId, AgentKind>>;
  readonly agentDraft: Readonly<Record<AgentId, string>>;
  readonly workflowDrafts: Readonly<Record<WorkflowDraftKey, WorkflowBuilderDraft | undefined>>;
  readonly artifactDrafts: Readonly<Record<SessionId, SessionArtifactDrafts>>;
  readonly workflowStudioDrafts: Readonly<Record<WorkspaceId, WorkflowStudioDraft | undefined>>;
  readonly workflowGenerations: Readonly<Record<WorkspaceId, WorkflowGeneration | undefined>>;
  readonly visibleWorkflowStudioWorkspaceId: WorkspaceId | null;
  readonly workflowStudioFocus: WorkflowId | null;
  readonly workflowNodeRoutingPending: Readonly<Record<string, boolean>>;
  readonly workflowNodeRoutingErrors: Readonly<Record<string, string | null>>;
  readonly agentAttachments: Readonly<Record<AgentId, ReadonlyArray<DraftAttachment>>>;
  readonly agentQueue: Readonly<Record<AgentId, ReadonlyArray<AgentQueuedTurn>>>;
  readonly diffComments: Readonly<Record<string, ReadonlyArray<DiffComment>>>;
  readonly sessionFileVersions: Readonly<Record<SessionId, ReadonlyArray<FileVersion> | undefined>>;
  readonly sessionFileVersionsLoading: Readonly<Record<SessionId, boolean>>;
  readonly sessionFileVersionSelectedPath: Readonly<Record<SessionId, string | null>>;
  readonly sessionAttachments: Readonly<Record<SessionId, ReadonlyArray<GoalAttachment>>>;
  readonly workflowRunAttachments: Readonly<Record<WorkflowRunId, ReadonlyArray<GoalAttachment>>>;
  readonly notifications: ReadonlyArray<Notification>;
  readonly notificationsLoading: boolean;
  readonly notificationCounts: ReadonlyArray<NotificationCountBucket>;
  readonly notificationScope: NotificationScope;
  readonly hasOlderNotifications: boolean;
  readonly sessionPlans: Readonly<Record<SessionId, ReadonlyArray<PlanWithCount>>>;
  readonly planConsumptions: Readonly<Record<PlanId, ReadonlyArray<PlanConsumption>>>;
  readonly sessionOpenQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly sessionAnsweredQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly sessionDismissedQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly sessionQuestionsLoadError: Readonly<Record<SessionId, string | undefined>>;
  readonly sessionSlackDrafts: Readonly<Record<SessionId, ReadonlyArray<IntegrationDraft>>>;
  readonly openQuestionScrollTarget: {
    readonly agentId: AgentId;
    readonly questionId: OpenQuestionId;
  } | null;
  readonly sessionNudges: Readonly<Record<SessionId, SessionNudge | null>>;
  readonly scriptsLensScope: { readonly projectId: ProjectId } | null;
  readonly sessionViewPrefs: Readonly<Record<WorkspaceId, SessionViewPrefs>>;
  readonly activeLens: Readonly<Record<SessionId, LensKind | null>>;
  readonly workflowExpand: Readonly<Record<SessionId, Readonly<Record<string, boolean>>>>;
  readonly focusedWorkflowRunId: Readonly<Record<SessionId, string | null>>;
  readonly diffFocus: Readonly<Record<SessionId, DiffFocus | null>>;
  readonly diffMountPath: Readonly<Record<SessionId, string | null>>;
  readonly diffPage: Readonly<Record<SessionId, 'history' | null>>;
  readonly terminalMountPath: Readonly<Record<SessionId, string | null>>;
  readonly resolveQueueView: Readonly<Record<SessionId, ResolveQueueView>>;
  readonly resolveItemDrafts: Readonly<
    Record<SessionId, Readonly<Record<string, ResolveItemDraft>>>
  >;
  readonly sessionCreations: Readonly<Record<SessionId, ReadonlyArray<SessionCreation>>>;
  readonly revealedActivityRows: Readonly<Record<SessionId, ReadonlySet<string>>>;
  readonly sessionGroupExpanded: Readonly<Record<string, boolean>>;
  readonly sessionStudio: Readonly<Record<SessionId, SessionStudio | null>>;
  readonly focusedArtifactId: Readonly<Record<SessionId, ArtifactId | null>>;
  readonly artifactFilter: Readonly<Record<SessionId, ArtifactFilter>>;
  readonly artifactConversationAgentId: Readonly<Record<SessionId, AgentId | null>>;
  readonly artifactCreation: Readonly<Record<SessionId, ArtifactCreationTarget | null>>;
  readonly focusedGithubIssueNumber: Readonly<Record<SessionId, number | null>>;
  readonly focusedExternalTask: Readonly<Record<SessionId, FocusedExternalTask | null>>;
  readonly terminalSessions: Readonly<Record<SessionId, 'open' | 'closed'>>;
  readonly terminalTabs: Readonly<Record<SessionId, readonly TerminalTab[]>>;
  readonly activeTerminalTab: Readonly<Record<SessionId, TerminalTabId | null>>;
};
