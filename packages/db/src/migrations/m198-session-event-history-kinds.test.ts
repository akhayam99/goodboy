import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-09-26T12:00:00.000Z');

const seedThrough197 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 197 });
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-1', 'Harborline', 'harborline', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('session-1', 'workspace-1', 'Ledger', 'idle', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    'INSERT INTO session_events (id, session_id, kind, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
    ['ev-old', 'session-1', 'rebase_requested', '{"mountId":"mount-1"}', NOW],
  );
  return db;
};

const insertEvent = async ({
  db,
  id,
  kind,
}: {
  readonly db: Database;
  readonly id: string;
  readonly kind: string;
}): Promise<void> => {
  await db.execute(
    'INSERT INTO session_events (id, session_id, kind, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, 'session-1', kind, '{"planId":"plan-1"}', NOW],
  );
};

describe('m198 session event history kinds', () => {
  it('keeps the old events and accepts the four history outcomes', async () => {
    const db = await seedThrough197();

    await migrate(db, migrations);
    await insertEvent({ db, id: 'ev-1', kind: 'history_rewritten' });
    await insertEvent({ db, id: 'ev-2', kind: 'history_pushed' });
    await insertEvent({ db, id: 'ev-3', kind: 'history_stopped' });
    await insertEvent({ db, id: 'ev-4', kind: 'history_restored' });

    const rows = await db.select<{ kind: string }>(
      'SELECT kind FROM session_events ORDER BY id ASC',
    );
    expect(rows.map((row) => row.kind)).toEqual([
      'history_rewritten',
      'history_pushed',
      'history_stopped',
      'history_restored',
      'rebase_requested',
    ]);
  });

  it('refuses a history outcome before the rebuild', async () => {
    const db = await seedThrough197();

    await expect(insertEvent({ db, id: 'ev-early', kind: 'history_stopped' })).rejects.toThrow();
  });
});
