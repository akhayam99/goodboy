import { describe, expect, it } from 'vitest';
import type {
  AskThread,
  Chat,
  ChatId,
  ChatMessageId,
  IsoDateTime,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertAskThread, listAskThreads } from './ask-thread';
import { insertChat, insertChatMessage, listChatMessages, listChats } from './chat';

const WORKSPACE = 'harborline' as WorkspaceId;
const SESSION = 'session-webhooks' as SessionId;
const MONDAY = '2026-09-21T09:00:00.000Z' as IsoDateTime;
const TUESDAY = '2026-09-22T09:00:00.000Z' as IsoDateTime;

const thread = (patch: Partial<AskThread>): AskThread => ({
  id: 'ask-1' as ChatId,
  workspaceId: WORKSPACE,
  sessionId: SESSION,
  title: 'What needs me?',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: 'low',
  lastActivityAt: MONDAY,
  createdAt: MONDAY,
  messageCount: 0,
  ...patch,
});

const workspaceChat: Chat = {
  id: 'chat-consent' as ChatId,
  workspaceId: WORKSPACE,
  title: 'Where is the consent step defined?',
  provider: 'anthropic',
  model: 'sonnet',
  effort: null,
  pinnedAt: null,
  archivedAt: null,
  lastActivityAt: MONDAY,
  createdAt: MONDAY,
  updatedAt: MONDAY,
};

const seed = async () => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('harborline', 'Harborline', 'harborline', 1, 1)`,
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('session-webhooks', 'harborline', 'Fix webhook retries', 'idle', 1, 1)`,
  );
  return db;
};

describe('ask threads', () => {
  it('lists the threads of one session newest first with their question count', async () => {
    const db = await seed();
    await insertAskThread({ db, thread: thread({}) });
    await insertAskThread({
      db,
      thread: thread({
        id: 'ask-2' as ChatId,
        title: 'Why did the tester fail?',
        createdAt: TUESDAY,
      }),
    });
    await insertChatMessage({
      db,
      message: {
        id: 'm-1' as ChatMessageId,
        chatId: 'ask-1' as ChatId,
        role: 'user',
        content: 'What needs me?',
        status: 'done',
        reads: [],
        error: null,
        provider: null,
        model: null,
        effort: null,
        attachments: [],
        createdAt: MONDAY,
        updatedAt: MONDAY,
      },
    });
    const threads = await listAskThreads({ db, sessionId: SESSION });
    expect(threads.map((entry) => [entry.id, entry.messageCount, entry.effort])).toEqual([
      ['ask-2', 0, 'low'],
      ['ask-1', 1, 'low'],
    ]);
    expect(await listChatMessages({ db, chatId: 'ask-1' as ChatId })).toHaveLength(1);
  });

  it('reopens the thread with the latest activity first, not the newest created', async () => {
    const db = await seed();
    await insertAskThread({
      db,
      thread: thread({ lastActivityAt: '2026-09-23T09:00:00.000Z' as IsoDateTime }),
    });
    await insertAskThread({
      db,
      thread: thread({
        id: 'ask-2' as ChatId,
        title: 'Why did the tester fail?',
        createdAt: TUESDAY,
      }),
    });
    const threads = await listAskThreads({ db, sessionId: SESSION });
    expect(threads.map((entry) => entry.id)).toEqual(['ask-1', 'ask-2']);
  });

  it('keeps session threads out of the Chat list', async () => {
    const db = await seed();
    await insertChat({ db, chat: workspaceChat });
    await insertAskThread({ db, thread: thread({}) });
    const chats = await listChats({ db, workspaceId: WORKSPACE, includeArchived: true });
    expect(chats.map((entry) => entry.id)).toEqual(['chat-consent']);
  });
});
