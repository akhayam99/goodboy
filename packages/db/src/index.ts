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
  getSessionById,
  listSessionsForWorkspace,
  renameSession,
  deleteSession,
} from './queries/session';
export { insertMessage, listMessagesForSession } from './queries/message';
export { upsertContextSlot, listContextSlotsForSession } from './queries/context-slot';
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
export {
  listPhaseTemplates,
  getPhaseTemplate,
  upsertPhaseTemplate,
  deletePhaseTemplate,
} from './queries/phase-templates';
export {
  listPhaseRunsForSession,
  insertPhaseRun,
  updatePhaseRunStatus,
} from './queries/phase-runs';
export {
  insertSessionWorktree,
  listWorktreesForSession,
  deleteWorktreesForSession,
  type SessionWorktree,
} from './queries/session-worktrees';
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
} from './queries/parallel-phases';
