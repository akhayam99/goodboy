import { describe, expect, it } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { seedImpactDb } from '../test-helpers/impact-seeds';
import { getTurnRoleInsight } from './turn-role-insight';

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const DAY_MS = 86_400_000;
const NOW = Date.now();
const SPANS = 15_000;
const AGENTS = 600;
const RUNS = 25;
const P95_BUDGET_MS = 150;

const seedHeavyMonth = async (): Promise<Database> => {
  const db = await seedImpactDb({ workspaceIds: [WORKSPACE], at: NOW - 60 * DAY_MS });
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('s-ledger', ?, 'Reconcile ledger-core', 'idle', ?, ?)`,
    [WORKSPACE, NOW, NOW],
  );
  await db.execute(
    `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < ? - 1)
     INSERT INTO agents (id, session_id, ordinal, name, status, routing_lock, routing_decision)
     SELECT 'a-' || i, 's-ledger', i, 'agent ' || i, 'completed',
            CASE WHEN i % 7 = 0 THEN '{"version":1,"pick":{"provider":"anthropic","model":"opus","effort":"high"},"origin":"user"}' END,
            CASE WHEN i % 3 = 0 THEN '{"version":1,"source":"heuristic"}' END
       FROM n`,
    [AGENTS],
  );
  await db.execute(
    `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < ? - 1)
     INSERT INTO agent_turn_spans
       (run_id, agent_id, session_id, workspace_id, step_role, provider, model, effort,
        started_at, ended_at, end_reason, cost_usd)
     SELECT 'run-' || i, 'a-' || (i % ${AGENTS}), 's-ledger', ?,
            CASE i % 6 WHEN 0 THEN 'implementer' WHEN 1 THEN 'scout' WHEN 2 THEN 'reviewer'
                       WHEN 3 THEN 'tester' WHEN 4 THEN 'planner' ELSE 'docs' END,
            CASE WHEN i % 4 = 0 THEN 'codex' ELSE 'anthropic' END,
            CASE i % 5 WHEN 0 THEN 'opus' WHEN 1 THEN 'haiku' WHEN 2 THEN 'sol' ELSE 'sonnet' END,
            CASE i % 4 WHEN 0 THEN 'low' WHEN 1 THEN 'medium' WHEN 2 THEN 'high' END,
            ? - (i % 45) * ? - 60000, ? - (i % 45) * ?,
            CASE WHEN i % 20 = 0 THEN 'failed' ELSE 'succeeded' END, 0.12
       FROM n`,
    [SPANS, WORKSPACE, NOW, DAY_MS, NOW, DAY_MS],
  );
  return db;
};

type PlanRow = {
  readonly detail: string;
};

describe('turn role insight on a heavy month', () => {
  it('groups 15k turns within its p95 budget, on the span index', async () => {
    const db = await seedHeavyMonth();
    const params = { db, workspaceId: WORKSPACE, sinceMs: NOW - 30 * DAY_MS };
    await getTurnRoleInsight(params);

    const timings: Array<number> = [];
    for (let run = 0; run < RUNS; run += 1) {
      const startedAt = performance.now();
      await getTurnRoleInsight(params);
      timings.push(performance.now() - startedAt);
    }
    const sorted = [...timings].sort((left, right) => left - right);
    const p95 = sorted[Math.ceil(RUNS * 0.95) - 1] ?? Number.POSITIVE_INFINITY;

    const plan = await db.select<PlanRow>(
      `EXPLAIN QUERY PLAN
       SELECT step_role, provider, model, effort, COUNT(*) FROM agent_turn_spans
        WHERE workspace_id = ? AND ended_at >= ?
        GROUP BY step_role, provider, model, effort`,
      [WORKSPACE, NOW - 30 * DAY_MS],
    );
    const insight = await getTurnRoleInsight(params);

    expect(p95).toBeLessThan(P95_BUDGET_MS);
    expect(plan.map((row) => row.detail).join('\n')).toContain('idx_agent_turn_spans_estimate');
    expect(insight.turns).toBe(
      Array.from({ length: SPANS }, (_, index) => index % 45).filter((day) => day <= 30).length,
    );
  });
});
