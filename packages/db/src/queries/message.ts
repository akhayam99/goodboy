import type {
  AgentId,
  IsoDateTime,
  Message,
  MessageId,
  MessageRole,
  SessionId,
  TurnProviderOverride,
} from '@goodboy/types'
import type { Database } from '../client'

type MessageRow = {
  id: string
  session_id: string
  agent_id: string
  role: MessageRole
  content: string
  created_at: number
  provider_override_id: string | null
  provider_override_model: string | null
}

function toDomain(row: MessageRow): Message {
  const providerOverride: TurnProviderOverride | undefined =
    row.provider_override_id != null
      ? {
          providerId: row.provider_override_id as TurnProviderOverride['providerId'],
          model: row.provider_override_model ?? undefined,
        }
      : undefined

  return {
    id: row.id as MessageId,
    sessionId: row.session_id as SessionId,
    agentId: row.agent_id as AgentId,
    role: row.role,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    ...(providerOverride !== undefined ? { providerOverride } : {}),
  }
}

export const insertMessage = async (db: Database, message: Message): Promise<void> => {
  await db.execute(
    `INSERT INTO messages
      (id, session_id, agent_id, role, content, created_at, provider_override_id, provider_override_model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.sessionId,
      message.agentId,
      message.role,
      message.content,
      Date.parse(message.createdAt),
      message.providerOverride?.providerId ?? null,
      message.providerOverride?.model ?? null,
    ],
  )
}

export const listMessagesForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<Message>> => {
  const rows = await db.select<MessageRow>(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  )
  return rows.map(toDomain)
}

export const listMessagesForAgent = async (
  db: Database,
  agentId: AgentId,
  opts?: { readonly limit?: number },
): Promise<ReadonlyArray<Message>> => {
  if (opts?.limit !== undefined) {
    const rows = await db.select<MessageRow>(
      'SELECT * FROM messages WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?',
      [agentId, opts.limit],
    )
    const out = rows.map(toDomain)
    out.reverse()
    return out
  }
  const rows = await db.select<MessageRow>(
    'SELECT * FROM messages WHERE agent_id = ? ORDER BY created_at ASC',
    [agentId],
  )
  return rows.map(toDomain)
}
