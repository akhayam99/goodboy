import {
  RESOLVE_FAILURE_CAUSES,
  type ResolveAttempt,
  type ResolveAttemptPhase,
  type ResolveFailureCause,
  type SessionId,
} from '@goodboy/types';
import type { Database } from '../client';
import { resolveStringArray } from './resolve-json';
import { fromMountTarget, toMountTarget } from './resolve-mount-target';
import { parseLaunchChoice, serializeLaunchChoice } from './resolve-launch-choice';

type ListParams = { readonly db: Database; readonly sessionId: SessionId };
type InsertParams = { readonly db: Database; readonly attempt: ResolveAttempt };
type PhaseParams = {
  readonly db: Database;
  readonly id: string;
  readonly phase: ResolveAttemptPhase;
  readonly error?: string | null;
  readonly failureCause?: ResolveFailureCause | null;
};
type Row = Omit<ResolveAttempt, 'threadIds' | 'mountTarget' | 'launchChoice' | 'failureCause'> & {
  readonly threadIds: string;
  readonly failureCause: string | null;
  readonly launchChoice: string | null;
  readonly mountId: string | null;
  readonly mountRevision: number | null;
  readonly worktreePath: string | null;
};

const COLUMNS = `id, session_id AS sessionId, agent_id AS agentId, pr_number AS prNumber,
  thread_ids_json AS threadIds, provider, model, effort, instructions,
  human_instructions AS humanInstructions, phase, mount_id AS mountId, mount_revision AS mountRevision, worktree_path AS worktreePath,
  started_at AS startedAt, ended_at AS endedAt, error, failure_cause AS failureCause, created_at AS createdAt,
  batch_id AS batchId, copy_path AS copyPath, launch_choice_json AS launchChoice,
  launch_id AS launchId, retry_of_launch_id AS retryOfLaunchId`;

const failureCauseOf = ({ raw }: { readonly raw: string | null }): ResolveFailureCause | null =>
  RESOLVE_FAILURE_CAUSES.find((cause) => cause === raw) ?? null;

const hydrate = ({ row }: { readonly row: Row }): ResolveAttempt => {
  const { mountId, mountRevision, worktreePath, failureCause, ...attempt } = row;
  return {
    ...attempt,
    failureCause: failureCauseOf({ raw: failureCause }),
    threadIds: resolveStringArray({ json: row.threadIds }),
    launchChoice: parseLaunchChoice({ json: row.launchChoice }),
    mountTarget: toMountTarget({ mountId, mountRevision, worktreePath }),
  };
};

export const listResolveAttempts = async ({
  db,
  sessionId,
}: ListParams): Promise<ReadonlyArray<ResolveAttempt>> => {
  const rows = await db.select<Row>(
    `SELECT ${COLUMNS} FROM resolve_attempts WHERE session_id = ? ORDER BY created_at, rowid`,
    [sessionId],
  );
  return rows.map((row) => hydrate({ row }));
};

export const listActiveResolveAttempts = async ({
  db,
}: {
  readonly db: Database;
}): Promise<ReadonlyArray<ResolveAttempt>> => {
  const rows = await db.select<Row>(
    `SELECT ${COLUMNS} FROM resolve_attempts WHERE phase IN ('queued', 'running') ORDER BY created_at, rowid`,
  );
  return rows.map((row) => hydrate({ row }));
};

export const insertResolveAttempt = async ({ db, attempt }: InsertParams): Promise<void> => {
  const target = fromMountTarget({ target: attempt.mountTarget });
  await db.execute(
    `INSERT INTO resolve_attempts (id, session_id, agent_id, pr_number, thread_ids_json, provider, model, effort, instructions, human_instructions, phase, mount_id, mount_revision, worktree_path, started_at, ended_at, error, created_at, batch_id, copy_path, launch_choice_json, launch_id, retry_of_launch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET provider = excluded.provider, model = excluded.model,
      effort = excluded.effort, instructions = excluded.instructions,
      human_instructions = excluded.human_instructions, phase = excluded.phase,
      thread_ids_json = excluded.thread_ids_json,
      mount_id = excluded.mount_id, mount_revision = excluded.mount_revision,
      worktree_path = excluded.worktree_path,
      batch_id = COALESCE(excluded.batch_id, resolve_attempts.batch_id),
      copy_path = COALESCE(excluded.copy_path, resolve_attempts.copy_path),
      launch_choice_json = COALESCE(excluded.launch_choice_json, resolve_attempts.launch_choice_json),
      launch_id = COALESCE(excluded.launch_id, resolve_attempts.launch_id),
      retry_of_launch_id = COALESCE(excluded.retry_of_launch_id, resolve_attempts.retry_of_launch_id),
      started_at = COALESCE(resolve_attempts.started_at, excluded.started_at)
    WHERE resolve_attempts.phase IN ('queued', 'running')`,
    [
      attempt.id,
      attempt.sessionId,
      attempt.agentId,
      attempt.prNumber,
      JSON.stringify(attempt.threadIds),
      attempt.provider,
      attempt.model,
      attempt.effort,
      attempt.instructions,
      attempt.humanInstructions ?? null,
      attempt.phase,
      target.mountId,
      target.mountRevision,
      target.worktreePath,
      attempt.startedAt,
      attempt.endedAt,
      attempt.error,
      attempt.createdAt,
      attempt.batchId,
      attempt.copyPath,
      serializeLaunchChoice({ choice: attempt.launchChoice }),
      attempt.launchId ?? null,
      attempt.retryOfLaunchId ?? null,
    ],
  );
};

export const setResolveAttemptPhase = async ({
  db,
  id,
  phase,
  error = null,
  failureCause = null,
}: PhaseParams): Promise<void> => {
  const now = Date.now();
  const isTerminal = phase === 'finished' || phase === 'failed' || phase === 'cancelled';
  await db.execute(
    `UPDATE resolve_attempts SET phase = ?, error = ?, failure_cause = ?, started_at = CASE WHEN ? = 'running' THEN COALESCE(started_at, ?) ELSE started_at END, ended_at = CASE WHEN ? THEN ? WHEN ? IN ('running', 'queued') THEN NULL ELSE ended_at END WHERE id = ?`,
    [phase, error, failureCause, phase, now, Number(isTerminal), now, phase, id],
  );
};

export const setResolveAttemptFailureCause = async ({
  db,
  id,
  failureCause,
}: {
  readonly db: Database;
  readonly id: string;
  readonly failureCause: ResolveFailureCause | null;
}): Promise<void> => {
  await db.execute('UPDATE resolve_attempts SET failure_cause = ? WHERE id = ?', [
    failureCause,
    id,
  ]);
};

export const setResolveAttemptCopyPath = async ({
  db,
  id,
  copyPath,
}: {
  readonly db: Database;
  readonly id: string;
  readonly copyPath: string | null;
}): Promise<void> => {
  await db.execute('UPDATE resolve_attempts SET copy_path = ? WHERE id = ?', [copyPath, id]);
};
