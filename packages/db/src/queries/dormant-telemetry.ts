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

export type DormantTelemetry = {
  readonly record: TelemetryRecord;
  readonly goal: string;
  readonly isDeleted: boolean;
};

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

type Row = {
  readonly id: string;
  readonly run_id: string;
  readonly session_id: string;
  readonly kind: TelemetryKind;
  readonly provider: ProviderName;
  readonly model: string;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cached_input_tokens: number | null;
  readonly cache_creation_input_tokens: number | null;
  readonly context_tokens: number | null;
  readonly estimated_cost_usd: number;
  readonly recorded_at: number;
  readonly goal: string;
  readonly is_deleted: number;
};

const toDormant = (row: Row): DormantTelemetry => ({
  record: {
    id: row.id as TelemetryRecordId,
    runId: row.run_id as ProviderRunId,
    sessionId: row.session_id as SessionId,
    kind: row.kind,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cachedInputTokens: row.cached_input_tokens ?? 0,
    cacheCreationInputTokens: row.cache_creation_input_tokens ?? 0,
    ...(row.context_tokens != null && { contextTokens: row.context_tokens }),
    estimatedCostUsd: row.estimated_cost_usd,
    recordedAt: new Date(row.recorded_at).toISOString() as IsoDateTime,
  },
  goal: row.goal,
  isDeleted: row.is_deleted === 1,
});

export const listDormantSessionTelemetry = async ({
  db,
  workspaceId,
}: Params): Promise<ReadonlyArray<DormantTelemetry>> => {
  const rows = await db.select<Row>(
    `SELECT t.id, t.run_id, t.session_id, t.kind, t.provider, t.model, t.input_tokens,
            t.output_tokens, t.cached_input_tokens, t.cache_creation_input_tokens,
            t.context_tokens, t.estimated_cost_usd, t.recorded_at,
            s.goal AS goal,
            CASE WHEN s.deleted_at IS NOT NULL THEN 1 ELSE 0 END AS is_deleted
       FROM telemetry_records t
       JOIN sessions s ON s.id = t.session_id
      WHERE s.workspace_id = ?
        AND (s.deleted_at IS NOT NULL OR s.archived_at IS NOT NULL)
      ORDER BY t.recorded_at ASC, t.id ASC`,
    [workspaceId],
  );
  return rows.map(toDormant);
};
