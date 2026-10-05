export type {
  AbortedTransaction,
  CommittedTransaction,
  Database,
  GuardedStatement,
  PlainStatement,
  Statement,
  StatementGuard,
  StatementResult,
  TransactionOutcome,
  TransactionParams,
} from './client';

export {
  DatabaseFromNewerBuildError,
  NEWER_BUILD_MESSAGE,
  pickRestorableSnapshot,
} from './migrations/downgradeGuard';
export { runDatabaseHygiene, type DatabaseHygieneResult } from './maintenance/runDatabaseHygiene';
export {
  purgeExcludedSearchDocs,
  readSearchBackfillProgress,
  rebuildSearchIndex,
  runSearchBackfillStep,
  type SearchBackfillProgress,
  type SearchBackfillStep,
} from './maintenance/searchBackfill';

export {
  InvalidWorkflowNodeError,
  NodeNotMutableError,
  NotFoundError,
  UniqueViolationError,
} from './shared/errors';
export {
  excludeProjectFromSearch,
  includeProjectInSearch,
  readSearchIndexStatus,
  searchIndex,
} from './queries/search';

export {
  insertWorkspace,
  getWorkspaceById,
  listWorkspaces,
  listDisconnectedWorkspaces,
  disconnectWorkspace,
  disconnectWorkspaceAndProjects,
  reconnectWorkspace,
  reconnectWorkspaceAndProjects,
  renameWorkspace,
  setWorkspacePermissionDefault,
  touchWorkspaceLastAccessed,
  deleteWorkspace,
  upsertWorkspaceProfile,
} from './queries/workspace';
export { mergeWorkspaces } from './queries/workspace-merge';
export {
  insertProject,
  getProjectById,
  listProjectsForWorkspace,
  listAllProjectsForWorkspace,
  findProjectByRootPath,
  findDisconnectedProjectByIdentity,
  disconnectProject,
  reconnectProject,
  updateProjectKind,
  updateProjectAfterMerge,
  updateProjectResolveCommitStyle,
  updateProjectBaseBranch,
  updateProjectStar,
  updateProjectDescription,
  updateProjectGoodboyIgnore,
  updateProjectIdentity,
} from './queries/project';
export {
  recordSecurityFindings,
  listOpenSecurityFindings,
  listDismissedSecurityFindings,
  countOpenSecurityFindings,
  dismissSecurityFinding,
  flagSecurityFindingAgain,
} from './queries/security-finding';
export { getDraftHistoryPlan, markHistoryPlan, saveDraftHistoryPlan } from './queries/history-plan';
export {
  insertDeletedBranch,
  listDeletedBranches,
  getDeletedBranch,
  markDeletedBranchRestored,
  listExpiredDeletedBranches,
  forgetDeletedBranch,
} from './queries/deleted-branch';
export { listGoodboyBranches, type GoodboyBranch } from './queries/goodboy-branch';
export {
  describeProjectAdoption,
  moveProjectToWorkspace,
  type ProjectAdoptionInfo,
  type ProjectMoveResult,
} from './queries/project-adoption';
export {
  upsertIntegrationBinding,
  listIntegrationBindingsForWorkspace,
  getIntegrationBinding,
  deleteIntegrationBinding,
  deleteIntegrationBindingsForProvider,
} from './queries/integration-binding';
export {
  listIntegrationCredentials,
  upsertIntegrationCredential,
  deleteIntegrationCredential,
  countWorkspacesPerIntegrationCredential,
} from './queries/integration-credential';
export {
  upsertSessionExternalTask,
  listExternalTasksForWorkspace,
  deleteSessionExternalTask,
} from './queries/session-external-task';
export {
  upsertWorkspaceExternalTask,
  listWorkspaceExternalTasks,
  deleteWorkspaceExternalTask,
} from './queries/workspace-external-task';
export {
  insertSession,
  updateSessionState,
  updateSessionPermissionMode,
  updateSessionAutoRun,
  updateSessionTitleUserEdited,
  updateSessionActiveProject,
  updateSessionWriteDestination,
  getSessionById,
  listSessionsForWorkspace,
  listArchivedSessionsForWorkspace,
  listArchivedSessionRefs,
  listSessionTitlesAcrossWorkspaces,
  renameSession,
  deleteSession,
  purgeSessionForDelete,
  archiveSession,
  unarchiveSession,
  updateSessionConfig,
  type SessionConfigUpdate,
  type ArchivedSessionRef,
  type SessionTitleRef,
} from './queries/session';
export { getSessionContextSeenAt, setSessionContextSeenAt } from './queries/session-context-seen';
export {
  insertSessionContextItems,
  listSessionContextItems,
  listSessionContextItemsForRole,
  listWorkspaceLearnings,
  setSessionContextItemStatus,
} from './queries/session-context-item';
export { listSessionDecisions, saveSessionDecisions } from './queries/session-decision';
export {
  attachWorkflowToSession,
  deleteOrphanedWorkflowAgents,
  detachWorkflowFromSession,
  discardWorkflowInSession,
  restoreWorkflowInSession,
  updateWorkflowOrder,
  updateSessionWorkflowStep,
  updateSessionWorkflowAutoRun,
  updateSessionWorkflowTriggerMode,
  repointWorkflowRunTemplate,
  type WorkflowRunStepRepoint,
  updateWorkflowRunOrchestrationOutcome,
  updateWorkflowRunOrchestrationStop,
  updateWorkflowRunOrchestratorHints,
  updateWorkflowRunOrchestratorRouting,
  updateWorkflowRunOrchestratorSummary,
  updateWorkflowRunSpendLimit,
  updateWorkflowRunRulesSnapshot,
  updateGeneratedWorkflowRunTitle,
  updateUserWorkflowRunTitle,
} from './queries/session-workflow';
export { insertMessage, listMessagesForAgent, listMessagesForSession } from './queries/message';
export {
  insertGoalAttachment,
  listGoalAttachmentsForSession,
  listGoalAttachmentsForRun,
  deleteGoalAttachment,
} from './queries/attachment';
export {
  insertTurnEvent,
  insertTurnEventsBatch,
  countUserTextEvents,
  listTurnEventsForAgent,
  listTurnEventsForSession,
  listAgentRunIdsForSession,
  getTurnEventStatsForSessions,
  deleteTurnEventsForSessions,
  type PendingTurnEventInsert,
  type TurnEventStorageStats,
} from './queries/turn-event';
export { getDatabaseSizeBytes, vacuumDatabase } from './queries/storage';
export {
  upsertContextSlot,
  listContextSlotsForSession,
  insertContextSlotHistory,
  listContextSlotHistory,
  countContextSlotHistoryForSession,
} from './queries/context-slot';
export {
  insertFileVersion,
  listFileVersionsForSession,
  pruneFileVersionsForPath,
  deleteFileVersion,
  deleteFileVersionsForSession,
} from './queries/file-version';
export { insertProviderRun, updateProviderRunStatus } from './queries/provider-run';
export {
  insertTelemetry,
  listTelemetryForSession,
  summarizeSessionTelemetry,
  summarizeWorkspaceTelemetry,
  summarizeWorkspaceProviderTelemetry,
  type ProviderTelemetrySummary,
} from './queries/telemetry';
export { listDormantSessionTelemetry, type DormantTelemetry } from './queries/dormant-telemetry';
export {
  hasOtherSessionTurnSince,
  insertAgentTurnSpan,
  listAgentTurnSpanRoutes,
  listSessionTurnSpans,
  listTurnSpans,
  listWorkspaceTurnSpans,
} from './queries/agent-turn-span';
export { listProviderLimits, upsertProviderLimits } from './queries/provider-limits';
export { getAgentHandoff, insertAgentHandoff } from './queries/agent-handoff';
export {
  deleteSetting,
  getSetting,
  listSettingsWithPrefix,
  replaceSettingIfUnchanged,
  setSetting,
} from './queries/settings';
export {
  listWorkflows,
  listWorkflowsIncludingDeleted,
  getWorkflow,
  upsertWorkflow,
  deleteWorkflow,
  removeWorkflow,
  saveWorkflow,
  restoreSeededWorkflow,
  findActiveWorkflowRunTitle,
  readBuiltinSeedState,
  listRemovedSeededWorkflowIds,
  takenNameKey,
  type BuiltinSeedState,
  type SaveWorkflowInput,
  type WorkflowStepInput,
  type RestoreSeededWorkflowResult,
} from './queries/workflow';
export {
  isWorkflowRoutingDecision,
  isWorkflowRoutingLock,
  isWorkflowTaskProfile,
  legacyAgentRoutingDecision,
  legacyStepRoutingLock,
  parseRoutingJson,
  stringifyRoutingJson,
} from './queries/workflowRoutingCodec';
export {
  insertAgent,
  insertAgentBatch,
  markAgentViewed,
  recordAgentStatus,
  setAgentDone,
  setAgentProviderSession,
  setAgentVerbosity,
  updateWorkflowNodeRouting,
  type AgentBatchInput,
  type AgentBatchOutcome,
  type AgentInsertInput,
  type AgentStatusFields,
  type WorkflowNodeRouting,
} from './queries/agent-write';
export {
  listAgentsForSessions,
  listProviderSessionIds,
  purgeAgentForDelete,
  updateAgentConfig,
  type AgentRoutingUpdate,
  updateAgentDomains,
  getAgentById,
  type AgentConfigUpdate,
} from './queries/agent';
export {
  listAgentQueuedMessages,
  replaceAgentQueuedMessages,
  type AgentQueuedMessageRecord,
} from './queries/agent-queued-message';
export {
  insertSessionWorktree,
  insertSessionMount,
  getSessionMount,
  listSessionMounts,
  listWorktreesForSession,
  listWorktreesForSessions,
  deleteWorktreesForSession,
  deleteSessionMount,
  updateSessionWorktreeBranch,
  updateSessionMountBranch,
  updateSessionMountLifecycle,
  updateSessionWorktreeRepoSlug,
  listAllSessionWorktrees,
  detachSessionMounts,
  listMountPathOwnership,
  type MountDetachment,
  type MountPathOwnership,
  type SessionWorktree,
} from './queries/session-worktree';
export {
  getMountOperation,
  listMountOperations,
  listUnsettledMountOperations,
  upsertMountOperation,
} from './queries/mount-operation';
export {
  listDormantOpenPullRequests,
  listMergedRequestHeads,
  listMountPullRequestLinks,
  upsertMountPullRequestLink,
} from './queries/mount-pr-link';
export {
  findPrSeriesMembership,
  getPrSeries,
  insertPrSeries,
  listPrSeries,
  listPrSeriesMembers,
  upsertPrSeriesMember,
} from './queries/pr-series';
export {
  deleteRetainedWorktreePath,
  listAllRetainedWorktreePaths,
  listRetainedWorktreePaths,
  markRetainedWorktreePathChecked,
  transferMountPathToRetained,
} from './queries/retained-worktree-path';
export {
  deleteWorktreeLedgerEntries,
  listWorktreeLedger,
  recordOrphanWorktrees,
  setWorktreeLedgerKeep,
  setWorktreeLedgerSize,
  type OrphanLedgerInput,
} from './queries/worktree-ledger';
export {
  listStorageMounts,
  listStorageSessionRefs,
  type StorageMountRow,
  type StorageSessionRef,
} from './queries/storage-folders';
export {
  listOrphanArtifacts,
  markArtifactOpened,
  setArtifactKeep,
  purgeOrphanArtifact,
  type OrphanArtifactRow,
} from './queries/artifact-orphan';
export {
  listWorktreeRoots,
  markWorktreeRootScanned,
  registerWorktreeRoot,
} from './queries/worktree-root';
export { insertSessionEvent, listSessionEvents } from './queries/session-event';
export { getWorkspaceOverrides, setWorkspaceOverrides } from './queries/settings-overrides';
export {
  listProviderCredentials,
  insertProviderCredential,
  deleteProviderCredential,
} from './queries/provider-credential';
export {
  getGithubPrCache,
  upsertGithubPrCache,
  deleteGithubPrCache,
} from './queries/github-pr-cache';
export {
  insertDiffComment,
  listDiffCommentsForSession,
  resolveDiffComment,
  reopenDiffComment,
  deleteDiffComment,
  restoreDiffComment,
  assignDiffCommentTarget,
  type DiffCommentAuthor,
  type DiffCommentTarget,
} from './queries/diff-comment';
export {
  insertPrReviewDraft,
  listPrReviewDraftsForSession,
  updatePrReviewDraftBody,
  deletePrReviewDraft,
  markPrReviewDraftsPublished,
} from './queries/pr-review-draft';
export {
  insertNotification,
  listNotifications,
  countNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  clearAllNotifications,
  NOTIFICATION_LIST_LIMIT,
  type Notification,
  type NotificationCountBucket,
  type NotificationCursor,
  type NotificationAction,
  type NotificationKind,
  type NotificationSeverity,
} from './queries/notification';
export {
  insertNudgeEvent,
  listNudgeEvents,
  updateNudgeEventOutcome,
  type ListNudgeEventsOptions,
  type NextStepNudgeKind,
  type NudgeEvent,
  type NudgeEventKind,
  type NudgeKind,
  type NudgeOutcome,
} from './queries/nudge-event';
export {
  getImpactOverview,
  getPullRequestOutcomes,
  getReviewOutcomes,
  getExternalTaskOutcomes,
  getAgentDurations,
  getFlowHealth,
  getCacheEfficiency,
  getContextGrowth,
  getTurnDistribution,
  getRightSizeNudgeOutcomes,
  type ImpactOverview,
  type ImpactSession,
  type ReviewOutcomes,
  type ResolutionOutcome,
  type HotFile,
  type ExternalTaskOutcomes,
  type AgentDurations,
  type DurationByKind,
  type FlowHealth,
  type CacheEfficiencyEntry,
  type ContextGrowthPoint,
  type TurnBucket,
  type NudgeOutcomeCount,
} from './queries/impact';
export { type PullRequestOutcomes, type PullRequestEntry } from './queries/impact-pull-requests';
export {
  insertArtifact,
  getArtifact,
  getArtifactBySourceTurn,
  listArtifactsForSession,
  listArtifactMirrorPage,
  type ArtifactMirrorCursor,
  type ArtifactMirrorPage,
  type ArtifactMirrorRow,
  updateArtifactSource,
  setArtifactStatus,
  deleteArtifact,
  restoreArtifact,
  removeArtifact,
  type InsertArtifactInput,
  type UpdateArtifactSourceInput,
} from './queries/artifact';
export {
  annotateArtifactRevision,
  listArtifactRevisions,
  loadArtifactRevision,
  type ArtifactRevision,
  type ArtifactRevisionAuthor,
  type ArtifactRevisionNote,
  type ArtifactRevisionPin,
  type ArtifactRevisionPinnedNode,
  type ArtifactRevisionSummary,
} from './queries/artifactRevision';
export {
  putArtifactProvenance,
  getArtifactProvenance,
  updateArtifactRun,
  type PutArtifactProvenanceInput,
  type UpdateArtifactRunInput,
} from './queries/artifact-provenance';
export {
  listPlansForSession,
  upsertPlan,
  updatePlanStatus,
  updatePlanBody,
  deletePlan,
  addPlanConsumption,
  listConsumptionsForPlan,
  type UpsertPlanInput,
  type AddPlanConsumptionInput,
} from './queries/plan';
export {
  listProjectScripts,
  upsertProjectScript,
  deleteProjectScript,
} from './queries/project-script';
export {
  insertOpenQuestion,
  getOpenQuestionById,
  listOpenQuestionsForSession,
  listResolvedQuestionTextsForSession,
  markOpenQuestionAnswered,
  markOpenQuestionAnswersDelivered,
  markOpenQuestionDismissed,
  markOpenQuestionsResolvedByText,
  restoreOpenQuestion,
  type InsertOpenQuestionInput,
  type InsertOpenQuestionResult,
  type OpenQuestionAnswerProvenance,
  type MarkOpenQuestionAnswersDeliveredParams,
} from './queries/open-question';

export {
  listPendingSlackDrafts,
  listPendingSlackDraftsForSession,
  listPendingIntegrationDraftsForWorkspace,
  decideIntegrationDraft,
} from './queries/integration-draft';

export {
  listResolveThreads,
  setResolveThreadReplyDraft,
  setResolveThreadStage,
  setResolveThreadCommitLinks,
  setResolveThreadCommitShas,
  setResolveThreadState,
  upsertResolveThread,
} from './queries/resolve-thread';
export {
  insertResolveQueueItem,
  listResolveQueueItems,
  setResolveQueueItemApproval,
  rebaseResolveQueueItem,
  refuseResolveQueueItem,
  deferResolveQueueItem,
  undeferResolveQueueItem,
  markResolveQueueItemDelivered,
  reopenResolveQueueItem,
} from './queries/resolve-queue-item';
export {
  listResolveAttempts,
  listActiveResolveAttempts,
  insertResolveAttempt,
  setResolveAttemptPhase,
  setResolveAttemptCopyPath,
} from './queries/resolve-attempt';
export {
  insertResolveBatch,
  listResolveBatches,
  getResolveParallelLimit,
  setResolveParallelLimit,
} from './queries/resolve-batch';
export {
  listResolveThreadFacts,
  setResolveThreadGitState,
  setResolveThreadVerdict,
  setResolveThreadSourceSnapshot,
  setResolveThreadSource,
} from './queries/resolve-thread-facts';
export { keepResolveDraftCurrent } from './queries/resolve-draft-current';
export { hasResolveImport, commitResolveImport } from './queries/resolve-import';
export {
  insertResolveCandidate,
  insertResolveCandidateItem,
  getResolveCandidate,
  getReadyResolveCandidateForItem,
  listResolveCandidateItems,
  listResolveCandidates,
  markResolveCandidateReady,
  setResolveCandidateState,
  markOverlappingResolveCandidatesStale,
  markResolveCandidateIntegrated,
  finalizeResolveCandidateIntegration,
} from './queries/resolve-candidate';
export {
  insertResolveCheckRun,
  listResolveCheckRuns,
  listResolveCheckRunsForCandidate,
} from './queries/resolve-check-run';
export {
  insertResolvePublication,
  setResolvePublicationPhase,
  listActiveResolvePublications,
  listActiveResolvePublicationsForSession,
  claimResolvePublication,
  beatResolvePublication,
  listResolvePublicationsForSession,
  upsertResolvePublicationThread,
  listResolvePublicationThreads,
} from './queries/resolve-publication';
export {
  addProjectSentryLink,
  listProjectSentryLinks,
  removeProjectSentryLink,
} from './queries/project-sentry-link';
export {
  listStarredIssues,
  starIssue,
  unstarIssue,
  unstarClosedIssues,
  updateStarredIssueSnapshots,
} from './queries/starred-issue';
export {
  deleteChats,
  finishChatMessage,
  insertChat,
  insertChatMessage,
  insertChatSessionLink,
  listChatMessages,
  listChatSessionLinks,
  listChats,
  renameChat,
  setChatModel,
  setChatPinned,
  setChatsArchived,
  settleStreamingChatMessages,
} from './queries/chat';

export { replaceSessionTaskLinks } from './queries/replaceSessionTaskLinks';
