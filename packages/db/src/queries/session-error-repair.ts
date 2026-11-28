import { brandId, type SessionId } from '@goodboy/types';
import type { Database } from '../client';

type ErroredSessionsParams = {
  readonly db: Database;
};

export const listErroredSessionIds = async ({
  db,
}: ErroredSessionsParams): Promise<ReadonlyArray<SessionId>> => {
  const rows = await db.select<{ id: string }>(
    "SELECT id FROM sessions WHERE state_kind = 'error' AND deleted_at IS NULL",
  );
  return rows.map((row) => brandId<SessionId>({ value: row.id }));
};

type RepairSessionErrorParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const repairSessionErrorState = async ({
  db,
  sessionId,
}: RepairSessionErrorParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE sessions SET state_kind = 'idle'
     WHERE id = ? AND state_kind = 'error'
       AND NOT EXISTS (
         SELECT 1 FROM live_agents WHERE session_id = ? AND status = 'running'
       )`,
    [sessionId, sessionId],
  );
  return result.rowsAffected > 0;
};
