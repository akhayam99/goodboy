import type {
  IsoDateTime,
  PhaseTemplateId,
  ProviderId,
  Session,
  SessionId,
  SessionProviderPreference,
  SessionState,
  WorkspaceId,
} from '@kay-am/types';
import type { Database } from '../client';

interface SessionRow {
  id: string;
  workspace_id: string;
  goal: string;
  state_kind: SessionState['kind'];
  state_payload: string;
  provider_default: string;
  provider_allow_override: number;
  phase_template_id: string | null;
  current_phase_ordinal: number | null;
  created_at: number;
  updated_at: number;
}

function toState(kind: SessionState['kind'], payload: string): SessionState {
  const data = JSON.parse(payload) as Record<string, unknown>;
  return { kind, ...data } as SessionState;
}

const VALID_PROVIDER_IDS: ReadonlySet<string> = new Set(['anthropic', 'cursor', 'codex']);

function toProviderPreference(row: SessionRow): SessionProviderPreference {
  const defaultProvider: ProviderId = VALID_PROVIDER_IDS.has(row.provider_default)
    ? (row.provider_default as ProviderId)
    : 'anthropic';
  return {
    defaultProvider,
    allowTurnOverride: row.provider_allow_override !== 0,
  };
}

function toDomain(row: SessionRow, contextSlots: Session['contextSlots']): Session {
  return {
    id: row.id as SessionId,
    workspaceId: row.workspace_id as WorkspaceId,
    goal: row.goal,
    state: toState(row.state_kind, row.state_payload),
    contextSlots,
    providerPreference: toProviderPreference(row),
    ...(row.phase_template_id && { phaseTemplateId: row.phase_template_id as PhaseTemplateId }),
    ...(row.current_phase_ordinal !== null && { currentPhaseOrdinal: row.current_phase_ordinal }),
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
      (id, workspace_id, goal, state_kind, state_payload, provider_default, provider_allow_override, phase_template_id, current_phase_ordinal, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.workspaceId,
      session.goal,
      kind,
      payload,
      session.providerPreference.defaultProvider,
      session.providerPreference.allowTurnOverride ? 1 : 0,
      session.phaseTemplateId ?? null,
      session.currentPhaseOrdinal ?? null,
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
