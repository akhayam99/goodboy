import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { seedImpactDb } from '../test-helpers/impact-seeds';
import {
  getAgentDurations,
  getCacheEfficiency,
  getContextGrowth,
  getExternalTaskOutcomes,
  getFlowHealth,
  getImpactOverview,
  getPullRequestOutcomes,
  getReviewOutcomes,
  getRightSizeNudgeOutcomes,
  getTurnDistribution,
  type ImpactQueryParams,
} from './impact';

const WORKSPACE = 'ws-harborline' as WorkspaceId;
const DAY_MS = 86_400_000;
const NOW = Date.now();
const SESSIONS = 2000;
const TELEMETRY_ROWS = 10_000;
const QUERIES_PER_WINDOW = 23;
const WINDOW_BUDGET_MS = 2000;

const seedLargeWorkspace = async (): Promise<Database> => {
  const db = await seedImpactDb({ workspaceIds: [WORKSPACE], at: NOW - 400 * DAY_MS });
  await db.execute(
    `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < ? - 1)
     INSERT INTO sessions
       (id, workspace_id, goal, state_kind, last_activity_at, created_at, updated_at, deleted_at)
     SELECT 's-' || i, ?, 'Reconcile batch ' || i, 'idle',
            ? - (i % 90) * ? + 3600000, ? - (i % 90) * ?, ? - (i % 90) * ?,
            CASE WHEN i % 3 = 0 THEN ? END
       FROM n`,
    [SESSIONS, WORKSPACE, NOW, DAY_MS, NOW, DAY_MS, NOW, DAY_MS, NOW],
  );
  await db.execute(
    `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < ? - 1)
     INSERT INTO provider_runs (id, session_id, provider, model, status_kind, created_at)
     SELECT 'r-' || i, 's-' || i, 'anthropic', 'opus', 'succeeded', ? FROM n`,
    [SESSIONS, NOW],
  );
  await db.execute(
    `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < ? - 1)
     INSERT INTO telemetry_records
       (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens,
        estimated_cost_usd, recorded_at, context_tokens)
     SELECT 't-' || i, 'r-' || (i % ${SESSIONS}), 's-' || (i % ${SESSIONS}), 'turn', 'anthropic', 'opus',
            1000, 100, 0.25, ? - (i % 90) * ?, 4000
       FROM n`,
    [TELEMETRY_ROWS, NOW, DAY_MS],
  );
  await db.execute(
    `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < ? - 1)
     INSERT INTO session_worktrees
       (id, session_id, worktree_path, branch, parallel_index, repo_slug, created_at)
     SELECT 'm-' || i, 's-' || i, '/tmp/m-' || i, 'batch/' || i, 0, 'acme/ledger-core', ? FROM n`,
    [SESSIONS, NOW],
  );
  await db.execute(
    `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < ? - 1)
     INSERT INTO mount_pr_links
       (id, mount_id, provider, host, repo_slug, pr_number, head_branch, url, state,
        snapshot_json, merged_at, last_observed_at, created_at, updated_at)
     SELECT 'l-' || i, 'm-' || i, 'github', 'github.com', 'acme/ledger-core', i + 1,
            'batch/' || i, 'https://github.com/acme/ledger-core/pull/' || (i + 1),
            CASE WHEN i % 2 = 0 THEN 'merged' ELSE 'open' END, '{"title":"Batch"}',
            CASE WHEN i % 2 = 0 THEN ? - (i % 90) * ? END, ?, ?, ? - (i % 90) * ?
       FROM n`,
    [SESSIONS, NOW, DAY_MS, NOW, NOW, NOW, DAY_MS],
  );
  return db;
};

type Counted = {
  readonly db: Database;
  readonly count: () => number;
};

const countingDatabase = ({ db }: { readonly db: Database }): Counted => {
  let selects = 0;
  return {
    db: {
      exec: (sql) => db.exec(sql),
      execute: (sql, params) => db.execute(sql, params),
      select: async <Row>(sql: string, params?: ReadonlyArray<unknown>) => {
        selects += 1;
        return db.select<Row>(sql, params);
      },
      transaction: (transactionParams) => db.transaction(transactionParams),
    },
    count: () => selects,
  };
};

const loadWindow = async (params: ImpactQueryParams): Promise<void> => {
  await Promise.all([
    getImpactOverview(params),
    getPullRequestOutcomes(params),
    getReviewOutcomes(params),
    getExternalTaskOutcomes(params),
    getAgentDurations(params),
    getFlowHealth(params),
    getCacheEfficiency(params),
    getContextGrowth(params),
    getTurnDistribution(params),
    getRightSizeNudgeOutcomes(params),
  ]);
};

describe('impact on a large workspace', () => {
  it('loads a window within its budget and without extra queries', async () => {
    const seeded = await seedLargeWorkspace();
    const counted = countingDatabase({ db: seeded });
    const params = {
      db: counted.db,
      workspaceId: WORKSPACE,
      sinceMs: NOW - 30 * DAY_MS,
      windowMs: 30 * DAY_MS,
    };

    const startedAt = performance.now();
    await loadWindow(params);
    const elapsed = performance.now() - startedAt;

    expect(counted.count()).toBeLessThanOrEqual(QUERIES_PER_WINDOW);
    expect(elapsed).toBeLessThan(WINDOW_BUDGET_MS);
  });

  it('counts every session and every merged pull request, deleted or not', async () => {
    const db = await seedLargeWorkspace();
    const params = { db, workspaceId: WORKSPACE, sinceMs: null };

    const overview = await getImpactOverview(params);
    const prs = await getPullRequestOutcomes(params);

    expect(overview.sessionCount).toBe(SESSIONS);
    expect(overview.deletedSessionCount).toBe(Math.ceil(SESSIONS / 3));
    expect(prs.merged).toBe(SESSIONS / 2);
  });
});
