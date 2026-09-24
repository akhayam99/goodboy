import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase, makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const EVIDENCE = JSON.stringify([
  { kind: 'session', id: 'session', label: 'ship notify-relay' },
  { kind: 'agent', id: 'agent', label: 'Harborline reviewer' },
]);

const OMISSIONS = JSON.stringify(['agent agent: final message truncated']);

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Northwind', 'northwind', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'ship notify-relay', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('workflow', 'workspace', 'Delivery', 1, 1)",
  );
  await db.execute(
    `INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, created_at)
     VALUES ('run-source', 'session', 'workflow', 0, 0, 1)`,
  );
  await db.execute(
    `INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, created_at)
     VALUES ('run-executing', 'session', 'workflow', 1, 0, 1)`,
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'Reporter', 'completed')",
  );
  return db;
};

type ProvenanceRow = {
  readonly agent_id: string;
  readonly session_id: string;
  readonly kind: string;
  readonly brief: string | null;
  readonly evidence_json: string;
  readonly omissions_json: string;
  readonly design_profile_summary: string | null;
  readonly source_workflow_run_id: string | null;
  readonly executing_workflow_run_id: string | null;
  readonly created_at: number;
};

const insertRow = async (db: Database, overrides: Partial<ProvenanceRow> = {}) => {
  const row = {
    agent_id: 'agent',
    session_id: 'session',
    kind: 'report',
    brief: 'explain what changed in ledger-core',
    evidence_json: EVIDENCE,
    omissions_json: OMISSIONS,
    design_profile_summary: null,
    source_workflow_run_id: 'run-source',
    executing_workflow_run_id: 'run-executing',
    created_at: 1000,
    ...overrides,
  };
  await db.execute(
    `INSERT INTO artifact_provenance (
       agent_id, session_id, kind, brief, evidence_json, omissions_json,
       design_profile_summary, source_workflow_run_id, executing_workflow_run_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.agent_id,
      row.session_id,
      row.kind,
      row.brief,
      row.evidence_json,
      row.omissions_json,
      row.design_profile_summary,
      row.source_workflow_run_id,
      row.executing_workflow_run_id,
      row.created_at,
    ],
  );
};

describe('m158 artifact provenance', () => {
  it('stores a generation request with both workflow runs kept apart', async () => {
    const db = await seed();
    await insertRow(db);
    const rows = await db.select<ProvenanceRow>('SELECT * FROM artifact_provenance');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source_workflow_run_id).toBe('run-source');
    expect(rows[0]?.executing_workflow_run_id).toBe('run-executing');
    expect(JSON.parse(rows[0]?.evidence_json ?? 'null')).toHaveLength(2);
    expect(JSON.parse(rows[0]?.omissions_json ?? 'null')).toEqual([
      'agent agent: final message truncated',
    ]);
  });

  it('leaves every earlier table untouched', async () => {
    const db = await seed();
    const artifacts = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('session_artifacts', 'artifact_renditions', 'plan_consumptions')",
    );
    expect(artifacts.map((row) => row.name).sort()).toEqual([
      'artifact_renditions',
      'plan_consumptions',
      'session_artifacts',
    ]);
  });

  it('refuses a kind outside the artifact kinds', async () => {
    const db = await seed();
    await expect(insertRow(db, { kind: 'diagram' })).rejects.toThrow();
  });

  it('refuses an evidence inventory that is not a json array', async () => {
    const db = await seed();
    await expect(insertRow(db, { evidence_json: '{"sources":[]}' })).rejects.toThrow();
    await expect(insertRow(db, { evidence_json: 'not json' })).rejects.toThrow();
  });

  it('refuses a row whose agent does not exist', async () => {
    const db = await seed();
    await expect(insertRow(db, { agent_id: 'ghost' })).rejects.toThrow();
  });

  it('drops the row when its agent goes away', async () => {
    const db = await seed();
    await insertRow(db);
    await db.execute("DELETE FROM agents WHERE id = 'agent'");
    const rows = await db.select('SELECT agent_id FROM artifact_provenance');
    expect(rows).toEqual([]);
  });

  it('keeps the row when a referenced workflow run goes away', async () => {
    const db = await seed();
    await insertRow(db);
    await db.execute("DELETE FROM session_workflows WHERE workflow_run_id = 'run-source'");
    const rows = await db.select<ProvenanceRow>('SELECT * FROM artifact_provenance');
    expect(rows[0]?.source_workflow_run_id).toBeNull();
    expect(rows[0]?.executing_workflow_run_id).toBe('run-executing');
  });

  it('applies once and leaves the row in place when the runner runs again', async () => {
    const db = await seed();
    await insertRow(db);
    const result = await migrate(db, migrations);
    expect(result.applied).toEqual([]);
    const rows = await db.select<ProvenanceRow>('SELECT agent_id FROM artifact_provenance');
    expect(rows).toHaveLength(1);
    const violations = await db.select('PRAGMA foreign_key_check');
    expect(violations).toEqual([]);
  });

  it('applies version 158 on a fresh database', async () => {
    const db = makeTestDatabase();
    const result = await migrate(db, migrations);
    expect(result.currentVersion).toBe(migrations.at(-1)?.version);
    expect(result.applied).toContain(158);
    const tables = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artifact_provenance'",
    );
    expect(tables).toEqual([{ name: 'artifact_provenance' }]);
  });
});
