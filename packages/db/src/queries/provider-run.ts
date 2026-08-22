import {
  isProviderName,
  type IsoDateTime,
  type ProviderRun,
  type ProviderRunId,
  type ProviderRunStatus,
  type RoutingDecision,
  type SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

type ProviderRunRow = {
  id: string;
  session_id: string;
  provider: string;
  model: string;
  status_kind: ProviderRunStatus['kind'];
  status_payload: string;
  created_at: number;
};

type ParsedPayload = {
  routingDecision?: RoutingDecision;
  [key: string]: unknown;
};

function toStatus(kind: ProviderRunStatus['kind'], payload: string): ProviderRunStatus {
  const data = JSON.parse(payload) as Record<string, unknown>;
  const { routingDecision: _, ...statusData } = data;
  if (typeof statusData.startedAt === 'number') {
    statusData.startedAt = new Date(statusData.startedAt).toISOString();
  }
  if (typeof statusData.finishedAt === 'number') {
    statusData.finishedAt = new Date(statusData.finishedAt).toISOString();
  }
  return { kind, ...statusData } as ProviderRunStatus;
}

function extractRoutingDecision(payload: string): RoutingDecision | undefined {
  const data = JSON.parse(payload) as ParsedPayload;
  return data.routingDecision;
}

function splitStatus(
  status: ProviderRunStatus,
  routingDecision?: RoutingDecision,
): {
  kind: ProviderRunStatus['kind'];
  payload: string;
} {
  const { kind, ...rest } = status;
  const storedStatus: Record<string, unknown> = { ...rest };
  if (typeof storedStatus.startedAt === 'string') {
    storedStatus.startedAt = Date.parse(storedStatus.startedAt);
  }
  if (typeof storedStatus.finishedAt === 'string') {
    storedStatus.finishedAt = Date.parse(storedStatus.finishedAt);
  }
  const merged =
    routingDecision !== undefined ? { ...storedStatus, routingDecision } : storedStatus;
  return { kind, payload: JSON.stringify(merged) };
}

function toDomain(row: ProviderRunRow): ProviderRun {
  if (isProviderName(row.provider) === false) {
    throw new Error(`invalid provider run provider: ${row.provider}`);
  }
  const routingDecision = extractRoutingDecision(row.status_payload);
  return {
    id: row.id as ProviderRunId,
    sessionId: row.session_id as SessionId,
    provider: row.provider,
    model: row.model,
    status: toStatus(row.status_kind, row.status_payload),
    ...(routingDecision !== undefined ? { routingDecision } : {}),
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
}

export const insertProviderRun = async (db: Database, run: ProviderRun): Promise<void> => {
  const { kind, payload } = splitStatus(run.status, run.routingDecision);
  await db.execute(
    `INSERT INTO provider_runs
      (id, session_id, provider, model, status_kind, status_payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [run.id, run.sessionId, run.provider, run.model, kind, payload, Date.parse(run.createdAt)],
  );
};

export const updateProviderRunStatus = async (
  db: Database,
  id: ProviderRunId,
  status: ProviderRunStatus,
): Promise<void> => {
  const rows = await db.select<Pick<ProviderRunRow, 'status_payload'>>(
    'SELECT status_payload FROM provider_runs WHERE id = ?',
    [id],
  );
  const existingRouting = rows[0] ? extractRoutingDecision(rows[0].status_payload) : undefined;
  const { kind, payload } = splitStatus(status, existingRouting);
  await db.execute('UPDATE provider_runs SET status_kind = ?, status_payload = ? WHERE id = ?', [
    kind,
    payload,
    id,
  ]);
};

type UpdateProviderRunStatusIfInFlightParams = {
  readonly db: Database;
  readonly id: ProviderRunId;
  readonly status: ProviderRunStatus;
};

export const updateProviderRunStatusIfInFlight = async ({
  db,
  id,
  status,
}: UpdateProviderRunStatusIfInFlightParams): Promise<number> => {
  const rows = await db.select<Pick<ProviderRunRow, 'status_payload'>>(
    'SELECT status_payload FROM provider_runs WHERE id = ?',
    [id],
  );
  const existingRouting = rows[0] ? extractRoutingDecision(rows[0].status_payload) : undefined;
  const { kind, payload } = splitStatus(status, existingRouting);
  const result = await db.execute(
    `UPDATE provider_runs
     SET status_kind = ?, status_payload = ?
     WHERE id = ? AND status_kind IN ('pending', 'streaming')`,
    [kind, payload, id],
  );
  return result.rowsAffected;
};

export const getProviderRunById = async (
  db: Database,
  id: ProviderRunId,
): Promise<ProviderRun | null> => {
  const rows = await db.select<ProviderRunRow>('SELECT * FROM provider_runs WHERE id = ?', [id]);
  const row = rows[0];
  return row ? toDomain(row) : null;
};
