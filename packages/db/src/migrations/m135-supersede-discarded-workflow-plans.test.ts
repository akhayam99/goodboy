import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-08-27T10:00:00.000Z');

const seedThrough134 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 134),
  );
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-1', 'Workspace', 'workspace', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at)
     VALUES ('workflow-1', 'workspace-1', 'Workflow', '', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('session-1', 'workspace-1', 'Goal', 'idle', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status)
     VALUES ('agent-1', 'session-1', 0, 'Planner', 'completed')`,
  );
  await db.execute(
    `INSERT INTO session_workflows (
       workflow_run_id, session_id, workflow_id, ordinal, discarded_at, created_at
     ) VALUES
       ('run-discarded', 'session-1', 'workflow-1', 0, ?, ?),
       ('run-live', 'session-1', 'workflow-1', 1, NULL, ?)`,
    [NOW, NOW, NOW],
  );
  await db.execute(
    `INSERT INTO session_plans (
       id, session_id, agent_id, workflow_run_id, title, body_md, status, created_at, updated_at
     ) VALUES
       ('plan-discarded', 'session-1', 'agent-1', 'run-discarded', 'Discarded', 'Body', 'active', ?, ?),
       ('plan-live', 'session-1', 'agent-1', 'run-live', 'Live', 'Body', 'active', ?, ?),
       ('plan-runless', 'session-1', 'agent-1', NULL, 'Runless', 'Body', 'active', ?, ?)`,
    [NOW, NOW, NOW, NOW, NOW, NOW],
  );
  return db;
};

describe('m135 supersede discarded workflow plans', () => {
  it('supersedes active plans from discarded runs without touching actionable plans', async () => {
    const db = await seedThrough134();

    await migrate(db, migrations);

    const rows = await db.select<{ readonly id: string; readonly status: string }>(
      'SELECT id, status FROM session_plans ORDER BY id ASC',
    );
    expect(rows).toEqual([
      { id: 'plan-discarded', status: 'superseded' },
      { id: 'plan-live', status: 'active' },
      { id: 'plan-runless', status: 'active' },
    ]);
  });
});
