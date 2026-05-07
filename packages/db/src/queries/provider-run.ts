import type {
  IsoDateTime,
  ProviderName,
  ProviderRun,
  ProviderRunId,
  ProviderRunStatus,
  SessionId,
} from '@kay-am/types';
import type { Database } from '../client';

interface ProviderRunRow {
  id: string;
  session_id: string;
  provider: ProviderName;
  model: string;
  status_kind: ProviderRunStatus['kind'];
  status_payload: string;
  created_at: number;
}

function toStatus(kind: ProviderRunStatus['kind'], payload: string): ProviderRunStatus {
  const data = JSON.parse(payload) as Record<string, unknown>;
  return { kind, ...data } as ProviderRunStatus;
}

function splitStatus(status: ProviderRunStatus): {
  kind: ProviderRunStatus['kind'];
  payload: string;
} {
  const { kind, ...rest } = status;
  return { kind, payload: JSON.stringify(rest) };
}

function toDomain(row: ProviderRunRow): ProviderRun {
  return {
    id: row.id as ProviderRunId,
    sessionId: row.session_id as SessionId,
    provider: row.provider,
    model: row.model,
    status: toStatus(row.status_kind, row.status_payload),
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
}

export async function insertProviderRun(db: Database, run: ProviderRun): Promise<void> {
  const { kind, payload } = splitStatus(run.status);
  await db.execute(
    `INSERT INTO provider_runs
      (id, session_id, provider, model, status_kind, status_payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [run.id, run.sessionId, run.provider, run.model, kind, payload, Date.parse(run.createdAt)],
  );
}

export async function updateProviderRunStatus(
  db: Database,
  id: ProviderRunId,
  status: ProviderRunStatus,
): Promise<void> {
  const { kind, payload } = splitStatus(status);
  await db.execute('UPDATE provider_runs SET status_kind = ?, status_payload = ? WHERE id = ?', [
    kind,
    payload,
    id,
  ]);
}

export async function getProviderRunById(
  db: Database,
  id: ProviderRunId,
): Promise<ProviderRun | null> {
  const rows = await db.select<ProviderRunRow>('SELECT * FROM provider_runs WHERE id = ?', [id]);
  const row = rows[0];
  return row ? toDomain(row) : null;
}
