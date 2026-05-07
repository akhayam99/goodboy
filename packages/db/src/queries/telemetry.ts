import type {
  IsoDateTime,
  ProviderName,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
} from '@kay-am/types';
import type { Database } from '../client';

interface TelemetryRow {
  id: string;
  run_id: string;
  session_id: string;
  provider: ProviderName;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  recorded_at: number;
}

function toDomain(row: TelemetryRow): TelemetryRecord {
  return {
    id: row.id as TelemetryRecordId,
    runId: row.run_id as ProviderRunId,
    sessionId: row.session_id as SessionId,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    estimatedCostUsd: row.estimated_cost_usd,
    recordedAt: new Date(row.recorded_at).toISOString() as IsoDateTime,
  };
}

export async function insertTelemetry(db: Database, record: TelemetryRecord): Promise<void> {
  await db.execute(
    `INSERT INTO telemetry_records
      (id, run_id, session_id, provider, model, input_tokens, output_tokens, estimated_cost_usd, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.runId,
      record.sessionId,
      record.provider,
      record.model,
      record.inputTokens,
      record.outputTokens,
      record.estimatedCostUsd,
      Date.parse(record.recordedAt),
    ],
  );
}

export interface SessionTelemetrySummary {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostUsd: number;
  readonly recordCount: number;
}

export async function summarizeSessionTelemetry(
  db: Database,
  sessionId: SessionId,
): Promise<SessionTelemetrySummary> {
  const rows = await db.select<{
    input: number | null;
    output: number | null;
    cost: number | null;
    count: number;
  }>(
    `SELECT
       COALESCE(SUM(input_tokens), 0) AS input,
       COALESCE(SUM(output_tokens), 0) AS output,
       COALESCE(SUM(estimated_cost_usd), 0) AS cost,
       COUNT(*) AS count
     FROM telemetry_records WHERE session_id = ?`,
    [sessionId],
  );
  const row = rows[0] ?? { input: 0, output: 0, cost: 0, count: 0 };
  return {
    inputTokens: row.input ?? 0,
    outputTokens: row.output ?? 0,
    estimatedCostUsd: row.cost ?? 0,
    recordCount: row.count,
  };
}
