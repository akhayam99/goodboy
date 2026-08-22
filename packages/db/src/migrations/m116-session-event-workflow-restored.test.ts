import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';

const seedThrough115 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 115),
  );
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  return db;
};

type EventParams = {
  readonly db: Database;
  readonly id: string;
  readonly kind: string;
};

const insertEvent = async ({ db, id, kind }: EventParams): Promise<void> => {
  await db.execute(
    'INSERT INTO session_events (id, session_id, kind, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, sessionId, kind, '{"runId":"run-1"}', 1_700_000_000_000],
  );
};

describe('m116 session event workflow restored', () => {
  it('accepts the restored kind', async () => {
    const db = await seedThrough115();

    await migrate(db, migrations);
    await insertEvent({ db, id: 'ev-restored', kind: 'workflow_restored' });

    const rows = await db.select<{ kind: string }>('SELECT kind FROM session_events');
    expect(rows).toEqual([{ kind: 'workflow_restored' }]);
  });

  it('still accepts every kind shipped before the rebuild', async () => {
    const db = await seedThrough115();

    await migrate(db, migrations);

    const kinds = [
      'worktree_created',
      'branch_created',
      'branch_switched',
      'issue_linked',
      'issue_unlinked',
      'pr_created',
      'pr_ready',
      'pr_approved',
      'pr_merged',
      'pr_closed',
      'workflow_started',
      'workflow_discarded',
      'workflow_deleted',
      'decisions_changed',
    ];
    for (const [index, kind] of kinds.entries()) {
      await insertEvent({ db, id: `ev-${index}`, kind });
    }

    const rows = await db.select<{ total: number }>('SELECT COUNT(*) AS total FROM session_events');
    expect(rows[0]?.total).toBe(kinds.length);
  });

  it('still rejects a kind outside the widened check', async () => {
    const db = await seedThrough115();

    await migrate(db, migrations);

    await expect(insertEvent({ db, id: 'ev-bad', kind: 'session_renamed' })).rejects.toThrow(
      /CHECK constraint/,
    );
  });

  it('carries the rows written before the rebuild', async () => {
    const db = await seedThrough115();
    await insertEvent({ db, id: 'ev-old', kind: 'workflow_discarded' });

    await migrate(db, migrations);

    const rows = await db.select<{
      id: string;
      session_id: string;
      kind: string;
      payload_json: string | null;
      created_at: number;
    }>('SELECT id, session_id, kind, payload_json, created_at FROM session_events');
    expect(rows).toEqual([
      {
        id: 'ev-old',
        session_id: sessionId,
        kind: 'workflow_discarded',
        payload_json: '{"runId":"run-1"}',
        created_at: 1_700_000_000_000,
      },
    ]);
  });

  it('keeps the session index after the swap', async () => {
    const db = await seedThrough115();

    await migrate(db, migrations);

    const indexes = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'session_events' AND sql IS NOT NULL ORDER BY name",
    );
    expect(indexes.map((index) => index.name)).toEqual(['idx_session_events_session_id']);
  });

  it('keeps wiping its rows with the session', async () => {
    const db = await seedThrough115();
    await migrate(db, migrations);
    await insertEvent({ db, id: 'ev-1', kind: 'workflow_restored' });

    await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);

    const rows = await db.select<{ total: number }>('SELECT COUNT(*) AS total FROM session_events');
    expect(rows[0]?.total).toBe(0);
    expect(await db.select<{ rowid: number }>('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('applies nothing and loses nothing on a second run', async () => {
    const db = await seedThrough115();
    await migrate(db, migrations);
    await insertEvent({ db, id: 'ev-keep', kind: 'workflow_restored' });

    const result = await migrate(db, migrations);

    expect(result.applied).toEqual([]);
    const rows = await db.select<{ id: string }>('SELECT id FROM session_events');
    expect(rows).toEqual([{ id: 'ev-keep' }]);
  });
});
