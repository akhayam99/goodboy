import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-09-25T12:00:00.000Z');

const seedThrough170 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 170 });
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-1', 'Workspace', 'workspace', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('session-1', 'workspace-1', 'Goal', 'idle', ?, ?)`,
    [NOW, NOW],
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
    [id, 'session-1', kind, '{"questionId":"question-1"}', NOW],
  );
};

describe('m171 session event workflow closed', () => {
  it('accepts a closed workflow next to the other workflow kinds', async () => {
    const db = await seedThrough170();

    await migrate(db, migrations);
    await insertEvent({ db, id: 'ev-1', kind: 'workflow_started' });
    await insertEvent({ db, id: 'ev-2', kind: 'workflow_closed' });
    await insertEvent({ db, id: 'ev-3', kind: 'workflow_discarded' });

    const rows = await db.select<{ kind: string }>(
      'SELECT kind FROM session_events ORDER BY id ASC',
    );
    expect(rows.map((row) => row.kind)).toEqual([
      'workflow_started',
      'workflow_closed',
      'workflow_discarded',
    ]);
  });

  it('refuses a closed workflow before the rebuild', async () => {
    const db = await seedThrough170();

    await expect(insertEvent({ db, id: 'ev-early', kind: 'workflow_closed' })).rejects.toThrow();
  });

  it('preserves rows written before the rebuild', async () => {
    const db = await seedThrough170();
    await insertEvent({ db, id: 'ev-old', kind: 'branch_created' });

    await migrate(db, migrations);

    const rows = await db.select<{ id: string; kind: string }>(
      'SELECT id, kind FROM session_events',
    );
    expect(rows).toEqual([{ id: 'ev-old', kind: 'branch_created' }]);
  });

  it('still refuses a kind nobody declared', async () => {
    const db = await seedThrough170();
    await migrate(db, migrations);

    await expect(insertEvent({ db, id: 'ev-bad', kind: 'session_unarchived' })).rejects.toThrow();
  });
});
