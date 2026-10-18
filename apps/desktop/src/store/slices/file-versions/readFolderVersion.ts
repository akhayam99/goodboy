import type { SessionId } from '@goodboy/types';
import {
  fileVersionsFolderRead,
  type FolderReadResult,
  type FolderReadSide,
} from '../../../features/file-versions/fileVersions';

type Params = Readonly<{
  sessionId: SessionId;
  folderPath: string;
  runId: string;
  relativePath: string;
  side: FolderReadSide;
}>;

export const readFolderVersion = () => {
  return async ({
    sessionId,
    folderPath,
    runId,
    relativePath,
    side,
  }: Params): Promise<FolderReadResult> =>
    fileVersionsFolderRead({ folderPath, sessionId, runId, relativePath, side });
};
