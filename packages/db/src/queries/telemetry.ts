import type {
  IsoDateTime,
  AgentId,
  InvocationPurpose,
  ProviderName,
  ProviderRunId,
  SessionId,
  TelemetryKind,
  TelemetryRecord,
  TelemetryRecordId,
  UsageAttributionStatus,
  WorkflowRunId,
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
  invocation_id: string | null;
  workflow_run_id: string | null;
  agent_id: string | null;
  purpose: InvocationPurpose | null;
  usage_event_id: string | null;
  attribution_status: UsageAttributionStatus;
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
    ...(row.invocation_id != null && { invocationId: row.invocation_id }),
    ...(row.workflow_run_id != null && {
      workflowRunId: row.workflow_run_id as WorkflowRunId,
    }),
    ...(row.agent_id != null && { agentId: row.agent_id as AgentId }),
    ...(row.purpose != null && { purpose: row.purpose }),
    ...(row.usage_event_id != null && { usageEventId: row.usage_event_id }),
    attributionStatus: row.attribution_status,
  };
}

export const insertTelemetry = async (db: Database, record: TelemetryRecord): Promise<boolean> => {
  const inserted = await db.execute(
    `INSERT INTO telemetry_records
      (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens, cached_input_tokens, cache_creation_input_tokens, context_tokens, estimated_cost_usd, recorded_at, invocation_id, workflow_run_id, agent_id, purpose, usage_event_id, attribution_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`,
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
      record.invocationId ?? null,
      record.workflowRunId ?? null,
      record.agentId ?? null,
      record.purpose ?? null,
      record.usageEventId ?? null,
      record.attributionStatus ?? 'unattributed',
    ],
  );
  const isInserted = inserted.rowsAffected > 0;
  if (record.invocationId == null) {
    return isInserted;
  }
  await db.execute(
    `UPDATE invocation_tickets
        SET measured_spend_usd = (
              SELECT COALESCE(SUM(estimated_cost_usd), 0)
                FROM telemetry_records
               WHERE invocation_id = ?
            ),
            measurement_status = CASE
              WHEN reservation_status = 'settled' THEN 'measured'
              ELSE measurement_status
            END,
            updated_at = ?
      WHERE id = ? AND reservation_status IN ('reserved', 'settled')`,
    [record.invocationId, Date.parse(record.recordedAt), record.invocationId],
  );
  return isInserted;
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

export const summarizeWorkflowRunTelemetry = async (
  db: Database,
  workflowRunId: WorkflowRunId,
): Promise<TelemetrySummary> => {
  const rows = await db.select<SummaryRow>(
    `SELECT ${SUMMARY_SELECT}
       FROM telemetry_records
      WHERE workflow_run_id = ? AND attribution_status = 'attributed'`,
    [workflowRunId],
  );
  return toSummary(rows[0]);
};

export const summarizeUnattributedTelemetry = async (db: Database): Promise<TelemetrySummary> => {
  const rows = await db.select<SummaryRow>(
    `SELECT ${SUMMARY_SELECT}
       FROM telemetry_records
      WHERE attribution_status = 'unattributed'`,
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
