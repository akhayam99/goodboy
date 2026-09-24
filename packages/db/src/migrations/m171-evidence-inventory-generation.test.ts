import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 171);

describe('m171 evidence inventory and generation ledger', () => {
  it('seeds the ledger with the lineage that existed before the upgrade', async () => {
    const db = makeTestDatabase();
    await migrate(db, before);
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('w1', 'Northwind', 'northwind', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('s1', 'w1', 'goal', 'idle', 1, 1)",
    );
    await db.execute(
      `INSERT INTO agents (id, session_id, ordinal, name, status, parent_agent_id)
       VALUES ('root', 's1', 0, 'root', 'completed', NULL),
              ('child', 's1', 1, 'child', 'completed', 'root'),
              ('grandchild', 's1', 2, 'grandchild', 'completed', 'child')`,
    );
    await migrate(db, migrations);

    const rows = await db.select<{
      readonly agent_id: string;
      readonly causal_root_agent_id: string;
      readonly depth: number;
      readonly creation_path: string;
    }>(
      'SELECT agent_id, causal_root_agent_id, depth, creation_path FROM agent_generation_ledger ORDER BY depth',
    );
    expect(rows).toEqual([
      { agent_id: 'child', causal_root_agent_id: 'root', depth: 1, creation_path: 'legacy' },
      { agent_id: 'grandchild', causal_root_agent_id: 'root', depth: 2, creation_path: 'legacy' },
    ]);
  });

  it('scopes a refusal to its session rather than the whole database', async () => {
    const db = makeTestDatabase();
    await migrate(db, migrations);
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('w1', 'Northwind', 'northwind', 1, 1)",
    );
    for (const id of ['s1', 's2']) {
      await db.execute(
        "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, 'w1', 'goal', 'idle', 1, 1)",
        [id],
      );
    }
    const refuse = (id: string, session: string) =>
      db.execute(
        `INSERT OR IGNORE INTO generation_refusals
           (id, session_id, parent_agent_id, scope_key, limit_name, reason, created_at)
         VALUES (?, ?, NULL, 'session', 'depth', 'past the cap', 1)`,
        [id, session],
      );

    const first = await refuse('r1', 's1');
    const repeat = await refuse('r2', 's1');
    const other = await refuse('r3', 's2');

    expect([first.rowsAffected, repeat.rowsAffected, other.rowsAffected]).toEqual([1, 0, 1]);
  });
});
