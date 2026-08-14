export type { Database } from './client';

export { migrate, type MigrateResult } from './migrations/runner';
export { migrations, type Migration } from './migrations';

export { NotFoundError, UniqueViolationError } from './shared/errors';

export {
  insertWorkspace,
  getWorkspaceById,
  listWorkspaces,
  listDisconnectedWorkspaces,
  findWorkspaceByRootPath,
  disconnectWorkspace,
  reconnectWorkspace,
  renameWorkspace,
  touchWorkspaceLastAccessed,
  updateWorkspaceKind,
  deleteWorkspace,
} from './queries/workspace';
export { insertWorkspaceMembers } from './queries/workspace-member';
export {
  upsertWorkspaceIntegration,
  listIntegrationsForWorkspace,
  getWorkspaceIntegration,
  deleteWorkspaceIntegration,
} from './queries/workspace-integration';
export {
  upsertSessionExternalTask,
  listSessionExternalTasks,
  listExternalTasksForWorkspace,
  deleteSessionExternalTask,
} from './queries/session-external-task';
export {
  insertSession,
  updateSessionState,
  updateSessionPermissionMode,
  updateSessionAutoRun,
  updateSessionTitleUserEdited,
  updateSessionActiveMount,
  getSessionById,
  listSessionsForWorkspace,
  listArchivedSessionsForWorkspace,
  listArchivedSessionRefs,
  renameSession,
  deleteSession,
  softDeleteSession,
  restoreSession,
  archiveSession,
  unarchiveSession,
  updateSessionConfig,
  type SessionConfigUpdate,
  type ArchivedSessionRef,
} from './queries/session';
export {
  listWorkflowsForSession,
  attachWorkflowToSession,
  detachWorkflowFromSession,
  discardWorkflowInSession,
  restoreWorkflowInSession,
  updateWorkflowOrder,
  updateSessionWorkflowStep,
  updateSessionWorkflowAutoRun,
  updateSessionWorkflowTriggerMode,
  updateWorkflowRunOrchestrationOutcome,
  updateWorkflowRunOrchestrationStop,
  updateWorkflowRunOrchestratorHints,
  updateWorkflowRunOrchestratorRouting,
  updateWorkflowRunOrchestratorSummary,
  updateWorkflowRunSpendLimit,
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
} from './queries/context-slot';
export {
  insertFileVersion,
  listFileVersionsForSession,
  listFileVersionsForPath,
  pruneFileVersionsForPath,
  deleteFileVersion,
  deleteFileVersionsForSession,
} from './queries/file-version';
export {
  insertProviderRun,
  updateProviderRunStatus,
  getProviderRunById,
} from './queries/provider-run';
export {
  insertTelemetry,
  listTelemetryForSession,
  summarizeSessionTelemetry,
  summarizeWorkspaceTelemetry,
  summarizeProviderTelemetry,
  summarizeWorkspaceProviderTelemetry,
  type TelemetrySummary,
  type ProviderTelemetrySummary,
} from './queries/telemetry';
export { getSetting, setSetting } from './queries/settings';
export {
  insertBudgetRule,
  listBudgetRules,
  deleteBudgetRule,
  upsertSessionBudget,
  getSessionBudget,
  insertBudgetAlert,
  listBudgetAlerts,
  dismissBudgetAlert,
  type ListBudgetAlertsOptions,
} from './queries/budget';
export {
  listSkillsForWorkspace,
  getSkillById,
  upsertSkill,
  deleteSkill,
  deleteSkillsForWorkspace,
} from './queries/skill';
export { listWorkflows, getWorkflow, upsertWorkflow, deleteWorkflow } from './queries/workflow';
export {
  listAgentsForSession,
  listAgentsForSessions,
  insertAgent,
  updateAgentStatus,
  softDeleteAgent,
  restoreAgent,
  updateAgentConfig,
  updateAgentDomains,
  getAgentById,
  type AgentConfigUpdate,
} from './queries/agent';
export {
  insertSessionWorktree,
  listWorktreesForSession,
  listWorktreesForSessions,
  deleteWorktreesForSession,
  updateSessionWorktreeBranch,
  updateSessionWorktreePath,
  updateSessionWorktreeRepoSlug,
  listAllSessionWorktrees,
  type SessionWorktree,
} from './queries/session-worktree';
export {
  enqueueAuditRetry,
  drainOldest,
  updateAuditRetryAttempts,
  deleteAuditRetry,
  type AuditRetryRow,
} from './queries/permission-audit-retry';
export {
  insertGroup,
  listGroupsForSession,
  getGroupById,
  deleteGroup,
  updateGroupCompletedAt,
} from './queries/parallel-group';
export {
  getWorkspaceOverrides,
  setWorkspaceOverrides,
  getSessionOverrides,
  setSessionOverrides,
} from './queries/settings-overrides';
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
  queuePendingResolution,
  listPendingResolutionsForSession,
  markPendingResolutionReplyPosted,
  deletePendingResolution,
} from './queries/pending-resolution';
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
  type NotificationCounts,
  type NotificationAction,
  type NotificationKind,
  type NotificationSeverity,
} from './queries/notification';
export {
  insertNudgeEvent,
  updateNudgeEventOutcome,
  listNudgeEvents,
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
  listWorkspaceScripts,
  upsertWorkspaceScript,
  deleteWorkspaceScript,
} from './queries/workspace-script';
export {
  insertOpenQuestion,
  listOpenQuestionsForSession,
  listResolvedQuestionTextsForSession,
  markOpenQuestionAnswered,
  markOpenQuestionDismissed,
  markOpenQuestionsResolvedByText,
  restoreOpenQuestion,
  transferOpenQuestionOwnership,
  type InsertOpenQuestionInput,
  type InsertOpenQuestionResult,
} from './queries/open-question';
