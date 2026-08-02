import type {
  FileVersion,
  FileVersionChangeKind,
  FileVersionId,
  FileVersionSnapshotSource,
  IsoDateTime,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

type FileVersionRow = {
  readonly id: string;
  readonly session_id: string;
  readonly relative_path: string;
  readonly stored_name: string;
  readonly size_bytes: number;
  readonly content_hash: string;
  readonly change_kind: string;
  readonly snapshot_source: string;
  readonly provider_run_id: string | null;
  readonly captured_at: number;
};

type ToDomainParams = {
  readonly row: FileVersionRow;
};

const toDomain = ({ row }: ToDomainParams): FileVersion => ({
  id: row.id as FileVersionId,
  sessionId: row.session_id as SessionId,
  relativePath: row.relative_path,
  storedName: row.stored_name,
  sizeBytes: row.size_bytes,
  contentHash: row.content_hash,
  changeKind: row.change_kind as FileVersionChangeKind,
  snapshotSource: row.snapshot_source as FileVersionSnapshotSource,
  providerRunId: row.provider_run_id == null ? undefined : (row.provider_run_id as ProviderRunId),
  capturedAt: new Date(row.captured_at).toISOString() as IsoDateTime,
});

const SELECT_COLUMNS = `id, session_id, relative_path, stored_name, size_bytes, content_hash, change_kind, snapshot_source, provider_run_id, captured_at`;

type InsertParams = {
  readonly db: Database;
  readonly fileVersion: FileVersion;
};

export const insertFileVersion = async ({ db, fileVersion }: InsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO file_versions
       (id, session_id, relative_path, stored_name, size_bytes, content_hash, change_kind, snapshot_source, provider_run_id, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fileVersion.id,
      fileVersion.sessionId,
      fileVersion.relativePath,
      fileVersion.storedName,
      fileVersion.sizeBytes,
      fileVersion.contentHash,
      fileVersion.changeKind,
      fileVersion.snapshotSource,
      fileVersion.providerRunId ?? null,
      Date.parse(fileVersion.capturedAt),
    ],
  );
};

type ListForSessionParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const listFileVersionsForSession = async ({
  db,
  sessionId,
}: ListForSessionParams): Promise<ReadonlyArray<FileVersion>> => {
  const rows = await db.select<FileVersionRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM file_versions
      WHERE session_id = ?
      ORDER BY captured_at DESC, id DESC`,
    [sessionId],
  );
  return rows.map((row) => toDomain({ row }));
};

type ListForPathParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly relativePath: string;
};

export const listFileVersionsForPath = async ({
  db,
  sessionId,
  relativePath,
}: ListForPathParams): Promise<ReadonlyArray<FileVersion>> => {
  const rows = await db.select<FileVersionRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM file_versions
      WHERE session_id = ? AND relative_path = ?
      ORDER BY captured_at DESC, id DESC`,
    [sessionId, relativePath],
  );
  return rows.map((row) => toDomain({ row }));
};

type PruneForPathParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly relativePath: string;
  readonly retain: number;
};

export const pruneFileVersionsForPath = async ({
  db,
  sessionId,
  relativePath,
  retain,
}: PruneForPathParams): Promise<ReadonlyArray<FileVersion>> => {
  const retainCount = Number.isFinite(retain) ? Math.max(0, Math.trunc(retain)) : 0;
  const rows = await db.select<FileVersionRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM file_versions
      WHERE session_id = ? AND relative_path = ?
      ORDER BY captured_at DESC, id DESC
      LIMIT -1 OFFSET ?`,
    [sessionId, relativePath, retainCount],
  );
  if (rows.length === 0) {
    return [];
  }
  const placeholders = rows.map(() => '?').join(', ');
  await db.execute(
    `DELETE FROM file_versions WHERE id IN (${placeholders})`,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toDomain({ row }));
};

type DeleteParams = {
  readonly db: Database;
  readonly id: FileVersionId;
};

export const deleteFileVersion = async ({ db, id }: DeleteParams): Promise<void> => {
  await db.execute(`DELETE FROM file_versions WHERE id = ?`, [id]);
};

type DeleteForSessionParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const deleteFileVersionsForSession = async ({
  db,
  sessionId,
}: DeleteForSessionParams): Promise<void> => {
  await db.execute(`DELETE FROM file_versions WHERE session_id = ?`, [sessionId]);
};
