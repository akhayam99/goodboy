import type { SessionId } from '@goodboy/types';
import type { Database } from '../client';

type ReadParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

type SaveParams = ReadParams & {
  readonly grid: string;
  readonly savedAt: number;
};

type Row = {
  readonly grid: string;
};

export const getSessionDockGrid = async ({ db, sessionId }: ReadParams): Promise<string | null> => {
  const rows = await db.select<Row>('SELECT grid FROM session_dock_grids WHERE session_id = ?', [
    sessionId,
  ]);
  return rows[0]?.grid ?? null;
};

export const saveSessionDockGrid = async ({
  db,
  sessionId,
  grid,
  savedAt,
}: SaveParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_dock_grids (id, session_id, grid, created_at, updated_at)
     SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM sessions WHERE id = ?)
     ON CONFLICT (session_id) DO UPDATE SET grid = excluded.grid, updated_at = excluded.updated_at
     WHERE excluded.updated_at >= session_dock_grids.updated_at`,
    [crypto.randomUUID(), sessionId, grid, savedAt, savedAt, sessionId],
  );
};
