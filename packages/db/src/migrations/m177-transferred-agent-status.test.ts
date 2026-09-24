import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 177);

const seed = async (db: ReturnType<typeof makeTestDatabase>): Promise<void> => {
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('w1', 'Northwind', 'northwind', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('s1', 'w1', 'goal', 'idle', 1, 1)",
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status)
     VALUES ('a1', 's1', 0, 'apply the change', 'failed'),
            ('a2', 's1', 1, 'run the suite', 'failed'),
            ('a3', 's1', 2, 'review the change', 'failed')`,
  );
  const obligation = async (id: string, requester: string): Promise<void> => {
    await db.execute(
      `INSERT INTO capability_obligations
         (id, session_id, identity, requester_agent_id, target_role, purpose, state, created_at, updated_at)
       VALUES (?, 's1', ?, ?, 'investigator', 'diagnosis', 'granted', 1, 1)`,
      [id, `${requester}:investigator:diagnosis`, requester],
    );
  };
  const grant = async (id: string, obligationId: string, outcome: string): Promise<void> => {
    await db.execute(
      `INSERT INTO capability_grants
         (id, obligation_id, session_id, granted_role, purpose, continuation, parent_outcome, state, created_at, updated_at)
       VALUES (?, ?, 's1', 'investigator', 'diagnosis', 'transfer', ?, 'delivered', 1, 1)`,
      [id, obligationId, outcome],
    );
  };
  await obligation('obl-1', 'a1');
  await grant('grant-1', 'obl-1', 'transferred');
  await obligation('obl-2', 'a3');
  await grant('grant-2', 'obl-2', 'handed-off');
};

const statusOf = async (
  db: ReturnType<typeof makeTestDatabase>,
  id: string,
): Promise<string | undefined> => {
  const rows = await db.select<{ readonly status: string }>(
    'SELECT status FROM agents WHERE id = ?',
    [id],
  );
  return rows[0]?.status;
};

describe('m177 transferred agent status', () => {
  it('migrates the failed rows a transfer grant proves were transfers', async () => {
    const db = makeTestDatabase();
    await migrate(db, before);
    await seed(db);

    await migrate(db, migrations);

    expect(await statusOf(db, 'a1')).toBe('transferred');
  });

  it('leaves a genuine failure and a handed-off parent alone', async () => {
    const db = makeTestDatabase();
    await migrate(db, before);
    await seed(db);

    await migrate(db, migrations);

    expect(await statusOf(db, 'a2')).toBe('failed');
    expect(await statusOf(db, 'a3')).toBe('failed');
  });
});
