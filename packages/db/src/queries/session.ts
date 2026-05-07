import type { IsoDateTime, Session, SessionId, SessionState, WorkspaceId } from '@kay-am/types';
import type { Database } from '../client';

interface SessionRow {
  id: string;
  workspace_id: string;
  goal: string;
  state_kind: SessionState['kind'];
  state_payload: string;
  created_at: number;
  updated_at: number;
}

function toState(kind: SessionState['kind'], payload: string): SessionState {
  const data = JSON.parse(payload) as Record<string, unknown>;
  return { kind, ...data } as SessionState;
}

function toDomain(row: SessionRow, contextSlots: Session['contextSlots']): Session {
  return {
    id: row.id as SessionId,
    workspaceId: row.workspace_id as WorkspaceId,
    goal: row.goal,
    state: toState(row.state_kind, row.state_payload),
    contextSlots,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
}

function splitState(state: SessionState): { kind: SessionState['kind']; payload: string } {
  const { kind, ...rest } = state;
  return { kind, payload: JSON.stringify(rest) };
}

export async function insertSession(db: Database, session: Session): Promise<void> {
  const { kind, payload } = splitState(session.state);
  await db.execute(
    `INSERT INTO sessions
      (id, workspace_id, goal, state_kind, state_payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.workspaceId,
      session.goal,
      kind,
      payload,
      Date.parse(session.createdAt),
      Date.parse(session.updatedAt),
    ],
  );
}

export async function updateSessionState(
  db: Database,
  id: SessionId,
  state: SessionState,
  updatedAt: IsoDateTime,
): Promise<void> {
  const { kind, payload } = splitState(state);
  await db.execute(
    'UPDATE sessions SET state_kind = ?, state_payload = ?, updated_at = ? WHERE id = ?',
    [kind, payload, Date.parse(updatedAt), id],
  );
}

export async function getSessionById(db: Database, id: SessionId): Promise<Session | null> {
  const rows = await db.select<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
  const row = rows[0];
  if (!row) return null;
  return toDomain(row, []);
}

export async function listSessionsForWorkspace(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<Session>> {
  const rows = await db.select<SessionRow>(
    'SELECT * FROM sessions WHERE workspace_id = ? ORDER BY updated_at DESC',
    [workspaceId],
  );
  return rows.map((row) => toDomain(row, []));
}
