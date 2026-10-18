import type { SessionId } from '@goodboy/types';
import {
  fileVersionsFolderCheck,
  type FolderCheckResult,
} from '../../../features/file-versions/fileVersions';

type Params = Readonly<{
  sessionId: SessionId;
  folderPath: string;
  runId: string;
  relativePaths?: ReadonlyArray<string>;
}>;

export const checkFolderRestore = () => {
  return async ({
    sessionId,
    folderPath,
    runId,
    relativePaths,
  }: Params): Promise<FolderCheckResult> =>
    fileVersionsFolderCheck({
      folderPath,
      sessionId,
      runId,
      ...(relativePaths !== undefined && { relativePaths }),
    });
};
