import type {
  AgentId,
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

interface TelemetryRow {
  id: string;
  run_id: string;
  session_id: string;
  agent_id: string | null;
  kind: TelemetryKind;
  provider: ProviderName;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  cache_creation_5m_tokens: number;
  cache_creation_1h_tokens: number;
  estimated_cost_usd: number;
  recorded_at: number;
}

function toDomain(row: TelemetryRow): TelemetryRecord {
  return {
    id: row.id as TelemetryRecordId,
    runId: row.run_id as ProviderRunId,
    sessionId: row.session_id as SessionId,
    agentId: row.agent_id !== null ? (row.agent_id as AgentId) : null,
    kind: row.kind,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cachedInputTokens: row.cached_input_tokens,
    cacheCreation5mTokens: row.cache_creation_5m_tokens,
    cacheCreation1hTokens: row.cache_creation_1h_tokens,
    estimatedCostUsd: row.estimated_cost_usd,
    recordedAt: new Date(row.recorded_at).toISOString() as IsoDateTime,
  };
}

export async function insertTelemetry(db: Database, record: TelemetryRecord): Promise<void> {
  await db.execute(
    `INSERT INTO telemetry_records
      (id, run_id, session_id, agent_id, kind, provider, model,
       input_tokens, output_tokens, cached_input_tokens,
       cache_creation_5m_tokens, cache_creation_1h_tokens,
       estimated_cost_usd, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.runId,
      record.sessionId,
      record.agentId,
      record.kind,
      record.provider,
      record.model,
      record.inputTokens,
      record.outputTokens,
      record.cachedInputTokens,
      record.cacheCreation5mTokens,
      record.cacheCreation1hTokens,
      record.estimatedCostUsd,
      Date.parse(record.recordedAt),
    ],
  );
}

export async function listTelemetryForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<TelemetryRecord>> {
  const rows = await db.select<TelemetryRow>(
    'SELECT * FROM telemetry_records WHERE session_id = ? ORDER BY recorded_at ASC',
    [sessionId],
  );
  return rows.map(toDomain);
}

export async function listTelemetryForAgent(
  db: Database,
  agentId: AgentId,
): Promise<ReadonlyArray<TelemetryRecord>> {
  const rows = await db.select<TelemetryRow>(
    'SELECT * FROM telemetry_records WHERE agent_id = ? ORDER BY recorded_at ASC',
    [agentId],
  );
  return rows.map(toDomain);
}

export async function listTelemetryForWorkspace(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<TelemetryRecord>> {
  const rows = await db.select<TelemetryRow>(
    `SELECT t.*
       FROM telemetry_records t
       INNER JOIN sessions s ON s.id = t.session_id
      WHERE s.workspace_id = ?
      ORDER BY t.recorded_at ASC`,
    [workspaceId],
  );
  return rows.map(toDomain);
}

export interface TelemetrySummary {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostUsd: number;
  readonly recordCount: number;
}

interface SummaryRow {
  input: number | null;
  output: number | null;
  cost: number | null;
  count: number;
}

const SUMMARY_SELECT = `
  COALESCE(SUM(input_tokens), 0) AS input,
  COALESCE(SUM(output_tokens), 0) AS output,
  COALESCE(SUM(estimated_cost_usd), 0) AS cost,
  COUNT(*) AS count
`;

function toSummary(row: SummaryRow | undefined): TelemetrySummary {
  return {
    inputTokens: row?.input ?? 0,
    outputTokens: row?.output ?? 0,
    estimatedCostUsd: row?.cost ?? 0,
    recordCount: row?.count ?? 0,
  };
}

export async function summarizeSessionTelemetry(
  db: Database,
  sessionId: SessionId,
): Promise<TelemetrySummary> {
  const rows = await db.select<SummaryRow>(
    `SELECT ${SUMMARY_SELECT} FROM telemetry_records WHERE session_id = ?`,
    [sessionId],
  );
  return toSummary(rows[0]);
}

export async function summarizeWorkspaceTelemetry(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<TelemetrySummary> {
  const rows = await db.select<SummaryRow>(
    `SELECT ${SUMMARY_SELECT}
       FROM telemetry_records t
       INNER JOIN sessions s ON s.id = t.session_id
      WHERE s.workspace_id = ?`,
    [workspaceId],
  );
  return toSummary(rows[0]);
}

export async function summarizeProviderTelemetry(
  db: Database,
  provider: ProviderName,
): Promise<TelemetrySummary> {
  const rows = await db.select<SummaryRow>(
    `SELECT ${SUMMARY_SELECT} FROM telemetry_records WHERE provider = ?`,
    [provider],
  );
  return toSummary(rows[0]);
}

export interface ProviderTelemetrySummary {
  readonly provider: ProviderName;
  readonly estimatedCostUsd: number;
}

interface ProviderSummaryRow {
  provider: ProviderName;
  cost: number | null;
}

export async function summarizeWorkspaceProviderTelemetry(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<ProviderTelemetrySummary>> {
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
}
