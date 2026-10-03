import type { WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from './test-db';

type SeedDbParams = {
  readonly workspaceIds: ReadonlyArray<WorkspaceId>;
  readonly at: number;
};

export const seedImpactDb = async ({ workspaceIds, at }: SeedDbParams): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  for (const id of workspaceIds) {
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, id, `/tmp/${id}`, at, at],
    );
  }
  return db;
};

export type ImpactSessionSeed = {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly createdAt: number;
  readonly updatedAt?: number;
  readonly lastActivityAt?: number;
  readonly goal?: string;
};

type AddSessionParams = {
  readonly db: Database;
  readonly seed: ImpactSessionSeed;
};

export const addImpactSession = async ({ db, seed }: AddSessionParams): Promise<void> => {
  const updatedAt = seed.updatedAt ?? seed.createdAt;
  await db.execute(
    `INSERT INTO sessions
       (id, workspace_id, goal, state_kind, last_activity_at, created_at, updated_at)
     VALUES (?, ?, ?, 'idle', ?, ?, ?)`,
    [
      seed.id,
      seed.workspaceId,
      seed.goal ?? `goal ${seed.id}`,
      seed.lastActivityAt ?? updatedAt,
      seed.createdAt,
      updatedAt,
    ],
  );
};

export type ImpactTelemetrySeed = {
  readonly id: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly at: number;
  readonly kind?: string;
  readonly provider?: string;
  readonly input?: number;
  readonly cached?: number;
  readonly created?: number;
  readonly context?: number | null;
  readonly cost?: number;
};

type AddTelemetryParams = {
  readonly db: Database;
  readonly seed: ImpactTelemetrySeed;
};

export const addImpactTelemetry = async ({ db, seed }: AddTelemetryParams): Promise<void> => {
  await db.execute(
    `INSERT OR IGNORE INTO provider_runs (id, session_id, provider, model, status_kind, created_at)
     VALUES (?, ?, 'anthropic', 'opus', 'succeeded', ?)`,
    [seed.runId, seed.sessionId, seed.at],
  );
  await db.execute(
    `INSERT INTO telemetry_records
       (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens,
        estimated_cost_usd, recorded_at, cached_input_tokens, cache_creation_input_tokens,
        context_tokens)
     VALUES (?, ?, ?, ?, ?, 'opus', ?, 10, ?, ?, ?, ?, ?)`,
    [
      seed.id,
      seed.runId,
      seed.sessionId,
      seed.kind ?? 'turn',
      seed.provider ?? 'anthropic',
      seed.input ?? 100,
      seed.cost ?? 0.1,
      seed.at,
      seed.cached ?? 0,
      seed.created ?? 0,
      seed.context ?? null,
    ],
  );
};

export type ImpactMountSeed = {
  readonly id: string;
  readonly sessionId: string;
  readonly branch: string;
  readonly repoSlug?: string | null;
  readonly projectId?: string | null;
  readonly at: number;
};

type AddMountParams = {
  readonly db: Database;
  readonly seed: ImpactMountSeed;
};

export const addImpactMount = async ({ db, seed }: AddMountParams): Promise<void> => {
  const indexRows = await db.select<{ count: number }>(
    'SELECT COUNT(*) AS count FROM session_worktrees WHERE session_id = ?',
    [seed.sessionId],
  );
  await db.execute(
    `INSERT INTO session_worktrees
       (id, session_id, worktree_path, branch, parallel_index, repo_slug, project_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      seed.id,
      seed.sessionId,
      `/tmp/${seed.id}`,
      seed.branch,
      indexRows[0]?.count ?? 0,
      seed.repoSlug === undefined ? 'acme/ledger-core' : seed.repoSlug,
      seed.projectId ?? null,
      seed.at,
    ],
  );
};

export type ImpactLinkSeed = {
  readonly id: string;
  readonly mountId: string;
  readonly number: number;
  readonly state: string;
  readonly at: number;
  readonly repoSlug?: string;
  readonly host?: string;
  readonly title?: string;
  readonly branch?: string;
  readonly mergedAt?: number | null;
};

type AddLinkParams = {
  readonly db: Database;
  readonly seed: ImpactLinkSeed;
};

export const addImpactLink = async ({ db, seed }: AddLinkParams): Promise<void> => {
  const repoSlug = seed.repoSlug ?? 'acme/ledger-core';
  const host = seed.host ?? 'github.com';
  await db.execute(
    `INSERT INTO mount_pr_links
       (id, mount_id, provider, host, repo_slug, pr_number, head_branch, base_branch, url,
        state, snapshot_json, merged_at, last_observed_at, created_at, updated_at)
     VALUES (?, ?, 'github', ?, ?, ?, ?, 'main', ?, ?, ?, ?, ?, ?, ?)`,
    [
      seed.id,
      seed.mountId,
      host,
      repoSlug,
      seed.number,
      seed.branch ?? `feature/${seed.number}`,
      `https://${host}/${repoSlug}/pull/${seed.number}`,
      seed.state,
      JSON.stringify({ number: seed.number, title: seed.title ?? `pull request ${seed.number}` }),
      seed.mergedAt === undefined ? (seed.state === 'merged' ? seed.at : null) : seed.mergedAt,
      seed.at,
      seed.at,
      seed.at,
    ],
  );
};

export type ImpactEventSeed = {
  readonly id: string;
  readonly sessionId: string;
  readonly kind: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly at: number;
};

type AddEventParams = {
  readonly db: Database;
  readonly seed: ImpactEventSeed;
};

export const addImpactEvent = async ({ db, seed }: AddEventParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_events (id, session_id, kind, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [seed.id, seed.sessionId, seed.kind, JSON.stringify(seed.payload), seed.at],
  );
};
