export type { Database } from './client';

export { migrate, type MigrateResult } from './migrations/runner';
export { migrations, type Migration } from './migrations';

export { NotFoundError, UniqueViolationError } from './shared/errors';

export {
  insertWorkspace,
  getWorkspaceById,
  listWorkspaces,
  findWorkspaceByRootPath,
  disconnectWorkspace,
  reconnectWorkspace,
  touchWorkspaceLastAccessed,
  deleteWorkspace,
} from './queries/workspace';
export {
  insertSession,
  updateSessionState,
  updateSessionPermissionMode,
  updateSessionAutoRun,
  updateSessionTitleUserEdited,
  updateSessionUserStatus,
  getSessionById,
  listSessionsForWorkspace,
  listArchivedSessionsForWorkspace,
  renameSession,
  deleteSession,
  softDeleteSession,
  restoreSession,
  archiveSession,
  unarchiveSession,
  updateSessionConfig,
  type SessionConfigUpdate,
} from './queries/session';
export {
  listWorkflowsForSession,
  attachWorkflowToSession,
  detachWorkflowFromSession,
  updateWorkflowOrder,
  updateSessionWorkflowStep,
  type SessionWorkflowEntry,
} from './queries/session-workflow';
export { insertMessage, listMessagesForAgent, listMessagesForSession } from './queries/message';
export {
  insertTurnEvent,
  listTurnEventsForAgent,
  listTurnEventsForSession,
  listAgentRunIdsForSession,
} from './queries/turn-event';
export {
  upsertContextSlot,
  listContextSlotsForSession,
  insertContextSlotHistory,
  listContextSlotHistory,
} from './queries/context-slot';
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
  getAgentById,
  type AgentConfigUpdate,
} from './queries/agent';
export {
  insertSessionWorktree,
  listWorktreesForSession,
  listWorktreesForSessions,
  deleteWorktreesForSession,
  updateSessionWorktreeBranch,
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
  insertNotification,
  listNotifications,
  markAllNotificationsRead,
  clearAllNotifications,
  type Notification,
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
  markOpenQuestionAnswered,
  markOpenQuestionDismissed,
  markOpenQuestionsResolvedByText,
  restoreOpenQuestion,
  transferOpenQuestionOwnership,
  type InsertOpenQuestionInput,
  type InsertOpenQuestionResult,
} from './queries/open-question';
