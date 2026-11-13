import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { openFile } from '../../../open/openFile';

type Params = {
  readonly sessionId: SessionId;
  readonly workingDir: string | null;
};

export const useOpenDiffFileInEditor = ({
  sessionId,
  workingDir,
}: Params): ((filePath: string) => Promise<void>) =>
  useCallback(
    async (filePath: string) => {
      if (workingDir === null) {
        return;
      }
      await openFile({ path: filePath, root: workingDir.replace(/\/$/, ''), sessionId });
    },
    [sessionId, workingDir],
  );
