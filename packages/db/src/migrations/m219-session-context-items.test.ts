import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const NOW = Date.parse('2026-10-03T09:00:00Z');

const seedBefore = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 216 });
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ['harborline', 'Harborline', 'harborline', NOW, NOW],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('s-1', 'harborline', 'Retry failed webhook deliveries', 'idle', ?, ?)`,
    [NOW, NOW],
  );
  return db;
};

const insertItem = ({ db, id }: { readonly db: Database; readonly id: string }) =>
  db.execute(
    `INSERT INTO session_context_items
       (id, session_id, workspace_id, kind, title, text, topic, created_at, updated_at)
     VALUES (?, 's-1', 'harborline', 'learning', 'Why select! drops a request', 'It cancels the losing branch.', 'Rust', ?, ?)`,
    [id, NOW, NOW],
  );

describe('m219 session context items', () => {
  it('adds the table next to existing session data and defaults new rows to active', async () => {
    const db = await seedBefore();

    await migrate(db, migrations);

    const sessions = await db.select<{ readonly goal: string }>(
      "SELECT goal FROM sessions WHERE id = 's-1'",
    );
    expect(sessions.map((session) => session.goal)).toEqual(['Retry failed webhook deliveries']);
    await insertItem({ db, id: 'item-1' });
    const rows = await db.select<{
      readonly status: string;
      readonly audience_json: string;
      readonly source_json: string | null;
    }>('SELECT status, audience_json, source_json FROM session_context_items');
    expect(rows).toEqual([{ status: 'active', audience_json: '[]', source_json: null }]);
  });

  it('keeps an item when its session row is removed and drops it with the workspace', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);
    await insertItem({ db, id: 'item-1' });

    await db.execute("DELETE FROM sessions WHERE id = 's-1'");
    const kept = await db.select<{ readonly session_id: string | null }>(
      'SELECT session_id FROM session_context_items',
    );
    expect(kept).toEqual([{ session_id: null }]);

    await db.execute("DELETE FROM workspaces WHERE id = 'harborline'");
    const gone = await db.select('SELECT id FROM session_context_items');
    expect(gone).toEqual([]);
  });

  it('rejects a status outside active and dismissed', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await expect(
      db.execute(
        `INSERT INTO session_context_items
           (id, session_id, workspace_id, kind, title, text, status, created_at, updated_at)
         VALUES ('item-x', 's-1', 'harborline', 'learning', 't', 'x', 'hidden', ?, ?)`,
        [NOW, NOW],
      ),
    ).rejects.toThrow();
  });
});
