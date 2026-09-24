import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 160);

const EVIDENCE = JSON.stringify([{ kind: 'session', id: 'session', label: 'ship notify-relay' }]);

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 159 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Northwind', 'northwind', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'ship notify-relay', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'High fidelity', 'completed')",
  );
  await db.execute(
    `INSERT INTO artifact_provenance (
       agent_id, session_id, kind, brief, evidence_json, omissions_json,
       design_profile_summary, has_design_evidence, source_workflow_run_id,
       executing_workflow_run_id, created_at
     ) VALUES ('agent', 'session', 'wireframe', 'draw the inbox', ?, '["agents: kept the last 12 of 30"]', 'theme name: generic', 1, null, null, 1000)`,
    [EVIDENCE],
  );
  return db;
};

type RunRow = {
  readonly agent_id: string;
  readonly brief: string | null;
  readonly evidence_json: string;
  readonly omissions_json: string;
  readonly design_profile_summary: string | null;
  readonly has_design_evidence: number;
  readonly phase: string;
  readonly scout_plan_json: string;
  readonly mount_ids_json: string;
  readonly target: string | null;
  readonly deadline_at: number | null;
};

const RUN_SELECT = `SELECT agent_id, brief, evidence_json, omissions_json, design_profile_summary,
  has_design_evidence, phase, scout_plan_json, mount_ids_json, target, deadline_at
  FROM artifact_provenance`;

describe('m160 artifact run phase', () => {
  it('reads a row written before the migration as a finished run', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const rows = await db.select<RunRow>(RUN_SELECT);
    expect(rows[0]?.phase).toBe('done');
    expect(rows[0]?.scout_plan_json).toBe('[]');
    expect(rows[0]?.mount_ids_json).toBe('[]');
    expect(rows[0]?.target).toBeNull();
    expect(rows[0]?.deadline_at).toBeNull();
  });

  it('keeps everything the earlier migrations stored', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const rows = await db.select<RunRow>(RUN_SELECT);
    expect(rows[0]?.brief).toBe('draw the inbox');
    expect(rows[0]?.evidence_json).toBe(EVIDENCE);
    expect(rows[0]?.omissions_json).toBe('["agents: kept the last 12 of 30"]');
    expect(rows[0]?.design_profile_summary).toBe('theme name: generic');
    expect(rows[0]?.has_design_evidence).toBe(1);
  });

  it('stores a run that is still gathering evidence', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const plan = JSON.stringify([
      { roleId: 'screens', mountId: 'mount', reason: 'the goal names a route', agentId: null },
    ]);
    await db.execute(
      `UPDATE artifact_provenance SET phase = 'gathering', scout_plan_json = ?,
         mount_ids_json = '["mount"]', target = 'mobile', deadline_at = 361000
       WHERE agent_id = 'agent'`,
      [plan],
    );
    const rows = await db.select<RunRow>(RUN_SELECT);
    expect(rows[0]?.phase).toBe('gathering');
    expect(rows[0]?.scout_plan_json).toBe(plan);
    expect(rows[0]?.mount_ids_json).toBe('["mount"]');
    expect(rows[0]?.target).toBe('mobile');
    expect(rows[0]?.deadline_at).toBe(361000);
  });

  it('refuses a phase the run can never be in', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await expect(
      db.execute("UPDATE artifact_provenance SET phase = 'scouting' WHERE agent_id = 'agent'"),
    ).rejects.toThrow();
  });

  it('refuses a scout plan that is not an array', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await expect(
      db.execute(`UPDATE artifact_provenance SET scout_plan_json = '{}' WHERE agent_id = 'agent'`),
    ).rejects.toThrow();
  });

  it('refuses mount ids that are not an array', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await expect(
      db.execute(
        `UPDATE artifact_provenance SET mount_ids_json = 'mount' WHERE agent_id = 'agent'`,
      ),
    ).rejects.toThrow();
  });
});
