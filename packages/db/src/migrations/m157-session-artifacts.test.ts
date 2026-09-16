import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 157);

type PlanSeed = {
  readonly id: string;
  readonly status: string;
  readonly clustersJson: string | null;
  readonly workflowRunId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
};

const CLUSTERS = JSON.stringify([
  { title: 'move files', instructions: 'relocate them' },
  { title: 'wire store', instructions: 'add the slice' },
]);

const PLANS: ReadonlyArray<PlanSeed> = [
  {
    id: 'plan-active',
    status: 'active',
    clustersJson: CLUSTERS,
    workflowRunId: 'run-1',
    createdAt: 100,
    updatedAt: 200,
  },
  {
    id: 'plan-consumed',
    status: 'consumed',
    clustersJson: null,
    workflowRunId: null,
    createdAt: 300,
    updatedAt: 400,
  },
  {
    id: 'plan-superseded',
    status: 'superseded',
    clustersJson: null,
    workflowRunId: 'run-1',
    createdAt: 500,
    updatedAt: 600,
  },
  {
    id: 'plan-discarded',
    status: 'discarded',
    clustersJson: null,
    workflowRunId: null,
    createdAt: 700,
    updatedAt: 800,
  },
];

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db, before);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('workflow', 'workspace', 'Flow', 1, 1)",
  );
  await db.execute(
    `INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, created_at)
     VALUES ('run-1', 'session', 'workflow', 0, 0, 1)`,
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'Planner', 'completed')",
  );
  for (const plan of PLANS) {
    await db.execute(
      `INSERT INTO session_plans (
         id, session_id, agent_id, title, body_md, status, created_at, updated_at,
         clusters_json, workflow_run_id
       ) VALUES (?, 'session', 'agent', ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan.id,
        `title ${plan.id}`,
        `body ${plan.id}`,
        plan.status,
        plan.createdAt,
        plan.updatedAt,
        plan.clustersJson,
        plan.workflowRunId,
      ],
    );
  }
  await db.execute(
    "INSERT INTO plan_consumptions (id, plan_id, agent_id, consumed_at) VALUES ('con-1', 'plan-consumed', 'agent', 900)",
  );
  await db.execute(
    "INSERT INTO plan_consumptions (id, plan_id, agent_id, consumed_at) VALUES ('con-2', 'plan-consumed', 'agent', 950)",
  );
  return db;
};

type ArtifactRow = {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly title: string;
  readonly source_text: string;
  readonly source_format: string;
  readonly metadata_json: string;
  readonly revision: number;
  readonly workflow_run_id: string | null;
  readonly created_at: number;
  readonly updated_at: number;
};

describe('m157 session artifacts', () => {
  it('copies every plan row into session_artifacts unchanged', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const rows = await db.select<ArtifactRow>(
      'SELECT * FROM session_artifacts ORDER BY created_at ASC',
    );
    expect(rows).toHaveLength(PLANS.length);
    expect(rows.map((row) => row.id)).toEqual(PLANS.map((plan) => plan.id));
    expect(rows.map((row) => row.status)).toEqual(PLANS.map((plan) => plan.status));
    expect(rows.map((row) => row.workflow_run_id)).toEqual(PLANS.map((plan) => plan.workflowRunId));
    expect(rows.map((row) => row.created_at)).toEqual(PLANS.map((plan) => plan.createdAt));
    expect(rows.map((row) => row.updated_at)).toEqual(PLANS.map((plan) => plan.updatedAt));
    expect(rows.every((row) => row.kind === 'plan')).toBe(true);
    expect(rows.every((row) => row.source_format === 'markdown')).toBe(true);
    expect(rows.every((row) => row.revision === 1)).toBe(true);
    expect(rows[0]?.title).toBe('title plan-active');
    expect(rows[0]?.source_text).toBe('body plan-active');
  });

  it('moves clusters into metadata and leaves plans without clusters empty', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const rows = await db.select<ArtifactRow>(
      "SELECT * FROM session_artifacts WHERE id IN ('plan-active', 'plan-consumed')",
    );
    const active = rows.find((row) => row.id === 'plan-active');
    const consumed = rows.find((row) => row.id === 'plan-consumed');
    expect(JSON.parse(active?.metadata_json ?? '{}')).toEqual({ clusters: JSON.parse(CLUSTERS) });
    expect(JSON.parse(consumed?.metadata_json ?? 'null')).toEqual({});
  });

  it('keeps every consumption row and repoints it at the artifact', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const rows = await db.select<{ readonly id: string; readonly plan_id: string }>(
      'SELECT id, plan_id FROM plan_consumptions ORDER BY id ASC',
    );
    expect(rows).toEqual([
      { id: 'con-1', plan_id: 'plan-consumed' },
      { id: 'con-2', plan_id: 'plan-consumed' },
    ]);
    const violations = await db.select('PRAGMA foreign_key_check');
    expect(violations).toEqual([]);
  });

  it('drops session_plans and cascades artifact deletes into consumptions', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const tables = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('session_plans', 'session_artifacts', 'artifact_renditions')",
    );
    expect(tables.map((table) => table.name).sort()).toEqual([
      'artifact_renditions',
      'session_artifacts',
    ]);
    await db.execute("DELETE FROM session_artifacts WHERE id = 'plan-consumed'");
    const remaining = await db.select('SELECT id FROM plan_consumptions');
    expect(remaining).toEqual([]);
  });

  it('aborts and leaves pre-migration state intact when a foreign key violation exists', async () => {
    const db = await seed();
    await db.exec('PRAGMA foreign_keys = OFF');
    await db.execute(
      `INSERT INTO session_plans (
         id, session_id, agent_id, title, body_md, status, created_at, updated_at
       ) VALUES ('plan-orphan', 'session', 'agent-missing', 'title plan-orphan', 'body plan-orphan', 'active', 1000, 1000)`,
    );
    await db.exec('PRAGMA foreign_keys = ON');

    await expect(migrate(db, migrations)).rejects.toThrow(
      /Migration v157: foreign key violation detected in session_artifacts \(1 row\)/,
    );

    const versions = await db.select<{ readonly version: number }>(
      'SELECT version FROM schema_version WHERE version = 157',
    );
    expect(versions).toEqual([]);

    const tables = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'session_artifacts'",
    );
    expect(tables).toEqual([]);

    const plans = await db.select<{ readonly id: string }>(
      'SELECT id FROM session_plans ORDER BY id ASC',
    );
    expect(plans.map((plan) => plan.id)).toEqual([
      'plan-active',
      'plan-consumed',
      'plan-discarded',
      'plan-orphan',
      'plan-superseded',
    ]);
  });

  it('refuses a consumption that points at a non-plan artifact', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await db.execute(
      `INSERT INTO session_artifacts (
         id, session_id, agent_id, workflow_run_id, kind, schema_version, title, source_format,
         source_text, metadata_json, status, revision, created_at, updated_at
       ) VALUES ('report-1', 'session', 'agent', NULL, 'report', 1, 'Report', 'markdown',
         'body', '{"reportType":"session-summary"}', 'active', 1, 1000, 1000)`,
    );
    await expect(
      db.execute(
        "INSERT INTO plan_consumptions (id, plan_id, agent_id, consumed_at) VALUES ('con-3', 'report-1', 'agent', 1100)",
      ),
    ).rejects.toThrow();
  });
});
