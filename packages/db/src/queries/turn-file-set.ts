import {
  brandId,
  type MountId,
  type ProviderRunId,
  type SessionId,
  type TurnFile,
  type TurnFileSet,
} from '@goodboy/types';
import type { Database } from '../client';
import { isJsonArray, isStringArray, parseJsonColumn } from '../shared/parseJsonColumn';

type InsertParams = {
  readonly db: Database;
  readonly set: TurnFileSet;
};

export const insertTurnFileSet = async ({ db, set }: InsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO turn_file_sets
       (id, run_id, mount_id, session_id, own_json, from_base_json, is_partial, recorded_at,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (run_id, mount_id) DO NOTHING`,
    [
      crypto.randomUUID(),
      set.runId,
      set.mountId,
      set.sessionId,
      JSON.stringify(set.own),
      JSON.stringify(set.fromBase),
      set.isPartial ? 1 : 0,
      set.recordedAtMs,
      set.recordedAtMs,
      set.recordedAtMs,
    ],
  );
};

type Row = {
  readonly run_id: string;
  readonly mount_id: string;
  readonly session_id: string;
  readonly own_json: string;
  readonly from_base_json: string;
  readonly is_partial: number;
  readonly recorded_at: number;
};

type EntryParams = {
  readonly entry: unknown;
};

type CountParams = {
  readonly value: unknown;
};

const countValueOf = ({ value }: CountParams): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

const fileOf = ({ entry }: EntryParams): TurnFile | null => {
  if (typeof entry !== 'object' || entry === null) {
    return null;
  }
  const path = Reflect.get(entry, 'path');
  const status = Reflect.get(entry, 'status');
  if (typeof path !== 'string') {
    return null;
  }
  if (status !== 'added' && status !== 'modified' && status !== 'deleted') {
    return null;
  }
  return {
    path,
    status,
    additions: countValueOf({ value: Reflect.get(entry, 'additions') }),
    deletions: countValueOf({ value: Reflect.get(entry, 'deletions') }),
  };
};

type RowParams = {
  readonly row: Row;
};

const toTurnFileSet = ({ row }: RowParams): TurnFileSet => ({
  runId: brandId<ProviderRunId>({ value: row.run_id }),
  mountId: brandId<MountId>({ value: row.mount_id }),
  sessionId: brandId<SessionId>({ value: row.session_id }),
  own: parseJsonColumn({ value: row.own_json, isValid: isJsonArray, fallback: [] }).flatMap(
    (entry) => {
      const file = fileOf({ entry });
      return file === null ? [] : [file];
    },
  ),
  fromBase: parseJsonColumn({ value: row.from_base_json, isValid: isStringArray, fallback: [] }),
  isPartial: row.is_partial === 1,
  recordedAtMs: row.recorded_at,
});

type ListParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const listTurnFileSets = async ({
  db,
  sessionId,
}: ListParams): Promise<ReadonlyArray<TurnFileSet>> => {
  const rows = await db.select<Row>(
    `SELECT run_id, mount_id, session_id, own_json, from_base_json, is_partial, recorded_at
     FROM turn_file_sets WHERE session_id = ? ORDER BY recorded_at, run_id, mount_id`,
    [sessionId],
  );
  return rows.map((row) => toTurnFileSet({ row }));
};
