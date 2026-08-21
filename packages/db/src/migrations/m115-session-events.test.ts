import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';

const seedThrough114 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 114),
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
    [id, sessionId, kind, '{"branch":"ak/feature"}', Date.now()],
  );
};

type DbParams = {
  readonly db: Database;
};

const countEvents = async ({ db }: DbParams): Promise<number> => {
  const rows = await db.select<{ total: number }>('SELECT COUNT(*) AS total FROM session_events');
  return rows[0]?.total ?? 0;
};

describe('m115 session events', () => {
  it('accepts every shipped kind', async () => {
    const db = await seedThrough114();
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

    expect(await countEvents({ db })).toBe(kinds.length);
  });

  it('rejects an unknown kind', async () => {
    const db = await seedThrough114();
    await migrate(db, migrations);

    await expect(insertEvent({ db, id: 'ev-bad', kind: 'session_renamed' })).rejects.toThrow(
      /CHECK constraint/,
    );
  });

  it('wipes its rows with the session', async () => {
    const db = await seedThrough114();
    await migrate(db, migrations);
    await insertEvent({ db, id: 'ev-1', kind: 'branch_created' });

    await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);

    expect(await countEvents({ db })).toBe(0);
    expect(await db.select<{ rowid: number }>('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('indexes lookups by session', async () => {
    const db = await seedThrough114();
    await migrate(db, migrations);

    const indexes = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'session_events' AND sql IS NOT NULL ORDER BY name",
    );
    expect(indexes.map((index) => index.name)).toEqual(['idx_session_events_session_id']);
  });
});
