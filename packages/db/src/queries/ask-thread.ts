import {
  PROVIDER_IDS,
  isEffortLevel,
  type AskThread,
  type ChatId,
  type IsoDateTime,
  type ProviderId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

type AskThreadRow = {
  readonly id: string;
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly title: string;
  readonly provider: string;
  readonly model: string;
  readonly effort: string | null;
  readonly lastActivityAt: number;
  readonly createdAt: number;
  readonly messageCount: number;
};

const toIso = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

const isProviderId = (value: string): value is ProviderId =>
  PROVIDER_IDS.some((provider) => provider === value);

const toThread = (row: AskThreadRow): AskThread | null => {
  if (!isProviderId(row.provider)) {
    return null;
  }
  return {
    id: row.id as ChatId,
    workspaceId: row.workspaceId as WorkspaceId,
    sessionId: row.sessionId as SessionId,
    title: row.title,
    provider: row.provider,
    model: row.model,
    effort: row.effort !== null && isEffortLevel(row.effort) ? row.effort : null,
    lastActivityAt: toIso(row.lastActivityAt),
    createdAt: toIso(row.createdAt),
    messageCount: row.messageCount,
  };
};

type ListAskThreadsParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const listAskThreads = async ({
  db,
  sessionId,
}: ListAskThreadsParams): Promise<ReadonlyArray<AskThread>> => {
  const rows = await db.select<AskThreadRow>(
    `SELECT c.id, c.workspace_id AS workspaceId, c.session_id AS sessionId, c.title, c.provider,
       c.model, c.effort, c.last_activity_at AS lastActivityAt, c.created_at AS createdAt,
       (SELECT COUNT(*) FROM chat_messages m WHERE m.chat_id = c.id AND m.role = 'user') AS messageCount
     FROM chats c WHERE c.session_id = ?
     ORDER BY c.last_activity_at DESC, c.created_at DESC, c.rowid DESC`,
    [sessionId],
  );
  return rows.flatMap((row) => {
    const thread = toThread(row);
    return thread === null ? [] : [thread];
  });
};

type InsertAskThreadParams = {
  readonly db: Database;
  readonly thread: AskThread;
};

export const insertAskThread = async ({ db, thread }: InsertAskThreadParams): Promise<void> => {
  await db.execute(
    `INSERT INTO chats (id, workspace_id, session_id, title, provider, model, effort, pinned_at,
       archived_at, last_activity_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    [
      thread.id,
      thread.workspaceId,
      thread.sessionId,
      thread.title,
      thread.provider,
      thread.model,
      thread.effort,
      Date.parse(thread.lastActivityAt),
      Date.parse(thread.createdAt),
      Date.parse(thread.createdAt),
    ],
  );
};
