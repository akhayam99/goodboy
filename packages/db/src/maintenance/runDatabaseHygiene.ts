import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import type { Database } from '../client';
import { backfillMergedPullRequestEvents } from './backfillMergedPullRequestEvents';
import { updateProviderRunStatusIfInFlight } from '../queries/provider-run';
import {
  deleteOrphanedWorkflowAgents,
  type RemovedOpenQuestion,
} from '../queries/session-workflow';

import { pruneInBatches } from './pruneInBatches';
import { DATABASE_RETENTION, DAY_MS, PRUNE_BATCH_ROWS } from './retention';

type Params = {
  readonly db: Database;
  readonly now: number;
  readonly batchRows?: number;
};

export type DatabaseHygieneResult = {
  readonly permissionAuditRowsDeleted: number;
  readonly turnEventRowsDeleted: number;
  readonly githubPrCacheRowsDeleted: number;
  readonly mergedPullRequestEventsWritten: number;
  readonly providerRunsCancelled: number;
  readonly providerRunsDeleted: number;
  readonly orphanedWorkflowAgentsDeleted: number;
  readonly orphanedWorkflowQuestions: ReadonlyArray<RemovedOpenQuestion>;
};

type ProviderRunRow = {
  readonly id: ProviderRunId;
};

export const runDatabaseHygiene = async ({
  db,
  now,
  batchRows = PRUNE_BATCH_ROWS,
}: Params): Promise<DatabaseHygieneResult> => {
  const { permissionAuditLog, turnEvents, providerRuns, inFlightProviderRuns } = DATABASE_RETENTION;
  const oldPermissionRows = await pruneInBatches({
    db,
    table: 'permission_audit_log',
    selectRowids: 'SELECT rowid FROM permission_audit_log WHERE requested_at < ? LIMIT ?',
    params: [now - permissionAuditLog.maxAgeDays * DAY_MS],
    batchRows,
  });
  const excessPermissionRows = await pruneInBatches({
    db,
    table: 'permission_audit_log',
    selectRowids: `SELECT rowid FROM permission_audit_log
       ORDER BY requested_at DESC, rowid DESC
       LIMIT ? OFFSET ?`,
    params: [],
    batchRows,
    offsetRows: permissionAuditLog.maxRows,
  });

  const oldTurnEvents = await pruneInBatches({
    db,
    table: 'turn_events',
    selectRowids: 'SELECT rowid FROM turn_events WHERE created_at < ? LIMIT ?',
    params: [now - turnEvents.maxAgeDays * DAY_MS],
    batchRows,
  });
  const excessTurnEvents = await pruneInBatches({
    db,
    table: 'turn_events',
    selectRowids: `SELECT rowid FROM turn_events
       ORDER BY created_at DESC, rowid DESC
       LIMIT ? OFFSET ?`,
    params: [],
    batchRows,
    offsetRows: turnEvents.maxRows,
  });

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

  const mergedPullRequestEvents = await backfillMergedPullRequestEvents({ db });

  const orphanProviderRuns = await pruneInBatches({
    db,
    table: 'provider_runs',
    selectRowids: `SELECT rowid FROM provider_runs
       WHERE status_kind IN ('succeeded', 'failed', 'cancelled')
         AND created_at < ?
         AND NOT EXISTS (SELECT 1 FROM telemetry_records t WHERE t.run_id = provider_runs.id)
         AND NOT EXISTS (SELECT 1 FROM agents a WHERE a.provider_run_id = provider_runs.id)
         AND NOT EXISTS (SELECT 1 FROM file_versions f WHERE f.provider_run_id = provider_runs.id)
       LIMIT ?`,
    params: [now - providerRuns.maxAgeDays * DAY_MS],
    batchRows,
  });

  const providerRunCutoff = now - inFlightProviderRuns.cancelAfterDays * DAY_MS;
  const zombieProviderRuns = await db.select<ProviderRunRow>(
    `SELECT id FROM provider_runs
     WHERE status_kind IN ('pending', 'streaming') AND created_at < ?`,
    [providerRunCutoff],
  );
  const orphanedWorkflowAgents = await deleteOrphanedWorkflowAgents({ db, now });

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
    permissionAuditRowsDeleted: oldPermissionRows + excessPermissionRows,
    turnEventRowsDeleted: oldTurnEvents + excessTurnEvents,
    githubPrCacheRowsDeleted: githubPrCacheRows.rowsAffected,
    mergedPullRequestEventsWritten: mergedPullRequestEvents,
    providerRunsCancelled,
    providerRunsDeleted: orphanProviderRuns,
    orphanedWorkflowAgentsDeleted: orphanedWorkflowAgents.agentsDeleted,
    orphanedWorkflowQuestions: orphanedWorkflowAgents.removedQuestions,
  };
};
