import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 166);

describe('m166 capability obligations', () => {
  it('creates request, obligation and hold association storage', async () => {
    const db = makeTestDatabase();
    await migrate(db, before);
    await migrate(db, migrations);

    const rows = await db.select<{ readonly name: string }>(
      `SELECT name FROM sqlite_master
        WHERE type = 'table'
          AND name IN ('capability_obligations', 'capability_requests', 'capability_obligation_holds')
        ORDER BY name`,
    );
    expect(rows).toEqual([
      { name: 'capability_obligation_holds' },
      { name: 'capability_obligations' },
      { name: 'capability_requests' },
    ]);
  });

  it('backfills execution purposes only where creation records establish them', async () => {
    const db = makeTestDatabase();
    await migrate(db, before);
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('w1', 'Northwind', 'northwind', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('s1', 'w1', 'goal', 'idle', 1, 1)",
    );
    await db.execute(
      `INSERT INTO agents (id, session_id, ordinal, name, status, kind, parent_agent_id, source_kind)
       VALUES ('root', 's1', 0, 'root', 'completed', 'planner', NULL, NULL),
              ('child-implementer', 's1', 1, 'handoff child', 'completed', 'implementer', 'root', NULL),
              ('child-delegate', 's1', 2, 'delegate', 'completed', 'scout', 'root', 'open_question'),
              ('child-ambiguous', 's1', 3, 'scout child', 'completed', 'scout', 'root', NULL)`,
    );
    await migrate(db, migrations);

    const rows = await db.select<{
      readonly id: string;
      readonly execution_purpose: string | null;
    }>('SELECT id, execution_purpose FROM agents ORDER BY ordinal');
    expect(rows).toEqual([
      { id: 'root', execution_purpose: 'standalone' },
      { id: 'child-implementer', execution_purpose: null },
      { id: 'child-delegate', execution_purpose: 'question-delegate' },
      { id: 'child-ambiguous', execution_purpose: null },
    ]);
  });
});
