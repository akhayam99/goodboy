import type { ProviderRunId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { fileVersionsFolderFinalize } from '../../../features/file-versions/fileVersions';
import { persistFolderVersions } from './persistFolderVersions';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  runId: ProviderRunId;
  folderPaths: ReadonlyArray<string>;
}>;

export const finalizeFolderCapture = async ({
  set,
  get,
  sessionId,
  runId,
  folderPaths,
}: Params): Promise<void> => {
  const failed: Array<string> = [];
  let lastError: unknown = null;
  for (const folderPath of folderPaths) {
    try {
      const result = await fileVersionsFolderFinalize({ folderPath, sessionId, runId });
      await persistFolderVersions({
        sessionId,
        snapshotSource: 'agent_turn',
        providerRunId: runId,
        kept: result.kept,
        capturedAtMs: result.turn?.finishedAtMs ?? Date.now(),
      });
    } catch (error) {
      failed.push(folderPath);
      lastError = error;
    }
  }
  if (failed.length > 0) {
    const message = formatError(lastError);
    set((state) => ({
      folderCaptureFailures: {
        ...state.folderCaptureFailures,
        [runId]: { sessionId, folderPaths: failed, message },
      },
    }));
    throw new Error(`Changes from this turn couldn't be saved. ${message}`);
  }
  if (get().folderCaptureFailures[runId] !== undefined) {
    set((state) => {
      const rest = { ...state.folderCaptureFailures };
      delete rest[runId];
      return { folderCaptureFailures: rest };
    });
  }
  if (get().sessionFolderTurns[sessionId] !== undefined) {
    await get().loadSessionFolderTurns({ sessionId, isForced: true });
  }
};
