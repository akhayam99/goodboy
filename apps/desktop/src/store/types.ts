import type { UndoState } from './slices/undo/state';
import type { ArtifactsState } from './slices/artifacts/state';
import type { ResolveState } from './slices/resolve/state';
import type { ReviewNavigationState } from './slices/review-navigation/state';
import type { BootstrapState } from './slices/bootstrap/state';
import type { ReviewSelectionState } from './slices/review-selection/state';
import type { ReviewSourceState } from './slices/review-source/state';
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
import type {
  IsoDateTime,
  LinkedIssue,
  MountId,
  MountPullRequestLink,
  PrDetail,
  ProjectId,
  PrReviewDraft,
  PullRequestState,
  SessionId,
} from '@goodboy/types';
import type { SlackThreadsSliceState } from './slices/slack-threads/state';
import type { BudgetSliceState } from './slices/budget/state';
import type { BugReportDraftState } from './slices/bugReportDraft/state';
import type { SessionDraftState } from './slices/sessionDraft/state';
import type { ContextDrawerSliceState } from './slices/contextDrawer/state';
import type { DecisionsSliceState } from './slices/decisions/state';
import type { DrawerSliceState } from './slices/drawer/state';
import type { NavigationSliceState } from './slices/navigation/types';
import type { ChangelogState } from './slices/changelog/state';
import type { ReviewCommitsState } from './slices/reviewCommits/state';
import type { ResolveItemDraft } from '../features/resolve/resolveItemDraft';
import type { ReviewSubmission } from './slices/review-drafts/reviewSubmission';
import type { ResolveQueueView } from './slices/session-view';
import type { UpdaterState } from './slices/updater/state';
import type { SessionFiltersState } from './slices/sessionFilters/state';
import type { WorkspacesState } from './slices/workspaces/state';
import type { ProjectsState } from './slices/projects/state';
import type { SessionsState } from './slices/sessions/state';
import type { SessionEventsState } from './slices/session-events/state';
import type { ContextItemsState } from './slices/contextItems/state';
import type { DormantSpendState } from './slices/dormant-spend/state';
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
import type { SettingsLastPageState } from './slices/settings-last-page/state';
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
import type { GithubState } from './slices/github/state';
import type { GitlabMrSliceState } from './slices/gitlab-mr/state';
import type { BitbucketPrSliceState } from './slices/bitbucket-pr/state';
import type { NotificationsState } from './slices/notifications/state';
import type { DiffCommentsState } from './slices/diff-comments/state';
import type { FileVersionsState } from './slices/file-versions/state';
import type { TerminalState } from './slices/terminal/state';
import type { SessionViewState } from './slices/session-view/state';

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

type AppSliceState = ArtifactsState &
  BootstrapState &
  BudgetSliceState &
  ResolveState &
  ReviewNavigationState &
  ReviewSelectionState &
  ReviewSourceState &
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
  ReviewCommitsState &
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
  ContextItemsState &
  DormantSpendState &
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
  SettingsLastPageState &
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
  ScriptsSliceState &
  GithubState &
  GitlabMrSliceState &
  BitbucketPrSliceState &
  NotificationsState &
  DiffCommentsState &
  FileVersionsState &
  TerminalState &
  SessionViewState;

export type AppState = UndoState &
  AppSliceState & {
    readonly reviewDrafts: Readonly<Record<SessionId, ReadonlyArray<PrReviewDraft>>>;
    readonly reviewSubmission: Readonly<Record<SessionId, ReviewSubmission>>;
    readonly resolveQueueView: Readonly<Record<SessionId, ResolveQueueView>>;
    readonly resolveItemDrafts: Readonly<
      Record<SessionId, Readonly<Record<string, ResolveItemDraft>>>
    >;
  };
