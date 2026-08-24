import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import type { Database } from '../client';
import { updateProviderRunStatusIfInFlight } from '../queries/provider-run';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERMISSION_AUDIT_MAX_ROWS = 5000;
const TURN_EVENT_MAX_ROWS = 200_000;

type Params = {
  readonly db: Database;
  readonly now: number;
};

export type DatabaseHygieneResult = {
  readonly permissionAuditRowsDeleted: number;
  readonly turnEventRowsDeleted: number;
  readonly githubPrCacheRowsDeleted: number;
  readonly providerRunsCancelled: number;
};

type ProviderRunRow = {
  readonly id: ProviderRunId;
};

export const runDatabaseHygiene = async ({ db, now }: Params): Promise<DatabaseHygieneResult> => {
  const permissionCutoff = now - 30 * DAY_MS;
  const oldPermissionRows = await db.execute(
    'DELETE FROM permission_audit_log WHERE requested_at < ?',
    [permissionCutoff],
  );
  const excessPermissionRows = await db.execute(
    `DELETE FROM permission_audit_log
     WHERE rowid IN (
       SELECT rowid FROM permission_audit_log
       ORDER BY requested_at DESC, rowid DESC
       LIMIT -1 OFFSET ${PERMISSION_AUDIT_MAX_ROWS}
     )`,
  );

  const turnEventCutoff = now - 90 * DAY_MS;
  const oldTurnEvents = await db.execute('DELETE FROM turn_events WHERE created_at < ?', [
    turnEventCutoff,
  ]);
  const excessTurnEvents = await db.execute(
    `DELETE FROM turn_events
     WHERE rowid IN (
       SELECT rowid FROM turn_events
       ORDER BY created_at DESC, rowid DESC
       LIMIT -1 OFFSET ${TURN_EVENT_MAX_ROWS}
     )`,
  );

  const githubPrCacheRows = await db.execute(
    `DELETE FROM github_pr_cache
     WHERE NOT EXISTS (
       SELECT 1
       FROM session_worktrees sw
       JOIN sessions s ON s.id = sw.session_id
       WHERE sw.branch = github_pr_cache.branch
         AND sw.repo_slug IS github_pr_cache.repo_slug
         AND s.deleted_at IS NULL
         AND s.archived_at IS NULL
     )`,
  );

  const providerRunCutoff = now - DAY_MS;
  const zombieProviderRuns = await db.select<ProviderRunRow>(
    `SELECT id FROM provider_runs
     WHERE status_kind IN ('pending', 'streaming') AND created_at < ?`,
    [providerRunCutoff],
  );
  const finishedAt = new Date(now).toISOString() as IsoDateTime;
  let providerRunsCancelled = 0;
  for (const run of zombieProviderRuns) {
    providerRunsCancelled += await updateProviderRunStatusIfInFlight({
      db,
      id: run.id,
      status: { kind: 'cancelled', finishedAt },
    });
  }

  return {
    permissionAuditRowsDeleted: oldPermissionRows.rowsAffected + excessPermissionRows.rowsAffected,
    turnEventRowsDeleted: oldTurnEvents.rowsAffected + excessTurnEvents.rowsAffected,
    githubPrCacheRowsDeleted: githubPrCacheRows.rowsAffected,
    providerRunsCancelled,
  };
};
