import { describe, expect, it } from 'vitest';
import type {
  Chat,
  ChatId,
  ChatMessage,
  ChatMessageId,
  IsoDateTime,
  WorkspaceId,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  finishChatMessage,
  insertChat,
  insertChatMessage,
  listChatMessages,
  listChats,
  renameChat,
  setChatModel,
  setChatPinned,
  setChatsArchived,
  settleStreamingChatMessages,
} from './chat';

const WORKSPACE = 'harborline' as WorkspaceId;
const CONSENT = 'chat-consent' as ChatId;
const RETRY = 'chat-retry' as ChatId;
const MONDAY = '2026-09-21T09:00:00.000Z' as IsoDateTime;
const TUESDAY = '2026-09-22T09:00:00.000Z' as IsoDateTime;
const WEDNESDAY = '2026-09-23T09:00:00.000Z' as IsoDateTime;

const chat = (patch: Partial<Chat>): Chat => ({
  id: CONSENT,
  workspaceId: WORKSPACE,
  title: 'Where is the consent step defined?',
  provider: 'anthropic',
  model: 'sonnet',
  pinnedAt: null,
  archivedAt: null,
  lastActivityAt: MONDAY,
  createdAt: MONDAY,
  updatedAt: MONDAY,
  ...patch,
});

const message = (patch: Partial<ChatMessage>): ChatMessage => ({
  id: 'message-1' as ChatMessageId,
  chatId: CONSENT,
  role: 'user',
  content: 'Where is the consent step defined?',
  status: 'done',
  reads: [],
  error: null,
  createdAt: MONDAY,
  updatedAt: MONDAY,
  ...patch,
});

const seed = async () => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('harborline', 'Harborline', 'harborline', 1, 1)`,
  );
  return db;
};

describe('chats', () => {
  it('lists the workspace chats by last activity and leaves archived ones out', async () => {
    const db = await seed();
    await insertChat({ db, chat: chat({}) });
    await insertChat({
      db,
      chat: chat({
        id: RETRY,
        title: 'Why does notify-relay retry twice?',
        lastActivityAt: TUESDAY,
      }),
    });

    expect((await listChats({ db, workspaceId: WORKSPACE })).map((entry) => entry.id)).toEqual([
      RETRY,
      CONSENT,
    ]);

    await setChatsArchived({ db, chatIds: [RETRY], archivedAt: WEDNESDAY, now: WEDNESDAY });
    const active = await listChats({ db, workspaceId: WORKSPACE });
    expect(active.map((entry) => entry.id)).toEqual([CONSENT]);
    const all = await listChats({ db, workspaceId: WORKSPACE, includeArchived: true });
    expect(all.find((entry) => entry.id === RETRY)?.archivedAt).toBe(WEDNESDAY);

    await setChatsArchived({ db, chatIds: [RETRY], archivedAt: null, now: WEDNESDAY });
    expect(await listChats({ db, workspaceId: WORKSPACE })).toHaveLength(2);
  });

  it('bumps last activity on every message and previews the latest answer', async () => {
    const db = await seed();
    await insertChat({ db, chat: chat({}) });
    await insertChatMessage({ db, message: message({ createdAt: TUESDAY, updatedAt: TUESDAY }) });
    await insertChatMessage({
      db,
      message: message({
        id: 'message-2' as ChatMessageId,
        role: 'assistant',
        content: '',
        status: 'streaming',
        createdAt: TUESDAY,
        updatedAt: TUESDAY,
      }),
    });

    const [streaming] = await listChats({ db, workspaceId: WORKSPACE });
    expect(streaming?.lastActivityAt).toBe(TUESDAY);
    expect(streaming?.preview).toBeNull();

    await finishChatMessage({
      db,
      message: message({
        id: 'message-2' as ChatMessageId,
        role: 'assistant',
        content: 'It lives in payments-api, in steps.ts at line 88.',
        status: 'done',
        reads: ['payments-api/src/questionnaire/steps.ts'],
        createdAt: TUESDAY,
        updatedAt: WEDNESDAY,
      }),
    });

    const [answered] = await listChats({ db, workspaceId: WORKSPACE });
    expect(answered?.lastActivityAt).toBe(WEDNESDAY);
    expect(answered?.preview).toBe('It lives in payments-api, in steps.ts at line 88.');

    const messages = await listChatMessages({ db, chatId: CONSENT });
    expect(messages.map((entry) => entry.role)).toEqual(['user', 'assistant']);
    expect(messages[1]?.reads).toEqual(['payments-api/src/questionnaire/steps.ts']);
    expect(messages[0]?.reads).toEqual([]);
  });

  it('renames, repins and switches the model of a chat', async () => {
    const db = await seed();
    await insertChat({ db, chat: chat({}) });

    await renameChat({ db, chatId: CONSENT, title: 'Consent step', now: TUESDAY });
    await setChatPinned({ db, chatId: CONSENT, pinnedAt: TUESDAY, now: TUESDAY });
    await setChatModel({ db, chatId: CONSENT, provider: 'codex', model: 'gpt-6', now: TUESDAY });

    const [updated] = await listChats({ db, workspaceId: WORKSPACE });
    expect(updated).toMatchObject({
      title: 'Consent step',
      pinnedAt: TUESDAY,
      provider: 'codex',
      model: 'gpt-6',
      lastActivityAt: MONDAY,
    });
  });

  it('marks answers left streaming by a closed window as stopped', async () => {
    const db = await seed();
    await insertChat({ db, chat: chat({}) });
    await insertChatMessage({
      db,
      message: message({ role: 'assistant', content: 'Half an answer', status: 'streaming' }),
    });

    expect(await settleStreamingChatMessages({ db, now: TUESDAY })).toBe(1);
    const [settled] = await listChatMessages({ db, chatId: CONSENT });
    expect(settled?.status).toBe('stopped');
    expect(settled?.content).toBe('Half an answer');
  });

  it('drops the chat and its messages with the workspace', async () => {
    const db = await seed();
    await insertChat({ db, chat: chat({}) });
    await insertChatMessage({ db, message: message({}) });

    await db.execute("DELETE FROM workspaces WHERE id = 'harborline'");

    expect(await listChats({ db, workspaceId: WORKSPACE, includeArchived: true })).toEqual([]);
    expect(await listChatMessages({ db, chatId: CONSENT })).toEqual([]);
  });
});
