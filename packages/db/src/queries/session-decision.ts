import type {
  AgentId,
  IsoDateTime,
  SessionDecision,
  SessionDecisionAuthor,
  SessionDecisionStatus,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

type Row = {
  id: string;
  session_id: string;
  number: number;
  text: string;
  why: string | null;
  status: string;
  replaced_by: number | null;
  author: string;
  agent_id: string | null;
  turn_ordinal: number | null;
  reason: string | null;
  closed_by: string | null;
  closed_by_agent_id: string | null;
  previous_text: string | null;
  reworded_at: number | null;
  created_at: number;
  updated_at: number;
};

const STATUSES: ReadonlySet<string> = new Set(['active', 'replaced', 'withdrawn']);
const AUTHORS: ReadonlySet<string> = new Set(['agent', 'summarizer', 'user']);

const isStatus = (value: string): value is SessionDecisionStatus => STATUSES.has(value);
const isAuthor = (value: string): value is SessionDecisionAuthor => AUTHORS.has(value);

const isoOf = (value: number): IsoDateTime => new Date(value).toISOString() as IsoDateTime;

const toDomain = (row: Row): SessionDecision => ({
  id: row.id,
  sessionId: row.session_id as SessionId,
  number: row.number,
  text: row.text,
  why: row.why,
  status: isStatus(row.status) ? row.status : 'active',
  replacedBy: row.replaced_by,
  author: isAuthor(row.author) ? row.author : 'summarizer',
  agentId: row.agent_id === null ? null : (row.agent_id as AgentId),
  turnOrdinal: row.turn_ordinal,
  reason: row.reason,
  closedBy: row.closed_by !== null && isAuthor(row.closed_by) ? row.closed_by : null,
  closedByAgentId: row.closed_by_agent_id === null ? null : (row.closed_by_agent_id as AgentId),
  previousText: row.previous_text,
  rewordedAt: row.reworded_at === null ? null : isoOf(row.reworded_at),
  createdAt: isoOf(row.created_at),
  updatedAt: isoOf(row.updated_at),
});

const COLUMNS =
  'id, session_id, number, text, why, status, replaced_by, author, agent_id, turn_ordinal, reason, closed_by, closed_by_agent_id, previous_text, reworded_at, created_at, updated_at';

type SessionParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const listSessionDecisions = async ({
  db,
  sessionId,
}: SessionParams): Promise<ReadonlyArray<SessionDecision>> => {
  const rows = await db.select<Row>(
    `SELECT ${COLUMNS} FROM session_decisions WHERE session_id = ? ORDER BY number`,
    [sessionId],
  );
  return rows.map(toDomain);
};

type SaveParams = {
  readonly db: Database;
  readonly decisions: ReadonlyArray<SessionDecision>;
};

export const saveSessionDecisions = async ({ db, decisions }: SaveParams): Promise<void> => {
  if (decisions.length === 0) {
    return;
  }
  await db.transaction({
    statements: decisions.map((decision) => ({
      sql: `INSERT INTO session_decisions (${COLUMNS})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          text = excluded.text,
          why = excluded.why,
          status = excluded.status,
          replaced_by = excluded.replaced_by,
          author = excluded.author,
          reason = excluded.reason,
          closed_by = excluded.closed_by,
          closed_by_agent_id = excluded.closed_by_agent_id,
          previous_text = excluded.previous_text,
          reworded_at = excluded.reworded_at,
          updated_at = excluded.updated_at`,
      params: [
        decision.id,
        decision.sessionId,
        decision.number,
        decision.text,
        decision.why,
        decision.status,
        decision.replacedBy,
        decision.author,
        decision.agentId,
        decision.turnOrdinal,
        decision.reason,
        decision.closedBy,
        decision.closedByAgentId,
        decision.previousText,
        decision.rewordedAt === null ? null : Date.parse(decision.rewordedAt),
        Date.parse(decision.createdAt),
        Date.parse(decision.updatedAt),
      ],
    })),
  });
};
