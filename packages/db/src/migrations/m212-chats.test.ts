import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 211 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('harborline', 'Harborline', 'harborline', 1, 1)",
  );
  const result = await migrate(db);
  expect(result.applied).toEqual([212]);
  await db.execute(
    `INSERT INTO chats (id, workspace_id, title, provider, model, last_activity_at, created_at, updated_at)
     VALUES ('chat', 'harborline', 'Ledger rounding on refunds', 'anthropic', 'sonnet', 1, 1, 1)`,
  );
  return db;
};

describe('m212 chats', () => {
  it('stores a chat with no status column, so nothing can mark it idle or archive it by itself', async () => {
    const db = await seed();
    const columns = await db.select<{ readonly name: string }>("PRAGMA table_info('chats')");
    expect(columns.map((column) => column.name)).not.toContain('status');
    const [row] = await db.select<{ readonly archived_at: number | null }>(
      'SELECT archived_at FROM chats',
    );
    expect(row?.archived_at).toBeNull();
  });

  it('keeps only the providers that can run a read-only chat', async () => {
    const db = await seed();
    await expect(
      db.execute(
        `INSERT INTO chats (id, workspace_id, title, provider, model, last_activity_at, created_at, updated_at)
         VALUES ('cursor-chat', 'harborline', 'Flaky test', 'cursor', 'auto', 1, 1, 1)`,
      ),
    ).rejects.toThrow();
    await db.execute(
      `INSERT INTO chats (id, workspace_id, title, provider, model, last_activity_at, created_at, updated_at)
       VALUES ('codex-chat', 'harborline', 'Flaky test', 'codex', 'gpt-5.6-sol', 1, 1, 1)`,
    );
  });

  it('refuses a message role or status outside the enum', async () => {
    const db = await seed();
    await expect(
      db.execute(
        `INSERT INTO chat_messages (id, chat_id, role, content, status, created_at, updated_at)
         VALUES ('m1', 'chat', 'system', 'hi', 'done', 1, 1)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.execute(
        `INSERT INTO chat_messages (id, chat_id, role, content, status, created_at, updated_at)
         VALUES ('m2', 'chat', 'user', 'hi', 'idle', 1, 1)`,
      ),
    ).rejects.toThrow();
  });
});
