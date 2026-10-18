import type { SessionId } from '@goodboy/types';
import type { FolderRestoreResult } from '../../../features/file-versions/fileVersions';
import type { SliceDeps } from '../../slice-types';

type Params = Readonly<{
  sessionId: SessionId;
  folderPath: string;
  restoreRunId: string;
  relativePaths?: ReadonlyArray<string>;
  isForced: boolean;
}>;

export const undoFolderRestore = ({ get }: SliceDeps) => {
  return async ({
    sessionId,
    folderPath,
    restoreRunId,
    relativePaths,
    isForced,
  }: Params): Promise<FolderRestoreResult> =>
    get().restoreFolderChange({
      sessionId,
      folderPath,
      runId: restoreRunId,
      isForced,
      ...(relativePaths !== undefined && { relativePaths }),
    });
};
