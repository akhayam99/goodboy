import type { Database } from '../client';
import { readRunCostUsd } from './auto-cost';

export type RunLedgerOutcome = Readonly<{
  assistantText: string;
  exit: 'ok' | 'error' | 'cancelled';
  costUsd: number | null;
}>;

type ReadRunLedgerOutcomeParams = {
  readonly db: Database;
  readonly runId: string;
  readonly agentId: string;
};

type RunRow = {
  readonly status_kind: string;
  readonly status_payload: string;
  readonly created_at: number;
};

type MessageRow = {
  readonly content: string;
};

const CANCELLED_BY_USER = 'cancelled by user';

type ExitParams = {
  readonly row: RunRow;
};

const exitOf = ({ row }: ExitParams): RunLedgerOutcome['exit'] | null => {
  if (row.status_kind === 'succeeded') {
    return 'ok';
  }
  if (row.status_kind === 'cancelled') {
    return 'cancelled';
  }
  if (row.status_kind !== 'failed') {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(row.status_payload);
    const error =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? payload.error
        : undefined;
    return error === CANCELLED_BY_USER ? 'cancelled' : 'error';
  } catch {
    return 'error';
  }
};

export const readRunLedgerOutcome = async ({
  db,
  runId,
  agentId,
}: ReadRunLedgerOutcomeParams): Promise<RunLedgerOutcome | null> => {
  const runs = await db.select<RunRow>(
    'SELECT status_kind, status_payload, created_at FROM provider_runs WHERE id = ?',
    [runId],
  );
  const run = runs[0];
  if (run === undefined) {
    return null;
  }
  const exit = exitOf({ row: run });
  if (exit === null) {
    return null;
  }
  const messages = await db.select<MessageRow>(
    `SELECT content FROM messages
     WHERE agent_id = ? AND role = 'assistant' AND created_at >= ?
     ORDER BY created_at DESC LIMIT 1`,
    [agentId, run.created_at],
  );
  return {
    assistantText: messages[0]?.content ?? '',
    exit,
    costUsd: await readRunCostUsd({ db, runId }),
  };
};
