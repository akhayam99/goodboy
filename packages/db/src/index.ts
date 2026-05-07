export type { Database } from './client';

export { migrate, type MigrateResult } from './migrations/runner';
export { migrations, type Migration } from './migrations';

export { NotFoundError, UniqueViolationError } from './shared/errors';

export { insertWorkspace, getWorkspaceById, listWorkspaces } from './queries/workspace';
export {
  insertSession,
  updateSessionState,
  getSessionById,
  listSessionsForWorkspace,
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
  type TelemetrySummary,
} from './queries/telemetry';
export { getSetting, setSetting } from './queries/settings';
