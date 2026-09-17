import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 159);

const EVIDENCE = JSON.stringify([{ kind: 'session', id: 'session', label: 'ship notify-relay' }]);

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db, before);
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
       design_profile_summary, source_workflow_run_id, executing_workflow_run_id, created_at
     ) VALUES ('agent', 'session', 'wireframe', null, ?, '[]', 'theme name: generic', null, null, 1000)`,
    [EVIDENCE],
  );
  return db;
};

type EvidenceRow = {
  readonly agent_id: string;
  readonly has_design_evidence: number;
};

describe('m159 artifact design evidence', () => {
  it('reads an existing row as having found no design evidence', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const rows = await db.select<EvidenceRow>(
      'SELECT agent_id, has_design_evidence FROM artifact_provenance',
    );
    expect(rows).toEqual([{ agent_id: 'agent', has_design_evidence: 0 }]);
  });

  it('stores the fact the walk reported', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await db.execute('UPDATE artifact_provenance SET has_design_evidence = 1 WHERE agent_id = ?', [
      'agent',
    ]);
    const rows = await db.select<EvidenceRow>(
      'SELECT agent_id, has_design_evidence FROM artifact_provenance',
    );
    expect(rows[0]?.has_design_evidence).toBe(1);
  });

  it('refuses a value that is neither found nor not found', async () => {
    const db = await seed();
    await migrate(db, migrations);
    await expect(
      db.execute('UPDATE artifact_provenance SET has_design_evidence = 2 WHERE agent_id = ?', [
        'agent',
      ]),
    ).rejects.toThrow();
  });
});
