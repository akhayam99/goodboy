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
  insertTask,
  updateTaskState,
  getTaskById,
  listTasksForWorkspace,
  renameTask,
  deleteTask,
} from './queries/task';
export { insertMessage, listMessagesForAgent, listMessagesForTask } from './queries/message';
export {
  insertTurnEvent,
  listTurnEventsForAgent,
  listTurnEventsForTask,
} from './queries/turn-event';
export { upsertContextSlot, listContextSlotsForTask } from './queries/context-slot';
export {
  insertProviderRun,
  updateProviderRunStatus,
  getProviderRunById,
} from './queries/provider-run';
export {
  insertTelemetry,
  listTelemetryForTask,
  summarizeTaskTelemetry,
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
  upsertTaskBudget,
  getTaskBudget,
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
export { listSessionsForTask, insertSession, updateSessionStatus } from './queries/session';
export {
  insertTaskWorktree,
  listWorktreesForTask,
  deleteWorktreesForTask,
  type TaskWorktree,
} from './queries/task-worktree';
export {
  enqueueAuditRetry,
  drainOldest,
  updateAuditRetryAttempts,
  deleteAuditRetry,
  type AuditRetryRow,
} from './queries/permission-audit-retry';
export {
  insertGroup,
  listGroupsForTask,
  getGroupById,
  deleteGroup,
  updateGroupCompletedAt,
} from './queries/parallel-group';
export {
  getWorkspaceOverrides,
  setWorkspaceOverrides,
  getTaskOverrides,
  setTaskOverrides,
} from './queries/settings-overrides';
