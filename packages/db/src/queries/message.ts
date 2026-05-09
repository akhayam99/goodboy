import type {
  IsoDateTime,
  Message,
  MessageId,
  MessageRole,
  TaskId,
  TurnProviderOverride,
} from '@kay-am/types';
import type { Database } from '../client';

interface MessageRow {
  id: string;
  task_id: string;
  role: MessageRole;
  content: string;
  created_at: number;
  provider_override_id: string | null;
  provider_override_model: string | null;
}

function toDomain(row: MessageRow): Message {
  const providerOverride: TurnProviderOverride | undefined =
    row.provider_override_id != null
      ? {
          providerId: row.provider_override_id as TurnProviderOverride['providerId'],
          model: row.provider_override_model ?? undefined,
        }
      : undefined;

  return {
    id: row.id as MessageId,
    taskId: row.task_id as TaskId,
    role: row.role,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    ...(providerOverride !== undefined ? { providerOverride } : {}),
  };
}

export async function insertMessage(db: Database, message: Message): Promise<void> {
  await db.execute(
    `INSERT INTO messages
      (id, task_id, role, content, created_at, provider_override_id, provider_override_model)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.taskId,
      message.role,
      message.content,
      Date.parse(message.createdAt),
      message.providerOverride?.providerId ?? null,
      message.providerOverride?.model ?? null,
    ],
  );
}

export async function listMessagesForTask(
  db: Database,
  taskId: TaskId,
): Promise<ReadonlyArray<Message>> {
  const rows = await db.select<MessageRow>(
    'SELECT * FROM messages WHERE task_id = ? ORDER BY created_at ASC',
    [taskId],
  );
  return rows.map(toDomain);
}
