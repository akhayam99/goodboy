import type { ProviderRunId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { finalizeFolderCapture } from './finalizeFolderCapture';

type Params = Readonly<{
  runId: ProviderRunId;
}>;

export const retryFolderCapture = ({ set, get }: SliceDeps) => {
  return async ({ runId }: Params): Promise<void> => {
    const failure = get().folderCaptureFailures[runId];
    if (failure === undefined) {
      return;
    }
    await finalizeFolderCapture({
      set,
      get,
      sessionId: failure.sessionId,
      runId,
      folderPaths: failure.folderPaths,
    });
  };
};
