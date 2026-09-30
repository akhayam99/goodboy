import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';

const seedBefore = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 213 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('harborline', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    `INSERT INTO chats (id, workspace_id, title, provider, model, last_activity_at, created_at, updated_at)
     VALUES ('chat', 'harborline', 'Ledger rounding on refunds', 'codex', 'gpt-5.6-sol', 1, 1, 1)`,
  );
  await db.execute(
    `INSERT INTO chat_messages (id, chat_id, role, content, status, created_at, updated_at)
     VALUES ('ask', 'chat', 'user', 'How are refunds rounded?', 'done', 1, 1),
            ('answer', 'chat', 'assistant', 'Half up.', 'done', 2, 2)`,
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'harborline', 'Fix rounding', 'idle', 1, 1)",
  );
  return db;
};

const seed = async () => {
  const db = await seedBefore();
  const result = await migrate(db);
  expect(result.applied).toEqual([214]);
  return db;
};

describe('m214 chat models and links', () => {
  it('adds a nullable effort to chats', async () => {
    const db = await seed();
    const [row] = await db.select<{ readonly effort: string | null }>('SELECT effort FROM chats');
    expect(row?.effort).toBeNull();
  });

  it('backfills assistant messages with the chat model and leaves user messages empty', async () => {
    const db = await seed();
    const rows = await db.select<{
      readonly id: string;
      readonly provider: string | null;
      readonly model: string | null;
      readonly effort: string | null;
    }>('SELECT id, provider, model, effort FROM chat_messages ORDER BY created_at');
    expect(rows).toEqual([
      { id: 'ask', provider: null, model: null, effort: null },
      { id: 'answer', provider: 'codex', model: 'gpt-5.6-sol', effort: null },
    ]);
  });

  it('stores a link per chat and session and refuses a kind outside the enum', async () => {
    const db = await seed();
    await db.execute(
      `INSERT INTO chat_session_links (id, chat_id, session_id, message_id, kind, created_at)
       VALUES ('link', 'chat', 'session', 'answer', 'new', 3)`,
    );
    await expect(
      db.execute(
        `INSERT INTO chat_session_links (id, chat_id, session_id, message_id, kind, created_at)
         VALUES ('bad', 'chat', 'session', NULL, 'move', 3)`,
      ),
    ).rejects.toThrow();
  });

  it('drops the links with the chat and with the session, never the other side', async () => {
    const db = await seed();
    await db.execute(
      `INSERT INTO chat_session_links (id, chat_id, session_id, message_id, kind, created_at)
       VALUES ('link', 'chat', 'session', NULL, 'add', 3)`,
    );
    await db.execute("DELETE FROM chats WHERE id = 'chat'");
    const links = await db.select('SELECT id FROM chat_session_links');
    const sessions = await db.select('SELECT id FROM sessions');
    expect(links).toEqual([]);
    expect(sessions).toHaveLength(1);
  });
});
