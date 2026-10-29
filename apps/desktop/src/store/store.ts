import { createUndoSlice } from './slices/undo';
import { undoInitialState } from './slices/undo/state';
import { createBootstrapSlice } from './slices/bootstrap';
import { bootstrapInitialState } from './slices/bootstrap/state';
import { createFolderPurposeSlice } from './slices/folder-purpose';
import { folderPurposeInitialState } from './slices/folder-purpose/state';
import { createResolveSlice } from './slices/resolve';
import { createReviewNavigationSlice } from './slices/review-navigation';
import { createReviewBulkSlice } from './slices/review-bulk';
import { reviewBulkInitialState } from './slices/review-bulk/state';
import { createReviewLaunchSlice } from './slices/review-launch';
import { reviewLaunchInitialState } from './slices/review-launch/state';
import { createOutputHandoffsSlice } from './slices/output-handoffs';
import { outputHandoffsInitialState } from './slices/output-handoffs/state';
import { createReviewSelectionSlice } from './slices/review-selection';
import { reviewSelectionInitialState } from './slices/review-selection/state';
import { reviewNavigationInitialState } from './slices/review-navigation/state';
import { createReviewSourceSlice, reviewSourceInitialState } from './slices/review-source';
import { resolveInitialState } from './slices/resolve/state';
import { create } from 'zustand';
import { createNotificationsSlice } from './slices/notifications';
import { createTaskArrivalsSlice } from './slices/taskArrivals';
import { createNudgesSlice } from './slices/nudges';
import { createArtifactsSlice, artifactsInitialState } from './slices/artifacts';
import {
  createArtifactCommentsSlice,
  artifactCommentsInitialState,
} from './slices/artifact-comments';
import { createPlansSlice } from './slices/plans';
import { createOpenQuestionsSlice } from './slices/open-questions';
import { createSlackDraftsSlice } from './slices/slack-drafts';
import { createBudgetSlice } from './slices/budget';
import { createMonitoringSlice } from './slices/monitoring';
import { monitoringInitialState } from './slices/monitoring/state';
import { createSkillsSlice } from './slices/skills';
import { createStorageSlice } from './slices/storage';
import { createDiffCommentsSlice } from './slices/diff-comments';
import { createFileVersionsSlice } from './slices/file-versions';
import { createSessionEventsSlice } from './slices/session-events';
import { createDormantSpendSlice } from './slices/dormant-spend';
import { createAttachmentsSlice } from './slices/attachments';
import { createGithubSlice } from './slices/github';
import { createGitlabMrSlice, gitlabMrInitialState } from './slices/gitlab-mr';
import { createBitbucketPrSlice, bitbucketPrInitialState } from './slices/bitbucket-pr';
import { createSlackThreadsSlice, slackThreadsInitialState } from './slices/slack-threads';
import { createReviewDraftsSlice } from './slices/review-drafts';
import { reviewDraftsInitialState } from './slices/review-drafts/state';
import { createIntegrationsSlice } from './slices/integrations';
import { createSidebarSlice } from './slices/sidebar';
import { createSettingsLastPageSlice } from './slices/settings-last-page';
import { createLocalChecksSlice } from './slices/local-checks';
import { createChatLastOpenSlice } from './slices/chat-last-open';
import { createBranchFilesFilterSlice } from './slices/branch-files-filter';
import { createNextViewSlice } from './slices/next-view';
import { createTrackerMovesSlice } from './slices/tracker-moves';
import {
  checkFixCommitsInitialState,
  createCheckFixCommitsSlice,
} from './slices/check-fix-commits';
import { createSessionViewSlice } from './slices/session-view';
import { createSavedProjectModelsSlice } from './slices/saved-project-models';
import { savedProjectModelsInitialState } from './slices/saved-project-models/state';
import { createAutoViewSlice } from './slices/auto-view';
import { autoViewInitialState } from './slices/auto-view/state';
import { createSessionPinsSlice } from './slices/session-pins';
import { createRepoDivergenceSlice } from './slices/repo-divergence';
import { repoDivergenceInitialState } from './slices/repo-divergence/state';
import { sessionPinsInitialState } from './slices/session-pins/state';
import { createSessionFiltersSlice } from './slices/sessionFilters';
import { createInitialSessionViewState } from './slices/session-view/createInitialSessionViewState';
import { createTerminalSlice } from './slices/terminal';
import { createEndedWorkSlice } from './slices/ended-work';
import { createScriptsSlice } from './slices/scripts';
import { scriptsInitialState } from './slices/scripts/state';
import { createPermissionsSlice } from './slices/permissions';
import { createProvidersSlice } from './slices/providers';
import { createAgentsSlice } from './slices/agents';
import { createAgentQueueSlice } from './slices/agentQueue';
import { createArtifactDraftsSlice } from './slices/artifactDrafts';
import { createStartHintsSlice } from './slices/startHints';
import { createRebaseAllSlice } from './slices/rebaseAll';
import { createWorkflowStudioSlice } from './slices/workflowStudio';
import { workflowStudioInitialState } from './slices/workflowStudio/state';
import { createWorkflowRoutingSlice } from './slices/workflowRouting';
import { workflowRoutingInitialState } from './slices/workflowRouting/state';
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
import { createPrSeriesSlice, prSeriesInitialState } from './slices/pr-series';
import { createPrWritesSlice } from './slices/pr-writes';
import { createPullRequestViewSlice } from './slices/pull-request-view';
import { pullRequestViewInitialState } from './slices/pull-request-view/state';
import { prWritesInitialState } from './slices/pr-writes/state';
import { createSessionSyncSlice } from './slices/session-sync';
import { sessionSyncInitialState } from './slices/session-sync/state';
import { createIssueBriefsSlice } from './slices/issue-briefs';
import { issueBriefsInitialState } from './slices/issue-briefs/state';
import { createDurationEstimatesSlice } from './slices/durationEstimates';
import { durationEstimatesInitialState } from './slices/durationEstimates/state';
import { createLimitStopsSlice } from './slices/limitStops';
import { limitStopsInitialState } from './slices/limitStops/state';
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
import { createAskSlice } from './slices/ask';
import { handoffsInitialState } from './slices/handoffs/state';
import { createHostReachabilitySlice } from './slices/host-reachability';
import { createPresenceSlice } from './slices/presence';
import { createTurnSlice } from './slices/turn';
import { createWorktreesSlice } from './slices/worktrees';
import { createBootSlice } from './slices/boot';
import { createUpdaterSlice } from './slices/updater';
import { updaterInitialState } from './slices/updater/state';
import { createChangelogSlice } from './slices/changelog';
import { changelogInitialState } from './slices/changelog/state';
import { createBugReportDraftSlice } from './slices/bugReportDraft';
import { createSessionDraftSlice } from './slices/sessionDraft';
import { createContextDrawerSlice } from './slices/contextDrawer';
import { contextDrawerInitialState } from './slices/contextDrawer/state';
import { createContextItemsSlice } from './slices/contextItems';
import { contextItemsInitialState } from './slices/contextItems/state';
import { createDecisionsSlice } from './slices/decisions';
import { decisionsInitialState } from './slices/decisions/state';
import { sessionDraftInitialState } from './slices/sessionDraft/state';
import { createDrawerSlice } from './slices/drawer';
import { createNavigationSlice } from './slices/navigation';
import { navigationInitialState } from './slices/navigation/state';
import { askInitialState } from './slices/ask/state';
import { drawerInitialState } from './slices/drawer/state';
import { bugReportDraftInitialState } from './slices/bugReportDraft/state';
import type { ProviderSpendEntry } from './slices/budget';
import type { AppState } from './types';
import { sessionFiltersInitialState } from './slices/sessionFilters/state';
import { workspacesInitialState } from './slices/workspaces/state';
import { projectsInitialState } from './slices/projects/state';
import { sessionsInitialState } from './slices/sessions/state';
import { sessionEventsInitialState } from './slices/session-events/state';
import { dormantSpendInitialState } from './slices/dormant-spend/state';
import { hostReachabilityInitialState } from './slices/host-reachability/state';
import { presenceInitialState } from './slices/presence/state';
import { settingsInitialState } from './slices/settings/state';
import { providersInitialState } from './slices/providers/state';
import { credentialsInitialState } from './slices/credentials/state';
import { integrationsInitialState } from './slices/integrations/state';
import { bootInitialState } from './slices/boot/state';
import { transcriptsInitialState } from './slices/transcripts/state';
import { worktreesInitialState } from './slices/worktrees/state';
import { overridesInitialState } from './slices/overrides/state';
import { sidebarInitialState } from './slices/sidebar/state';
import { settingsLastPageInitialState } from './slices/settings-last-page/state';
import { localChecksInitialState } from './slices/local-checks/state';
import { chatLastOpenInitialState } from './slices/chat-last-open/state';
import { branchFilesFilterInitialState } from './slices/branch-files-filter/state';
import { nextViewInitialState } from './slices/next-view/state';
import { trackerMovesInitialState } from './slices/tracker-moves/state';
import { turnInitialState } from './slices/turn/state';
import { workflowsInitialState } from './slices/workflows/state';
import { agentsInitialState } from './slices/agents/state';
import { agentQueueInitialState } from './slices/agentQueue/state';
import { slotsInitialState } from './slices/slots/state';
import { summariesInitialState } from './slices/summaries/state';
import { plansInitialState } from './slices/plans/state';
import { openQuestionsInitialState } from './slices/open-questions/state';
import { nudgesInitialState } from './slices/nudges/state';
import { slackDraftsInitialState } from './slices/slack-drafts/state';
import { startHintsInitialState } from './slices/startHints/state';
import { rebaseAllInitialState } from './slices/rebaseAll/state';
import { artifactDraftsInitialState } from './slices/artifactDrafts/state';
import { permissionsInitialState } from './slices/permissions/state';
import { attachmentsInitialState } from './slices/attachments/state';
import { storageInitialState } from './slices/storage/state';
import { skillsInitialState } from './slices/skills/state';
import { githubInitialState } from './slices/github/state';
import { notificationsInitialState } from './slices/notifications/state';
import { taskArrivalsInitialState } from './slices/taskArrivals/state';
import { diffCommentsInitialState } from './slices/diff-comments/state';
import { fileVersionsInitialState } from './slices/file-versions/state';
import { terminalInitialState } from './slices/terminal/state';
import { endedWorkInitialState } from './slices/ended-work/state';
export type { ProviderSpendEntry };

export type AppStore = AppState &
  ReturnType<typeof createUndoSlice> &
  ReturnType<typeof createReviewDraftsSlice> &
  ReturnType<typeof createArtifactsSlice> &
  ReturnType<typeof createArtifactCommentsSlice> &
  ReturnType<typeof createBootstrapSlice> &
  ReturnType<typeof createFolderPurposeSlice> &
  ReturnType<typeof createResolveSlice> &
  ReturnType<typeof createReviewNavigationSlice> &
  ReturnType<typeof createReviewBulkSlice> &
  ReturnType<typeof createReviewLaunchSlice> &
  ReturnType<typeof createOutputHandoffsSlice> &
  ReturnType<typeof createReviewSelectionSlice> &
  ReturnType<typeof createReviewSourceSlice> &
  ReturnType<typeof createPrWritesSlice> &
  ReturnType<typeof createPullRequestViewSlice> &
  ReturnType<typeof createSessionSyncSlice> &
  ReturnType<typeof createIssueBriefsSlice> &
  ReturnType<typeof createDurationEstimatesSlice> &
  ReturnType<typeof createProviderLimitsSlice> &
  ReturnType<typeof createLimitStopsSlice> &
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
  ReturnType<typeof createAskSlice> &
  ReturnType<typeof createUpdaterSlice> &
  ReturnType<typeof createChangelogSlice> &
  ReturnType<typeof createBugReportDraftSlice> &
  ReturnType<typeof createSessionDraftSlice> &
  ReturnType<typeof createContextDrawerSlice> &
  ReturnType<typeof createContextItemsSlice> &
  ReturnType<typeof createDecisionsSlice> &
  ReturnType<typeof createDrawerSlice> &
  ReturnType<typeof createNavigationSlice> &
  ReturnType<typeof createSidebarSlice> &
  ReturnType<typeof createSettingsLastPageSlice> &
  ReturnType<typeof createLocalChecksSlice> &
  ReturnType<typeof createChatLastOpenSlice> &
  ReturnType<typeof createBranchFilesFilterSlice> &
  ReturnType<typeof createNextViewSlice> &
  ReturnType<typeof createTrackerMovesSlice> &
  ReturnType<typeof createCheckFixCommitsSlice> &
  ReturnType<typeof createSessionFiltersSlice> &
  ReturnType<typeof createSettingsSlice> &
  ReturnType<typeof createBootSlice> &
  ReturnType<typeof createPresenceSlice> &
  ReturnType<typeof createHostReachabilitySlice> &
  ReturnType<typeof createNotificationsSlice> &
  ReturnType<typeof createTaskArrivalsSlice> &
  ReturnType<typeof createNudgesSlice> &
  ReturnType<typeof createTerminalSlice> &
  ReturnType<typeof createEndedWorkSlice> &
  ReturnType<typeof createScriptsSlice> &
  ReturnType<typeof createPermissionsSlice> &
  ReturnType<typeof createSessionViewSlice> &
  ReturnType<typeof createSavedProjectModelsSlice> &
  ReturnType<typeof createSessionPinsSlice> &
  ReturnType<typeof createRepoDivergenceSlice> &
  ReturnType<typeof createAutoViewSlice> &
  ReturnType<typeof createSessionsSlice> &
  ReturnType<typeof createTranscriptsSlice> &
  ReturnType<typeof createSummariesSlice> &
  ReturnType<typeof createSessionEventsSlice> &
  ReturnType<typeof createDormantSpendSlice> &
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
  ReturnType<typeof createStartHintsSlice> &
  ReturnType<typeof createRebaseAllSlice> &
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
  ReturnType<typeof createBudgetSlice> &
  ReturnType<typeof createMonitoringSlice> &
  ReturnType<typeof createGithubSlice> &
  ReturnType<typeof createGitlabMrSlice> &
  ReturnType<typeof createBitbucketPrSlice> &
  ReturnType<typeof createSlackDraftsSlice> &
  ReturnType<typeof createSlackThreadsSlice> &
  ReturnType<typeof createIntegrationsSlice> &
  ReturnType<typeof createPrSeriesSlice> &
  ReturnType<typeof createDiffCommentsSlice> &
  ReturnType<typeof createFileVersionsSlice> &
  ReturnType<typeof createHistorySlice> &
  ReturnType<typeof createScribeSlice>;

const initialState: AppState = {
  ...undoInitialState,
  ...updaterInitialState,
  ...changelogInitialState,
  ...bugReportDraftInitialState,
  ...sessionDraftInitialState,
  ...contextDrawerInitialState,
  ...contextItemsInitialState,
  ...decisionsInitialState,
  ...askInitialState,
  ...drawerInitialState,
  ...navigationInitialState,
  ...scriptsInitialState,
  ...projectRelocationInitialState,
  ...backupInitialState,
  ...budgetInitialState,
  ...monitoringInitialState,
  ...createInitialSessionViewState({}),
  ...savedProjectModelsInitialState,
  ...sessionPinsInitialState,
  ...autoViewInitialState,
  ...sessionFiltersInitialState,
  ...workspacesInitialState,
  ...projectsInitialState,
  ...integrationsInitialState,
  ...sessionEventsInitialState,
  ...dormantSpendInitialState,
  ...presenceInitialState,
  ...hostReachabilityInitialState,
  ...sessionsInitialState,
  ...settingsInitialState,
  ...providersInitialState,
  ...credentialsInitialState,
  ...bootInitialState,
  ...transcriptsInitialState,
  ...worktreesInitialState,
  ...projectMountsInitialState,
  ...mountCleanupInitialState,
  ...historyInitialState,
  ...scribeInitialState,
  ...prSeriesInitialState,
  ...prWritesInitialState,
  ...pullRequestViewInitialState,
  ...sessionSyncInitialState,
  ...issueBriefsInitialState,
  ...durationEstimatesInitialState,
  ...providerLimitsInitialState,
  ...limitStopsInitialState,
  ...sentryLinksInitialState,
  ...handoffsInitialState,
  ...turnInitialState,
  ...slotsInitialState,
  ...summariesInitialState,
  ...storageInitialState,
  ...skillsInitialState,
  ...workflowsInitialState,
  ...agentsInitialState,
  ...overridesInitialState,
  ...sidebarInitialState,
  ...settingsLastPageInitialState,
  ...localChecksInitialState,
  ...chatLastOpenInitialState,
  ...branchFilesFilterInitialState,
  ...nextViewInitialState,
  ...trackerMovesInitialState,
  ...checkFixCommitsInitialState,
  ...githubInitialState,
  ...gitlabMrInitialState,
  ...bitbucketPrInitialState,
  ...slackThreadsInitialState,
  ...reviewDraftsInitialState,
  ...permissionsInitialState,
  ...bootstrapInitialState,
  ...folderPurposeInitialState,
  ...resolveInitialState,
  ...reviewNavigationInitialState,
  ...reviewBulkInitialState,
  ...reviewLaunchInitialState,
  ...outputHandoffsInitialState,
  ...reviewSelectionInitialState,
  ...reviewSourceInitialState,
  ...artifactsInitialState,
  ...artifactCommentsInitialState,
  ...startHintsInitialState,
  ...rebaseAllInitialState,
  ...artifactDraftsInitialState,
  ...workflowStudioInitialState,
  ...workflowRoutingInitialState,
  ...agentQueueInitialState,
  ...diffCommentsInitialState,
  ...fileVersionsInitialState,
  ...attachmentsInitialState,
  ...notificationsInitialState,
  ...taskArrivalsInitialState,
  ...plansInitialState,
  ...nudgesInitialState,
  ...openQuestionsInitialState,
  ...slackDraftsInitialState,
  ...terminalInitialState,
  ...endedWorkInitialState,
  ...repoDivergenceInitialState,
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,
  ...createUndoSlice({ set, get }),
  ...createNotificationsSlice({ set, get }),
  ...createTaskArrivalsSlice({ set, get }),
  ...createNudgesSlice({ set, get }),
  ...createArtifactsSlice({ set, get }),
  ...createArtifactCommentsSlice({ set, get }),
  ...createPlansSlice({ set, get }),
  ...createOpenQuestionsSlice({ set, get }),
  ...createSlackDraftsSlice({ set, get }),
  ...createBudgetSlice({ set, get }),
  ...createMonitoringSlice({ set, get }),
  ...createSkillsSlice({ set, get }),
  ...createStorageSlice({ set, get }),
  ...createDiffCommentsSlice({ set, get }),
  ...createFileVersionsSlice({ set, get }),
  ...createSessionEventsSlice({ set, get }),
  ...createDormantSpendSlice({ set, get }),
  ...createAttachmentsSlice({ set, get }),
  ...createGithubSlice({ set, get }),
  ...createGitlabMrSlice({ set, get }),
  ...createBitbucketPrSlice({ set, get }),
  ...createSlackThreadsSlice({ set, get }),
  ...createReviewDraftsSlice({ set, get }),
  ...createIntegrationsSlice({ set, get }),
  ...createSidebarSlice({ set, get }),
  ...createSettingsLastPageSlice({ set, get }),
  ...createLocalChecksSlice({ set, get }),
  ...createChatLastOpenSlice({ set, get }),
  ...createBranchFilesFilterSlice({ set, get }),
  ...createNextViewSlice({ set, get }),
  ...createTrackerMovesSlice({ set, get }),
  ...createCheckFixCommitsSlice({ set, get }),
  ...createSessionViewSlice({ set, get }),
  ...createSavedProjectModelsSlice({ set, get }),
  ...createSessionPinsSlice({ set, get }),
  ...createRepoDivergenceSlice({ set, get }),
  ...createAutoViewSlice({ set, get }),
  ...createSessionFiltersSlice({ set, get }),
  ...createTerminalSlice({ set, get }),
  ...createEndedWorkSlice({ set, get }),
  ...createScriptsSlice({ set, get }),
  ...createPermissionsSlice({ set, get }),
  ...createProvidersSlice({ set, get }),
  ...createAgentsSlice({ set, get }),
  ...createAgentQueueSlice({ set, get }),
  ...createBootstrapSlice({ set, get }),
  ...createFolderPurposeSlice({ set, get }),
  ...createResolveSlice({ set, get }),
  ...createReviewNavigationSlice({ set, get }),
  ...createReviewBulkSlice({ set, get }),
  ...createReviewLaunchSlice({ set, get }),
  ...createOutputHandoffsSlice({ set, get }),
  ...createReviewSelectionSlice({ set, get }),
  ...createReviewSourceSlice({ set, get }),
  ...createStartHintsSlice({ set, get }),
  ...createRebaseAllSlice({ set, get }),
  ...createArtifactDraftsSlice({ set, get }),
  ...createWorkflowStudioSlice({ set, get }),
  ...createWorkflowRoutingSlice({ set, get }),
  ...createSlotsSlice({ set, get }),
  ...createOverridesSlice({ set, get }),
  ...createCredentialsSlice({ set, get }),
  ...createWorkflowsSlice({ set, get }),
  ...createSettingsSlice({ set, get }),
  ...createBackupSlice({ set, get }),
  ...createTranscriptsSlice({ set, get }),
  ...createSummariesSlice({ set, get }),
  ...createSessionsSlice({ set, get }),
  ...createWorkspacesSlice({ set, get, initialState }),
  ...createProjectsSlice({ set, get }),
  ...createProjectRelocationSlice({ set, get }),
  ...createProjectMountsSlice({ set, get }),
  ...createMountCleanupSlice({ set, get }),
  ...createHistorySlice({ set, get }),
  ...createScribeSlice({ set, get }),
  ...createPrSeriesSlice({ set, get }),
  ...createPrWritesSlice({ set, get }),
  ...createPullRequestViewSlice({ set, get }),
  ...createSessionSyncSlice({ set, get }),
  ...createIssueBriefsSlice({ set, get }),
  ...createDurationEstimatesSlice({ set, get }),
  ...createProviderLimitsSlice({ set, get }),
  ...createLimitStopsSlice({ set, get }),
  ...createSentryLinksSlice({ set, get }),
  ...createHandoffsSlice({ set, get }),
  ...createSecurityFindingsSlice({ set, get }),
  ...createBranchCleanupSlice({ set, get }),
  ...createStarredIssuesSlice({ set, get }),
  ...createSearchIndexSlice({ set, get }),
  ...createChatsSlice({ set, get }),
  ...createAskSlice({ set, get }),
  ...createPresenceSlice({ set, get }),
  ...createHostReachabilitySlice({ set, get }),
  ...createTurnSlice({ set, get }),
  ...createWorktreesSlice({ set, get }),
  ...createBootSlice({ set, get }),
  ...createUpdaterSlice({ set, get }),
  ...createChangelogSlice({ set, get }),
  ...createBugReportDraftSlice({ set, get }),
  ...createSessionDraftSlice({ set, get }),
  ...createContextDrawerSlice({ set, get }),
  ...createContextItemsSlice({ set, get }),
  ...createDecisionsSlice({ set, get }),
  ...createDrawerSlice({ set, get }),
  ...createNavigationSlice({ set, get }),
}));
