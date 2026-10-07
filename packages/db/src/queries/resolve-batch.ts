import type { ResolveBatch, SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { resolveStringArray } from './resolve-json';
import {
  EMPTY_LAUNCH_CHOICE,
  parseLaunchChoice,
  serializeLaunchChoice,
} from './resolve-launch-choice';

type Row = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly threadIds: string;
  readonly launchChoice: string;
  readonly createdAt: number;
};

type SessionParams = { readonly db: Database; readonly sessionId: SessionId };

const COLUMNS = `id, session_id AS sessionId, thread_ids_json AS threadIds,
  launch_choice_json AS launchChoice, created_at AS createdAt`;

const hydrate = ({ row }: { readonly row: Row }): ResolveBatch => ({
  id: row.id,
  sessionId: row.sessionId,
  threadIds: resolveStringArray({ json: row.threadIds }),
  launchChoice: parseLaunchChoice({ json: row.launchChoice }) ?? EMPTY_LAUNCH_CHOICE,
  createdAt: row.createdAt,
});

export const insertResolveBatch = async ({
  db,
  batch,
}: {
  readonly db: Database;
  readonly batch: ResolveBatch;
}): Promise<void> => {
  await db.execute(
    'INSERT INTO resolve_batches (id, session_id, thread_ids_json, launch_choice_json, created_at) VALUES (?, ?, ?, ?, ?)',
    [
      batch.id,
      batch.sessionId,
      JSON.stringify(batch.threadIds),
      serializeLaunchChoice({ choice: batch.launchChoice }),
      batch.createdAt,
    ],
  );
};

export const listResolveBatches = async ({
  db,
  sessionId,
}: SessionParams): Promise<ReadonlyArray<ResolveBatch>> => {
  const rows = await db.select<Row>(
    `SELECT ${COLUMNS} FROM resolve_batches WHERE session_id = ? ORDER BY created_at, rowid`,
    [sessionId],
  );
  return rows.map((row) => hydrate({ row }));
};
