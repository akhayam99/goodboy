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

export { migrate, type MigrateResult } from './migrations/runner';
export {
  runRuntimeMigrations,
  type MigrationSnapshotStorage,
} from './migrations/runRuntimeMigrations';
export { migrations, type Migration } from './migrations';
export {
  DatabaseFromNewerBuildError,
  NEWER_BUILD_MESSAGE,
  pickRestorableSnapshot,
} from './migrations/downgradeGuard';
export { runDatabaseHygiene, type DatabaseHygieneResult } from './maintenance/runDatabaseHygiene';

export { NotFoundError, UniqueViolationError } from './shared/errors';

export {
  insertWorkspace,
  getWorkspaceById,
  listWorkspaces,
  disconnectWorkspace,
  reconnectWorkspace,
  renameWorkspace,
  touchWorkspaceLastAccessed,
  deleteWorkspace,
  upsertWorkspaceProfile,
} from './queries/workspace';
export { mergeWorkspaces } from './queries/workspace-merge';
export {
  insertProject,
  getProjectById,
  listProjectsForWorkspace,
  findProjectByRootPath,
  disconnectProject,
  reconnectProject,
  updateProjectKind,
  updateProjectBaseBranch,
  updateProjectStar,
  updateProjectDescription,
  updateProjectGoodboyIgnore,
} from './queries/project';
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
  renameSession,
  deleteSession,
  purgeSessionForDelete,
  archiveSession,
  unarchiveSession,
  updateSessionConfig,
  type SessionConfigUpdate,
  type ArchivedSessionRef,
} from './queries/session';
export {
  attachWorkflowToSession,
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
export {
  hasOtherSessionTurnSince,
  insertAgentTurnSpan,
  listAgentTurnSpanRoutes,
  listSessionTurnSpans,
  listTurnSpans,
  listWorkspaceTurnSpans,
} from './queries/agent-turn-span';
export { listProviderLimits, upsertProviderLimits } from './queries/provider-limits';
export { summarizeProviderSpendPeriods, type ProviderSpendPeriods } from './queries/provider-spend';
export { getAgentHandoff, insertAgentHandoff } from './queries/agent-handoff';
export { getSetting, setSetting } from './queries/settings';
export {
  listBudgetRules,
  getSessionBudget,
  insertBudgetAlert,
  listBudgetAlerts,
  dismissBudgetAlert,
  type ListBudgetAlertsOptions,
} from './queries/budget';
export { listSkillsForWorkspace, upsertSkill, deleteSkill } from './queries/skill';
export {
  listWorkflows,
  getWorkflow,
  upsertWorkflow,
  deleteWorkflow,
  restoreSeededWorkflow,
  readBuiltinSeedState,
  listRemovedSeededWorkflowIds,
  takenNameKey,
  type BuiltinSeedState,
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
  listAgentsForSessions,
  updateAgentStatus,
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
  listArchivedSessionMounts,
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
export { listMountPullRequestLinks, upsertMountPullRequestLink } from './queries/mount-pr-link';
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
  renameProviderCredential,
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
  consumeDiffComments,
  reopenDiffComment,
  deleteDiffComment,
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
  updateNudgeEventOutcome,
  type ListNudgeEventsOptions,
  type NudgeEvent,
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
  type PullRequestOutcomes,
  type PullRequestEntry,
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
} from './queries/resolve-attempt';
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
