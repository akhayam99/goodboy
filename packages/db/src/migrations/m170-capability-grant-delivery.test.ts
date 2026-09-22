import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 170);

const seed = async (db: ReturnType<typeof makeTestDatabase>): Promise<void> => {
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('w1', 'Northwind', 'northwind', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('s1', 'w1', 'goal', 'idle', 1, 1)",
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status)
     VALUES ('a1', 's1', 0, 'reviewer', 'completed')`,
  );
  await db.execute(
    `INSERT INTO capability_obligations
       (id, session_id, identity, requester_agent_id, target_role, purpose, state, created_at, updated_at)
     VALUES ('obl-1', 's1', 'a1:implementer:repair', 'a1', 'implementer', 'repair', 'open', 1, 1)`,
  );
};

describe('m170 capability grant delivery', () => {
  it('creates the grant table', async () => {
    const db = makeTestDatabase();
    await migrate(db, migrations);
    const rows = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'capability_grants'",
    );
    expect(rows).toEqual([{ name: 'capability_grants' }]);
  });

  it('adds the decision reason and the verified revision to obligations', async () => {
    const db = makeTestDatabase();
    await migrate(db, before);
    await seed(db);
    await migrate(db, migrations);
    await db.execute(
      "UPDATE capability_obligations SET decision_reason = 'the gap is not established', satisfied_revision = 'rev-4' WHERE id = 'obl-1'",
    );
    const rows = await db.select<{
      readonly decision_reason: string | null;
      readonly satisfied_revision: string | null;
    }>('SELECT decision_reason, satisfied_revision FROM capability_obligations WHERE id = ?', [
      'obl-1',
    ]);
    expect(rows).toEqual([
      { decision_reason: 'the gap is not established', satisfied_revision: 'rev-4' },
    ]);
  });

  it('admits one grant per obligation so a reload cannot deliver twice', async () => {
    const db = makeTestDatabase();
    await migrate(db, before);
    await seed(db);
    await migrate(db, migrations);
    const insert = async (id: string): Promise<void> => {
      await db.execute(
        `INSERT INTO capability_grants
           (id, obligation_id, session_id, granted_role, purpose, continuation, parent_outcome, state, created_at, updated_at)
         VALUES (?, 'obl-1', 's1', 'implementer', 'repair', 'handoff', 'handed-off', 'pending', 1, 1)`,
        [id],
      );
    };
    await insert('grant-1');
    await expect(insert('grant-2')).rejects.toThrow();
  });
});
