import { deleteFileVersion, listStorageSessionRefs } from '@goodboy/db';
import { brandId, type FileVersionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  fileVersionsFolderPrune,
  fileVersionsFolderSessions,
  type FolderPruneSession,
} from '../../../features/file-versions/fileVersions';
import type { SliceDeps } from '../../slice-types';

type Params = Readonly<{
  nowMs: number;
}>;

type PruneSummary = Readonly<{
  prunedCount: number;
  folderCount: number;
}>;

type FolderParams = Readonly<{
  folderPath: string;
  nowMs: number;
}>;

const pruneOneFolder = async ({ folderPath, nowMs }: FolderParams): Promise<number> => {
  const sessionIds = await fileVersionsFolderSessions({ folderPath });
  if (sessionIds.length === 0) {
    return 0;
  }
  const refs = await listStorageSessionRefs({ db: tauriDatabase, sessionIds: [...sessionIds] });
  const byId = new Map(refs.map((ref) => [ref.sessionId, ref]));
  const sessions: ReadonlyArray<FolderPruneSession> = sessionIds.map((sessionId) => {
    const ref = byId.get(sessionId);
    const endedAtMs = ref === undefined || ref.deletedAt !== null ? 0 : ref.archivedAt;
    return { sessionId, endedAtMs };
  });
  const result = await fileVersionsFolderPrune({ folderPath, sessions, nowMs });
  for (const version of result.pruned) {
    await deleteFileVersion({
      db: tauriDatabase,
      id: brandId<FileVersionId>({ value: version.versionId }),
    });
  }
  return result.pruned.length;
};

export const pruneFolderVersions = ({ get }: SliceDeps) => {
  return async ({ nowMs }: Params): Promise<PruneSummary> => {
    const folderPaths = [
      ...new Set(
        get()
          .projects.filter((project) => project.kind === 'folder')
          .map((project) => project.rootPath),
      ),
    ];
    let prunedCount = 0;
    let lastError: unknown = null;
    for (const folderPath of folderPaths) {
      try {
        prunedCount += await pruneOneFolder({ folderPath, nowMs });
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError !== null) {
      throw lastError;
    }
    return { prunedCount, folderCount: folderPaths.length };
  };
};
