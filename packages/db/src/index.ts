export type { Database } from './client';

export { migrate, type MigrateResult } from './migrations/runner';
export { migrations, type Migration } from './migrations';

export { NotFoundError, UniqueViolationError } from './shared/errors';

export {
  insertWorkspace,
  getWorkspaceById,
  listWorkspaces,
  deleteWorkspace,
} from './queries/workspace';
export {
  insertSession,
  updateSessionState,
  updateSessionPermissionMode,
  updateSessionAutoRun,
  updateSessionTitleUserEdited,
  getSessionById,
  listSessionsForWorkspace,
  renameSession,
  deleteSession,
  softDeleteSession,
  restoreSession,
  archiveSession,
  unarchiveSession,
} from './queries/session';
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
  insertAgent,
  updateAgentStatus,
  softDeleteAgent,
  restoreAgent,
} from './queries/agent';
export {
  insertSessionWorktree,
  listWorktreesForSession,
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
