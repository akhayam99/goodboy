import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 175);

const seed = async (db: ReturnType<typeof makeTestDatabase>): Promise<void> => {
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('w1', 'Northwind', 'northwind', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('s1', 'w1', 'goal', 'idle', 1, 1)",
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status)
     VALUES ('container', 's1', 0, 'implementation', 'running')`,
  );
  await db.execute(
    `INSERT INTO cluster_execution_graphs
       (container_agent_id, session_id, workflow_run_id, plan_id, goal_title, execution_version,
        graph_json, created_at)
     VALUES ('container', 's1', NULL, NULL, 'goal', 2, '[]', 1)`,
  );
  await db.execute(
    `INSERT INTO cluster_execution_nodes (container_agent_id, node_id, agent_id, ordinal, role)
     VALUES ('container', 'discovery', NULL, 0, 'scout')`,
  );
};

describe('m175 cluster graph revisions', () => {
  it('starts an existing graph at revision one, unfrozen', async () => {
    const db = makeTestDatabase();
    await migrate(db, before);
    await seed(db);
    await migrate(db, migrations);
    const rows = await db.select<{
      readonly revision: number;
      readonly frozen_reason: string | null;
      readonly frozen_obligation_id: string | null;
    }>('SELECT revision, frozen_reason, frozen_obligation_id FROM cluster_execution_graphs');
    expect(rows).toEqual([{ revision: 1, frozen_reason: null, frozen_obligation_id: null }]);
  });

  it('starts an existing node active, unsuperseded and without a reused result', async () => {
    const db = makeTestDatabase();
    await migrate(db, before);
    await seed(db);
    await migrate(db, migrations);
    const rows = await db.select<{
      readonly state: string;
      readonly superseded_by: string | null;
      readonly revision: number;
      readonly result_state: string;
    }>('SELECT state, superseded_by, revision, result_state FROM cluster_execution_nodes');
    expect(rows).toEqual([
      { state: 'active', superseded_by: null, revision: 1, result_state: 'pending' },
    ]);
  });

  it('creates the revision journal', async () => {
    const db = makeTestDatabase();
    await migrate(db, migrations);
    const rows = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cluster_graph_revisions'",
    );
    expect(rows).toEqual([{ name: 'cluster_graph_revisions' }]);
  });
});
