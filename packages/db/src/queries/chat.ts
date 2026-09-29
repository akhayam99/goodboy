import {
  CHAT_MESSAGE_ROLES,
  CHAT_MESSAGE_STATUSES,
  CHAT_SESSION_LINK_KINDS,
  PROVIDER_IDS,
  type Chat,
  type ChatId,
  type ChatMessage,
  type ChatMessageId,
  type ChatMessageRole,
  type ChatMessageStatus,
  type ChatModelUsed,
  type ChatSessionLink,
  type ChatSessionLinkId,
  type ChatSessionLinkKind,
  type ChatSummary,
  type EffortLevel,
  type IsoDateTime,
  type ProviderId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { isStringArray, parseJsonColumn } from '../shared/parseJsonColumn';

const PREVIEW_LENGTH = 240;

const EFFORT_LEVELS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const satisfies ReadonlyArray<EffortLevel>;

type ChatRow = {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly provider: string;
  readonly model: string;
  readonly effort: string | null;
  readonly pinnedAt: number | null;
  readonly archivedAt: number | null;
  readonly lastActivityAt: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly preview: string | null;
};

type MessageRow = {
  readonly id: string;
  readonly chatId: string;
  readonly role: string;
  readonly content: string;
  readonly status: string;
  readonly reads: string | null;
  readonly error: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
};

type ModelUsedRow = {
  readonly chatId: string;
  readonly provider: string;
  readonly model: string;
};

type LinkRow = {
  readonly id: string;
  readonly chatId: string;
  readonly sessionId: string;
  readonly messageId: string | null;
  readonly kind: string;
  readonly createdAt: number;
};

const CHAT_COLUMNS = `c.id, c.workspace_id AS workspaceId, c.title, c.provider, c.model, c.effort,
  c.pinned_at AS pinnedAt, c.archived_at AS archivedAt, c.last_activity_at AS lastActivityAt,
  c.created_at AS createdAt, c.updated_at AS updatedAt,
  (SELECT SUBSTR(m.content, 1, ${PREVIEW_LENGTH}) FROM chat_messages m
    WHERE m.chat_id = c.id AND m.role = 'assistant' AND m.content != ''
    ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS preview`;

const MESSAGE_COLUMNS = `id, chat_id AS chatId, role, content, status, reads, error, provider, model, effort,
  created_at AS createdAt, updated_at AS updatedAt`;

const toIso = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

const toMs = (iso: IsoDateTime): number => Date.parse(iso);

const isProviderId = (value: string): value is ProviderId =>
  PROVIDER_IDS.some((provider) => provider === value);

const isRole = (value: string): value is ChatMessageRole =>
  CHAT_MESSAGE_ROLES.some((role) => role === value);

const isStatus = (value: string): value is ChatMessageStatus =>
  CHAT_MESSAGE_STATUSES.some((status) => status === value);

const isEffort = (value: string): value is EffortLevel =>
  EFFORT_LEVELS.some((effort) => effort === value);

const toEffort = (value: string | null): EffortLevel | null =>
  value !== null && isEffort(value) ? value : null;

const isLinkKind = (value: string): value is ChatSessionLinkKind =>
  CHAT_SESSION_LINK_KINDS.some((kind) => kind === value);

type ToSummaryParams = {
  readonly row: ChatRow;
  readonly modelsUsed: ReadonlyArray<ChatModelUsed>;
};

const toSummary = ({ row, modelsUsed }: ToSummaryParams): ChatSummary | null => {
  if (!isProviderId(row.provider)) {
    return null;
  }
  return {
    id: row.id as ChatId,
    workspaceId: row.workspaceId as WorkspaceId,
    title: row.title,
    provider: row.provider,
    model: row.model,
    effort: toEffort(row.effort),
    pinnedAt: row.pinnedAt === null ? null : toIso(row.pinnedAt),
    archivedAt: row.archivedAt === null ? null : toIso(row.archivedAt),
    lastActivityAt: toIso(row.lastActivityAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    preview: row.preview,
    modelsUsed,
  };
};

const toMessage = (row: MessageRow): ChatMessage | null => {
  if (!isRole(row.role) || !isStatus(row.status)) {
    return null;
  }
  return {
    id: row.id as ChatMessageId,
    chatId: row.chatId as ChatId,
    role: row.role,
    content: row.content,
    status: row.status,
    reads: parseJsonColumn({ value: row.reads, isValid: isStringArray, fallback: [] }),
    error: row.error,
    provider: row.provider !== null && isProviderId(row.provider) ? row.provider : null,
    model: row.model,
    effort: toEffort(row.effort),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
};

type ListChatsParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly includeArchived?: boolean;
};

export const listChats = async ({
  db,
  workspaceId,
  includeArchived = false,
}: ListChatsParams): Promise<ReadonlyArray<ChatSummary>> => {
  const archivedFilter = includeArchived ? '' : 'AND c.archived_at IS NULL';
  const rows = await db.select<ChatRow>(
    `SELECT ${CHAT_COLUMNS} FROM chats c WHERE c.workspace_id = ? ${archivedFilter}
     ORDER BY c.last_activity_at DESC, c.id`,
    [workspaceId],
  );
  const used = await db.select<ModelUsedRow>(
    `SELECT m.chat_id AS chatId, m.provider, m.model
     FROM chat_messages m JOIN chats c ON c.id = m.chat_id
     WHERE c.workspace_id = ? AND m.role = 'assistant' AND m.provider IS NOT NULL
       AND m.model IS NOT NULL
     GROUP BY m.chat_id, m.provider, m.model
     ORDER BY MIN(m.created_at), MIN(m.rowid)`,
    [workspaceId],
  );
  const modelsByChat = new Map<string, ReadonlyArray<ChatModelUsed>>();
  for (const entry of used) {
    if (!isProviderId(entry.provider)) {
      continue;
    }
    modelsByChat.set(entry.chatId, [
      ...(modelsByChat.get(entry.chatId) ?? []),
      { provider: entry.provider, model: entry.model },
    ]);
  }
  return rows.flatMap((row) => {
    const summary = toSummary({ row, modelsUsed: modelsByChat.get(row.id) ?? [] });
    return summary === null ? [] : [summary];
  });
};

type ChatParams = {
  readonly db: Database;
  readonly chatId: ChatId;
};

type InsertChatParams = {
  readonly db: Database;
  readonly chat: Chat;
};

export const insertChat = async ({ db, chat }: InsertChatParams): Promise<void> => {
  await db.execute(
    `INSERT INTO chats (id, workspace_id, title, provider, model, effort, pinned_at, archived_at,
       last_activity_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chat.id,
      chat.workspaceId,
      chat.title,
      chat.provider,
      chat.model,
      chat.effort,
      chat.pinnedAt === null ? null : toMs(chat.pinnedAt),
      chat.archivedAt === null ? null : toMs(chat.archivedAt),
      toMs(chat.lastActivityAt),
      toMs(chat.createdAt),
      toMs(chat.updatedAt),
    ],
  );
};

type RenameChatParams = ChatParams & {
  readonly title: string;
  readonly now: IsoDateTime;
};

export const renameChat = async ({ db, chatId, title, now }: RenameChatParams): Promise<void> => {
  await db.execute('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?', [
    title,
    toMs(now),
    chatId,
  ]);
};

type SetChatModelParams = ChatParams & {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly now: IsoDateTime;
};

export const setChatModel = async ({
  db,
  chatId,
  provider,
  model,
  effort,
  now,
}: SetChatModelParams): Promise<void> => {
  await db.execute(
    'UPDATE chats SET provider = ?, model = ?, effort = ?, updated_at = ? WHERE id = ?',
    [provider, model, effort, toMs(now), chatId],
  );
};

type SetChatPinnedParams = ChatParams & {
  readonly pinnedAt: IsoDateTime | null;
  readonly now: IsoDateTime;
};

export const setChatPinned = async ({
  db,
  chatId,
  pinnedAt,
  now,
}: SetChatPinnedParams): Promise<void> => {
  await db.execute('UPDATE chats SET pinned_at = ?, updated_at = ? WHERE id = ?', [
    pinnedAt === null ? null : toMs(pinnedAt),
    toMs(now),
    chatId,
  ]);
};

type SetChatsArchivedParams = {
  readonly db: Database;
  readonly chatIds: ReadonlyArray<ChatId>;
  readonly archivedAt: IsoDateTime | null;
  readonly now: IsoDateTime;
};

export const setChatsArchived = async ({
  db,
  chatIds,
  archivedAt,
  now,
}: SetChatsArchivedParams): Promise<void> => {
  if (chatIds.length === 0) {
    return;
  }
  await db.transaction({
    statements: chatIds.map((chatId) => ({
      sql: 'UPDATE chats SET archived_at = ?, updated_at = ? WHERE id = ?',
      params: [archivedAt === null ? null : toMs(archivedAt), toMs(now), chatId],
    })),
  });
};

type DeleteChatsParams = {
  readonly db: Database;
  readonly chatIds: ReadonlyArray<ChatId>;
};

export const deleteChats = async ({ db, chatIds }: DeleteChatsParams): Promise<void> => {
  if (chatIds.length === 0) {
    return;
  }
  await db.transaction({
    statements: chatIds.map((chatId) => ({
      sql: 'DELETE FROM chats WHERE id = ?',
      params: [chatId],
    })),
  });
};

export const listChatMessages = async ({
  db,
  chatId,
}: ChatParams): Promise<ReadonlyArray<ChatMessage>> => {
  const rows = await db.select<MessageRow>(
    `SELECT ${MESSAGE_COLUMNS} FROM chat_messages WHERE chat_id = ?
     ORDER BY created_at ASC, rowid ASC`,
    [chatId],
  );
  return rows.flatMap((row) => {
    const message = toMessage(row);
    return message === null ? [] : [message];
  });
};

const readsColumn = (reads: ReadonlyArray<string>): string | null =>
  reads.length === 0 ? null : JSON.stringify(reads);

type InsertChatMessageParams = {
  readonly db: Database;
  readonly message: ChatMessage;
};

export const insertChatMessage = async ({
  db,
  message,
}: InsertChatMessageParams): Promise<void> => {
  await db.transaction({
    statements: [
      {
        sql: `INSERT INTO chat_messages (id, chat_id, role, content, status, reads, error,
                provider, model, effort, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          message.id,
          message.chatId,
          message.role,
          message.content,
          message.status,
          readsColumn(message.reads),
          message.error,
          message.provider,
          message.model,
          message.effort,
          toMs(message.createdAt),
          toMs(message.updatedAt),
        ],
      },
      {
        sql: `UPDATE chats SET last_activity_at = MAX(last_activity_at, ?), updated_at = ?
              WHERE id = ?`,
        params: [toMs(message.createdAt), toMs(message.updatedAt), message.chatId],
      },
    ],
  });
};

type FinishChatMessageParams = {
  readonly db: Database;
  readonly message: ChatMessage;
};

export const finishChatMessage = async ({
  db,
  message,
}: FinishChatMessageParams): Promise<void> => {
  await db.transaction({
    statements: [
      {
        sql: `UPDATE chat_messages SET content = ?, status = ?, reads = ?, error = ?, provider = ?,
                model = ?, effort = ?, updated_at = ?
              WHERE id = ?`,
        params: [
          message.content,
          message.status,
          readsColumn(message.reads),
          message.error,
          message.provider,
          message.model,
          message.effort,
          toMs(message.updatedAt),
          message.id,
        ],
      },
      {
        sql: `UPDATE chats SET last_activity_at = MAX(last_activity_at, ?), updated_at = ?
              WHERE id = ?`,
        params: [toMs(message.updatedAt), toMs(message.updatedAt), message.chatId],
      },
    ],
  });
};

type SettleStreamingParams = {
  readonly db: Database;
  readonly now: IsoDateTime;
};

export const settleStreamingChatMessages = async ({
  db,
  now,
}: SettleStreamingParams): Promise<number> => {
  const result = await db.execute(
    "UPDATE chat_messages SET status = 'stopped', updated_at = ? WHERE status = 'streaming'",
    [toMs(now)],
  );
  return result.rowsAffected;
};

const toLink = (row: LinkRow): ChatSessionLink | null => {
  if (!isLinkKind(row.kind)) {
    return null;
  }
  return {
    id: row.id as ChatSessionLinkId,
    chatId: row.chatId as ChatId,
    sessionId: row.sessionId as SessionId,
    messageId: row.messageId === null ? null : (row.messageId as ChatMessageId),
    kind: row.kind,
    createdAt: toIso(row.createdAt),
  };
};

type InsertChatSessionLinkParams = {
  readonly db: Database;
  readonly link: ChatSessionLink;
};

export const insertChatSessionLink = async ({
  db,
  link,
}: InsertChatSessionLinkParams): Promise<void> => {
  await db.execute(
    `INSERT INTO chat_session_links (id, chat_id, session_id, message_id, kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [link.id, link.chatId, link.sessionId, link.messageId, link.kind, toMs(link.createdAt)],
  );
};

type ListChatSessionLinksParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const listChatSessionLinks = async ({
  db,
  workspaceId,
}: ListChatSessionLinksParams): Promise<ReadonlyArray<ChatSessionLink>> => {
  const rows = await db.select<LinkRow>(
    `SELECT l.id, l.chat_id AS chatId, l.session_id AS sessionId, l.message_id AS messageId,
       l.kind, l.created_at AS createdAt
     FROM chat_session_links l JOIN chats c ON c.id = l.chat_id
     WHERE c.workspace_id = ?
     ORDER BY l.created_at ASC, l.rowid ASC`,
    [workspaceId],
  );
  return rows.flatMap((row) => {
    const link = toLink(row);
    return link === null ? [] : [link];
  });
};
