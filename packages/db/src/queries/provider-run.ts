import type {
  ProviderRun,
  ProviderRunId,
  ProviderRunStatus,
  RoutingDecision,
} from '@goodboy/types';
import type { Database } from '../client';
import { isJsonRecord, parseJsonColumn } from '../shared/parseJsonColumn';

type ProviderRunRow = {
  id: string;
  session_id: string;
  provider: string;
  model: string;
  status_kind: ProviderRunStatus['kind'];
  status_payload: string;
  created_at: number;
};

const isStoredRoutingDecision = (value: unknown): value is RoutingDecision => isJsonRecord(value);

function extractRoutingDecision(payload: string): RoutingDecision | undefined {
  const data = parseJsonColumn({ value: payload, isValid: isJsonRecord, fallback: {} });
  return isStoredRoutingDecision(data.routingDecision) ? data.routingDecision : undefined;
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
