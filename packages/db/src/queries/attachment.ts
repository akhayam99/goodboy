import type {
  Attachment,
  AttachmentMime,
  IsoDateTime,
  MessageId,
  SessionId,
  TaskId,
} from '@kay-am/types';
import type { Database } from '../client';

interface AttachmentRow {
  id: string;
  task_id: string;
  agent_id: string;
  message_id: string;
  mime: string;
  sha256: string;
  size_bytes: number;
  created_at: number;
}

function toDomain(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    taskId: row.task_id as TaskId,
    agentId: row.agent_id as SessionId,
    messageId: row.message_id as MessageId,
    mime: row.mime as AttachmentMime,
    sha256: row.sha256,
    sizeBytes: row.size_bytes,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
}

export async function insertAttachment(db: Database, attachment: Attachment): Promise<void> {
  await db.execute(
    `INSERT INTO attachments
      (id, task_id, agent_id, message_id, mime, sha256, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attachment.id,
      attachment.taskId,
      attachment.agentId,
      attachment.messageId,
      attachment.mime,
      attachment.sha256,
      attachment.sizeBytes,
      Date.parse(attachment.createdAt),
    ],
  );
}

export async function listAttachmentsForMessage(
  db: Database,
  messageId: MessageId,
): Promise<ReadonlyArray<Attachment>> {
  const rows = await db.select<AttachmentRow>(
    'SELECT * FROM attachments WHERE message_id = ? ORDER BY created_at ASC',
    [messageId],
  );
  return rows.map(toDomain);
}

export async function listAttachmentsForTask(
  db: Database,
  taskId: TaskId,
): Promise<ReadonlyArray<Attachment>> {
  const rows = await db.select<AttachmentRow>(
    'SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at ASC',
    [taskId],
  );
  return rows.map(toDomain);
}
