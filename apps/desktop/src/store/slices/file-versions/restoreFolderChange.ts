import type { SessionId } from '@goodboy/types';
import {
  fileVersionsFolderRestore,
  type FolderRestoreResult,
} from '../../../features/file-versions/fileVersions';
import type { SliceDeps } from '../../slice-types';
import { persistFolderVersions } from './persistFolderVersions';

type Params = Readonly<{
  sessionId: SessionId;
  folderPath: string;
  runId: string;
  relativePaths?: ReadonlyArray<string>;
  isForced: boolean;
}>;

const inFlight = new Set<string>();

export const restoreFolderChange = ({ get }: SliceDeps) => {
  return async ({
    sessionId,
    folderPath,
    runId,
    relativePaths,
    isForced,
  }: Params): Promise<FolderRestoreResult> => {
    const key = [folderPath, runId, ...(relativePaths ?? ['*'])].join('\n');
    if (inFlight.has(key)) {
      throw new Error('This restore is already running');
    }
    inFlight.add(key);
    try {
      const result = await fileVersionsFolderRestore({
        folderPath,
        sessionId,
        runId,
        restoreRunId: crypto.randomUUID(),
        isForced,
        ...(relativePaths !== undefined && { relativePaths }),
      }).catch(async (error: unknown) => {
        await get().loadSessionFolderTurns({ sessionId, isForced: true });
        throw error;
      });
      if (result.status !== 'restored') {
        return result;
      }
      await get().loadSessionFolderTurns({ sessionId, isForced: true });
      await persistFolderVersions({
        sessionId,
        snapshotSource: 'restore',
        kept: result.kept,
        capturedAtMs: result.turn?.finishedAtMs ?? Date.now(),
      });
      return result;
    } finally {
      inFlight.delete(key);
    }
  };
};
