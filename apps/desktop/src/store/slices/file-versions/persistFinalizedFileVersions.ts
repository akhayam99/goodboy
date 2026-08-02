import {
  deleteFileVersionsForSession,
  deleteFileVersion as deleteFileVersionRow,
  insertFileVersion,
  pruneFileVersionsForPath,
} from '@goodboy/db';
import type {
  FileVersion,
  FileVersionId,
  FileVersionSnapshotSource,
  IsoDateTime,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  fileVersionsDelete,
  fileVersionsPurgeSession,
  type FinalizedVersion,
} from '../../../features/file-versions/fileVersions';

const FILE_VERSION_HISTORY_CAP = 20;

type PersistFinalizedFileVersionsParams = Readonly<{
  sessionId: SessionId;
  snapshotSource: FileVersionSnapshotSource;
  providerRunId?: ProviderRunId;
  kept: ReadonlyArray<FinalizedVersion>;
  onFailure?: (error: unknown) => Promise<void>;
}>;

export const persistFinalizedFileVersions = async ({
  sessionId,
  snapshotSource,
  providerRunId,
  kept,
  onFailure,
}: PersistFinalizedFileVersionsParams): Promise<void> => {
  for (const entry of kept) {
    const row: FileVersion = {
      id: entry.id as FileVersionId,
      sessionId,
      relativePath: entry.relativePath,
      storedName: entry.storedName,
      sizeBytes: entry.sizeBytes,
      contentHash: entry.contentHash,
      changeKind: entry.changeKind,
      snapshotSource,
      ...(providerRunId !== undefined && { providerRunId }),
      capturedAt: new Date().toISOString() as IsoDateTime,
    };
    try {
      await insertFileVersion({ db: tauriDatabase, fileVersion: row });
      const pruned = await pruneFileVersionsForPath({
        db: tauriDatabase,
        sessionId,
        relativePath: entry.relativePath,
        retain: FILE_VERSION_HISTORY_CAP,
      });
      for (const stale of pruned) {
        await fileVersionsDelete({ sessionId, storedName: stale.storedName });
      }
    } catch (error) {
      if (onFailure === undefined) {
        throw error;
      }
      await onFailure(error);
    }
  }
};

type PurgeSessionFileVersionsParams = Readonly<{
  sessionId: SessionId;
}>;

export const purgeSessionFileVersions = async ({
  sessionId,
}: PurgeSessionFileVersionsParams): Promise<void> => {
  await fileVersionsPurgeSession({ sessionId });
  await deleteFileVersionsForSession({ db: tauriDatabase, sessionId });
};

type DeleteOneFileVersionParams = Readonly<{
  sessionId: SessionId;
  id: FileVersionId;
  storedName: string;
}>;

export const deleteOneFileVersion = async ({
  sessionId,
  id,
  storedName,
}: DeleteOneFileVersionParams): Promise<void> => {
  await fileVersionsDelete({ sessionId, storedName });
  await deleteFileVersionRow({ db: tauriDatabase, id });
};
