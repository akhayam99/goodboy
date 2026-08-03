import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';

const seedThrough99 = async () => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 99),
  );
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['s-1', workspaceId, 'goal', 'idle', now, now],
  );
  return db;
};

const insertWorkflow = async (
  db: Awaited<ReturnType<typeof seedThrough99>>,
  id: string,
  name = id,
) => {
  await db.execute(
    `INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, workspaceId, name, '', new Date().toISOString(), new Date().toISOString()],
  );
};

const originOf = async (
  db: Awaited<ReturnType<typeof seedThrough99>>,
  id: string,
): Promise<string | null> => {
  const rows = await db.select<{ origin: string | null }>(
    'SELECT origin FROM workflows WHERE id = ?',
    [id],
  );
  return rows[0]?.origin ?? null;
};

describe('m100 workflow origin', () => {
  it('reads the origin off rows that predate the column', async () => {
    const db = await seedThrough99();
    await insertWorkflow(db, `wf_seed_refactor-example_${workspaceId}`);
    await insertWorkflow(db, 'wf_builder_dynamic');
    await insertWorkflow(db, 'wf_builder_static');
    await db.execute(
      `INSERT INTO session_workflows
         (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run,
          trigger_mode, execution_mode)
       VALUES (?, ?, ?, 0, 0, 0, 'immediate', 'dynamic')`,
      ['run-1', 's-1', 'wf_builder_dynamic'],
    );

    await migrate(db, migrations);

    expect(await originOf(db, `wf_seed_refactor-example_${workspaceId}`)).toBe('library');
    expect(await originOf(db, 'wf_builder_dynamic')).toBe('orchestrated');
    expect(await originOf(db, 'wf_builder_static')).toBe('custom');
  });

  it('still recognises an orchestrated workflow whose run is gone', async () => {
    const db = await seedThrough99();
    await insertWorkflow(db, 'wf_by_name', 'Orchestrated workflow');
    await insertWorkflow(db, 'wf_by_name_deduped', 'Orchestrated workflow 2');
    await insertWorkflow(db, 'wf_by_step', 'Ship the thing');
    await db.execute(
      `INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix, orchestrator_reason)
       VALUES (?, ?, 0, 'Scout', 'map it', 'the diff touches two packages')`,
      ['step-1', 'wf_by_step'],
    );

    await migrate(db, migrations);

    expect(await originOf(db, 'wf_by_name')).toBe('orchestrated');
    expect(await originOf(db, 'wf_by_name_deduped')).toBe('orchestrated');
    expect(await originOf(db, 'wf_by_step')).toBe('orchestrated');
  });

  it('does not read a hand-built workflow as orchestrated', async () => {
    const db = await seedThrough99();
    await insertWorkflow(db, 'wf_plain', 'Orchestrated workflows, a guide');
    await db.execute(
      `INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix)
       VALUES (?, ?, 0, 'Scout', 'map it')`,
      ['step-2', 'wf_plain'],
    );

    await migrate(db, migrations);

    expect(await originOf(db, 'wf_plain')).toBe('custom');
  });
});
