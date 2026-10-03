import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrateThrough } from '../test-helpers/migration-rows';

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 219 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('harborline', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    `INSERT INTO chats (id, workspace_id, title, provider, model, last_activity_at, created_at, updated_at)
     VALUES ('chat', 'harborline', 'Checkout 502 on Northwind', 'anthropic', 'sonnet', 1, 1, 1)`,
  );
  await db.execute(
    `INSERT INTO chat_messages (id, chat_id, role, content, status, created_at, updated_at)
     VALUES ('asked', 'chat', 'user', 'What changed?', 'done', 1, 1)`,
  );
  const result = await migrateThrough({ db, version: 220 });
  expect(result.applied).toEqual([220]);
  return db;
};

const attach = (id: string, position: number, mime = 'image/png') =>
  `INSERT INTO chat_message_attachments
     (id, chat_id, message_id, position, file_name, mime_type, byte_size, created_at)
   VALUES ('${id}', 'chat', 'asked', ${position}, 'checkout-502.png', '${mime}', 2048, 1)`;

describe('m220 chat message attachments', () => {
  it('keeps the messages written before the table existed', async () => {
    const db = await seed();
    const rows = await db.select<{ readonly id: string }>('SELECT id FROM chat_messages');
    expect(rows.map((row) => row.id)).toEqual(['asked']);
  });

  it('stores only images, one per position of a message', async () => {
    const db = await seed();
    await db.execute(attach('first', 0));
    await expect(db.execute(attach('pdf', 1, 'application/pdf'))).rejects.toThrow();
    await expect(db.execute(attach('twin', 0))).rejects.toThrow();
  });

  it('goes with its message and with its chat', async () => {
    const db = await seed();
    await db.execute(attach('first', 0));
    await db.execute("DELETE FROM chat_messages WHERE id = 'asked'");
    expect(await db.select('SELECT id FROM chat_message_attachments')).toEqual([]);
    await db.execute(
      `INSERT INTO chat_messages (id, chat_id, role, content, status, created_at, updated_at)
       VALUES ('asked', 'chat', 'user', 'Again', 'done', 2, 2)`,
    );
    await db.execute(attach('second', 0));
    await db.execute("DELETE FROM chats WHERE id = 'chat'");
    expect(await db.select('SELECT id FROM chat_message_attachments')).toEqual([]);
  });
});
