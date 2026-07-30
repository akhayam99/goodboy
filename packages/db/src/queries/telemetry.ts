import type {
  IsoDateTime,
  ProviderName,
  ProviderRunId,
  SessionId,
  TelemetryKind,
  TelemetryRecord,
  TelemetryRecordId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

type TelemetryRow = {
  id: string;
  run_id: string;
  session_id: string;
  kind: TelemetryKind;
  provider: ProviderName;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  cache_creation_input_tokens: number;
  context_tokens: number | null;
  estimated_cost_usd: number;
  recorded_at: number;
};

function toDomain(row: TelemetryRow): TelemetryRecord {
  return {
    id: row.id as TelemetryRecordId,
    runId: row.run_id as ProviderRunId,
    sessionId: row.session_id as SessionId,
    kind: row.kind,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cachedInputTokens: row.cached_input_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    ...(row.context_tokens != null && { contextTokens: row.context_tokens }),
    estimatedCostUsd: row.estimated_cost_usd,
    recordedAt: new Date(row.recorded_at).toISOString() as IsoDateTime,
  };
}

export const insertTelemetry = async (db: Database, record: TelemetryRecord): Promise<void> => {
  await db.execute(
    `INSERT INTO telemetry_records
      (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens, cached_input_tokens, cache_creation_input_tokens, context_tokens, estimated_cost_usd, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.runId,
      record.sessionId,
      record.kind,
      record.provider,
      record.model,
      record.inputTokens,
      record.outputTokens,
      record.cachedInputTokens ?? 0,
      record.cacheCreationInputTokens ?? 0,
      record.contextTokens ?? null,
      record.estimatedCostUsd,
      Date.parse(record.recordedAt),
    ],
  );
};

export const listTelemetryForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<TelemetryRecord>> => {
  const rows = await db.select<TelemetryRow>(
    'SELECT * FROM telemetry_records WHERE session_id = ? ORDER BY recorded_at ASC',
    [sessionId],
  );
  return rows.map(toDomain);
};

export type TelemetrySummary = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostUsd: number;
  readonly recordCount: number;
};

type SummaryRow = {
  input: number | null;
  output: number | null;
  cost: number | null;
  count: number;
};

const SUMMARY_SELECT = `
  COALESCE(SUM(input_tokens), 0) AS input,
  COALESCE(SUM(output_tokens), 0) AS output,
  COALESCE(SUM(estimated_cost_usd), 0) AS cost,
  COUNT(*) AS count
`;

const toSummary = (row: SummaryRow | undefined): TelemetrySummary => {
  return {
    inputTokens: row?.input ?? 0,
    outputTokens: row?.output ?? 0,
    estimatedCostUsd: row?.cost ?? 0,
    recordCount: row?.count ?? 0,
  };
};

export const summarizeSessionTelemetry = async (
  db: Database,
  sessionId: SessionId,
): Promise<TelemetrySummary> => {
  const rows = await db.select<SummaryRow>(
    `SELECT ${SUMMARY_SELECT} FROM telemetry_records WHERE session_id = ?`,
    [sessionId],
  );
  return toSummary(rows[0]);
};

export const summarizeWorkspaceTelemetry = async (
  db: Database,
  workspaceId: WorkspaceId,
): Promise<TelemetrySummary> => {
  const rows = await db.select<SummaryRow>(
    `SELECT ${SUMMARY_SELECT}
       FROM telemetry_records t
       INNER JOIN sessions s ON s.id = t.session_id
      WHERE s.workspace_id = ?`,
    [workspaceId],
  );
  return toSummary(rows[0]);
};

export const summarizeProviderTelemetry = async (
  db: Database,
  provider: ProviderName,
): Promise<TelemetrySummary> => {
  const rows = await db.select<SummaryRow>(
    `SELECT ${SUMMARY_SELECT} FROM telemetry_records WHERE provider = ?`,
    [provider],
  );
  return toSummary(rows[0]);
};

export type ProviderTelemetrySummary = {
  readonly provider: ProviderName;
  readonly estimatedCostUsd: number;
};

type ProviderSummaryRow = {
  provider: ProviderName;
  cost: number | null;
};

export const summarizeWorkspaceProviderTelemetry = async (
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<ProviderTelemetrySummary>> => {
  const rows = await db.select<ProviderSummaryRow>(
    `SELECT t.provider, COALESCE(SUM(t.estimated_cost_usd), 0) AS cost
       FROM telemetry_records t
       INNER JOIN sessions s ON s.id = t.session_id
      WHERE s.workspace_id = ?
      GROUP BY t.provider
      ORDER BY cost DESC`,
    [workspaceId],
  );
  return rows.map((r) => ({ provider: r.provider, estimatedCostUsd: r.cost ?? 0 }));
};
