import type { IsoDateTime, Message, MessageId, MessageRole, SessionId } from '@kay-am/types';
import type { Database } from '../client';

interface MessageRow {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: number;
}

function toDomain(row: MessageRow): Message {
  return {
    id: row.id as MessageId,
    sessionId: row.session_id as SessionId,
    role: row.role,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
}

export async function insertMessage(db: Database, message: Message): Promise<void> {
  await db.execute(
    'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    [message.id, message.sessionId, message.role, message.content, Date.parse(message.createdAt)],
  );
}

export async function listMessagesForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<Message>> {
  const rows = await db.select<MessageRow>(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
  return rows.map(toDomain);
}
