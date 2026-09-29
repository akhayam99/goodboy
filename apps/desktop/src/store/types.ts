import type { ArtifactsState } from './slices/artifacts/state';
import type { ResolveState } from './slices/resolve/state';
import type { ReviewNavigationState } from './slices/review-navigation/state';
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
  AgentId,
  ArtifactId,
  DiffComment,
  FileVersion,
  GhTokenStatus,
  IsoDateTime,
  LinkedIssue,
  MountId,
  MountPullRequestIdentity,
  MountPullRequestLink,
  PrDetail,
  ProjectId,
  PrReviewDraft,
  PullRequestState,
  SessionId,
  SessionViewPrefs,
  WorkspaceId,
} from '@goodboy/types';
import type { GitlabMergeRequest } from '../features/integrations/gitlab/client';
import type {
  BitbucketPullRequest,
  BitbucketRepo,
} from '../features/integrations/bitbucket/client';
import type { SessionBitbucketPrEntry } from './slices/bitbucket-pr/state';
import type { SlackThreadsSliceState } from './slices/slack-threads/state';
import type { TerminalTab, TerminalTabId } from '../shared/types/terminal';
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
import type { WorkflowsState } from './slices/workflows/state';
import type { AgentsState } from './slices/agents/state';
import type { AgentQueueState } from './slices/agentQueue/state';
import type { SlotsState } from './slices/slots/state';
import type { SummariesState } from './slices/summaries/state';
import type { PlansState } from './slices/plans/state';
import type { OpenQuestionsState } from './slices/open-questions/state';
import type { NudgesState } from './slices/nudges/state';
import type { SlackDraftsState } from './slices/slack-drafts/state';
import type { WorkflowDraftsState } from './slices/workflowDrafts/state';
import type { ArtifactDraftsState } from './slices/artifactDrafts/state';
import type { WorkflowStudioState } from './slices/workflowStudio/types';
import type { WorkflowRoutingState } from './slices/workflowRouting/types';
import type { PermissionsState } from './slices/permissions/state';
import type { AttachmentsState } from './slices/attachments/state';
import type { StorageState } from './slices/storage/state';
import type { SkillsState } from './slices/skills/state';
import type { ScriptsSliceState } from './slices/scripts/state';
import type { TurnSliceState } from './slices/turn/state';

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
  SidebarState &
  TurnSliceState &
  WorkflowsState &
  AgentsState &
  AgentQueueState &
  SlotsState &
  SummariesState &
  PlansState &
  OpenQuestionsState &
  NudgesState &
  SlackDraftsState &
  WorkflowDraftsState &
  ArtifactDraftsState &
  WorkflowStudioState &
  WorkflowRoutingState &
  PermissionsState &
  AttachmentsState &
  StorageState &
  SkillsState &
  ScriptsSliceState;

export type NotificationScope = 'workspace' | 'all';

export type AppState = AppSliceState & {
  readonly selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
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
  readonly diffComments: Readonly<Record<string, ReadonlyArray<DiffComment>>>;
  readonly sessionFileVersions: Readonly<Record<SessionId, ReadonlyArray<FileVersion> | undefined>>;
  readonly sessionFileVersionsLoading: Readonly<Record<SessionId, boolean>>;
  readonly sessionFileVersionSelectedPath: Readonly<Record<SessionId, string | null>>;
  readonly notifications: ReadonlyArray<Notification>;
  readonly notificationsLoading: boolean;
  readonly notificationCounts: ReadonlyArray<NotificationCountBucket>;
  readonly notificationScope: NotificationScope;
  readonly hasOlderNotifications: boolean;
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
