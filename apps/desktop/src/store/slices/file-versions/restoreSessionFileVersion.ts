import { listFileVersionsForSession } from '@goodboy/db';
import type { FileVersionId, ProviderRunId, SessionId } from '@goodboy/types';
import {
  fileVersionsBeginSnapshot,
  fileVersionsFinalizeSnapshot,
  fileVersionsRestore,
} from '../../../features/file-versions/fileVersions';
import { tauriDatabase } from '../../../shared/lib/db';
import { persistFinalizedFileVersions } from './persistFinalizedFileVersions';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  versionId: FileVersionId;
  sessionDir: string;
}>;

export const restoreSessionFileVersion = (_set: SetFn, get: GetFn) => {
  return async ({ sessionId, versionId, sessionDir }: Params): Promise<void> => {
    const fromState = get().sessionFileVersions[sessionId] ?? [];
    const versions =
      fromState.length > 0
        ? fromState
        : await listFileVersionsForSession({ db: tauriDatabase, sessionId });
    const target = versions.find((version) => version.id === versionId);
    if (target == null) {
      throw new Error('file version not found');
    }
    const runId = crypto.randomUUID() as ProviderRunId;
    const begin = await fileVersionsBeginSnapshot({ sessionDir, sessionId, runId });
    const onlyTargetPath = begin.manifest.filter(
      (entry) => entry.relativePath === target.relativePath,
    );
    let restoreError: unknown = null;
    try {
      await fileVersionsRestore({
        sessionDir,
        sessionId,
        relativePath: target.relativePath,
        storedName: target.storedName,
      });
    } catch (error) {
      restoreError = error;
    }
    const finalized = await fileVersionsFinalizeSnapshot({
      sessionDir,
      sessionId,
      runId,
      manifest: onlyTargetPath,
    });
    await persistFinalizedFileVersions({
      sessionId,
      snapshotSource: 'restore',
      kept: finalized.kept,
    });
    if (restoreError != null) {
      throw restoreError;
    }
    await get().loadSessionFileVersions({ sessionId, force: true });
  };
};
