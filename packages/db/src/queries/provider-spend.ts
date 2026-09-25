import type { ProviderName, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

export type ProviderSpendPeriods = Readonly<{
  todayUsd: number;
  last7DaysUsd: number;
  thisMonthUsd: number;
}>;

type Row = {
  today: number | null;
  week: number | null;
  month: number | null;
};

type Params = {
  readonly db: Database;
  readonly provider: ProviderName;
  readonly workspaceId: WorkspaceId | null;
  readonly todayStartMs: number;
  readonly weekStartMs: number;
  readonly monthStartMs: number;
};

export const summarizeProviderSpendPeriods = async ({
  db,
  provider,
  workspaceId,
  todayStartMs,
  weekStartMs,
  monthStartMs,
}: Params): Promise<ProviderSpendPeriods> => {
  const rows = await db.select<Row>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.recorded_at >= ? THEN t.estimated_cost_usd END), 0) AS today,
       COALESCE(SUM(CASE WHEN t.recorded_at >= ? THEN t.estimated_cost_usd END), 0) AS week,
       COALESCE(SUM(CASE WHEN t.recorded_at >= ? THEN t.estimated_cost_usd END), 0) AS month
       FROM telemetry_records t
       INNER JOIN sessions s ON s.id = t.session_id
      WHERE t.provider = ?
        AND (? IS NULL OR s.workspace_id = ?)
        AND t.recorded_at >= ?`,
    [
      todayStartMs,
      weekStartMs,
      monthStartMs,
      provider,
      workspaceId,
      workspaceId,
      Math.min(todayStartMs, weekStartMs, monthStartMs),
    ],
  );
  const row = rows[0];
  return {
    todayUsd: row?.today ?? 0,
    last7DaysUsd: row?.week ?? 0,
    thisMonthUsd: row?.month ?? 0,
  };
};
