import type { Database } from '../client';

type CostRow = {
  readonly usd: number | null;
  readonly records: number;
};

type ReadRunCostParams = {
  readonly db: Database;
  readonly runId: string;
};

export const readRunCostUsd = async ({ db, runId }: ReadRunCostParams): Promise<number | null> => {
  const rows = await db.select<CostRow>(
    `SELECT SUM(estimated_cost_usd) AS usd, COUNT(*) AS records
     FROM telemetry_records WHERE run_id = ?`,
    [runId],
  );
  const row = rows[0];
  if (row === undefined || row.records === 0 || row.usd === null) {
    return null;
  }
  return row.usd;
};
