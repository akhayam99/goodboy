import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { Database } from '../client';

type Row = {
  context_seen_at: number | null;
};

export const getSessionContextSeenAt = async (
  db: Database,
  sessionId: SessionId,
): Promise<IsoDateTime | null> => {
  const rows = await db.select<Row>('SELECT context_seen_at FROM sessions WHERE id = ?', [
    sessionId,
  ]);
  const value = rows[0]?.context_seen_at ?? null;
  return value === null ? null : (new Date(value).toISOString() as IsoDateTime);
};

export const setSessionContextSeenAt = async (
  db: Database,
  sessionId: SessionId,
  seenAt: IsoDateTime,
): Promise<void> => {
  await db.execute('UPDATE sessions SET context_seen_at = ? WHERE id = ?', [
    Date.parse(seenAt),
    sessionId,
  ]);
};
