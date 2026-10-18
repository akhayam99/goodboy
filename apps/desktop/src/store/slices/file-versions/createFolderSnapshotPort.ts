import { brandId, type Project, type ProviderRunId, type SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  fileVersionsFolderBegin,
  fileVersionsFolderDiscard,
  fileVersionsFolderStatus,
  type FolderFinalizeResult,
} from '../../../features/file-versions/fileVersions';
import type { InPlaceSnapshotParams } from '../turn/inPlaceSnapshot';
import type { SliceDeps } from '../../slice-types';
import { trackFolderCapture, untrackFolderCapture } from './activeFolderCaptures';
import { finalizeFolderCapture } from './finalizeFolderCapture';
import { persistFolderVersions } from './persistFolderVersions';
import type { GetFn, SetFn } from './types';

type FolderStepParams = Readonly<{
  set: SetFn;
  folder: Project;
}>;

type BuildingParams = FolderStepParams & Readonly<{ get: GetFn }>;

const markBuildingIfNeeded = async ({ set, get, folder }: BuildingParams): Promise<boolean> => {
  if (get().folderVersionsStatus[folder.id]?.kind === 'ready') {
    return false;
  }
  const status = await fileVersionsFolderStatus({ folderPath: folder.rootPath });
  if (status.isReady) {
    return false;
  }
  set((state) => ({
    folderVersionsStatus: { ...state.folderVersionsStatus, [folder.id]: { kind: 'building' } },
  }));
  return true;
};

const markReady = async ({ set, folder }: FolderStepParams): Promise<void> => {
  const status = await fileVersionsFolderStatus({ folderPath: folder.rootPath });
  set((state) => ({
    folderVersionsStatus: { ...state.folderVersionsStatus, [folder.id]: { kind: 'ready', status } },
  }));
};

type RecoveredParams = Readonly<{
  set: SetFn;
  recovered: ReadonlyArray<FolderFinalizeResult>;
  folderPath: string;
}>;

const persistRecovered = async ({ set, recovered, folderPath }: RecoveredParams) => {
  for (const result of recovered) {
    try {
      await persistFolderVersions({
        sessionId: result.sessionId,
        snapshotSource: 'agent_turn',
        providerRunId: brandId<ProviderRunId>({ value: result.runId }),
        kept: result.kept,
        capturedAtMs: result.turn?.finishedAtMs ?? Date.now(),
      });
    } catch (error) {
      set((state) => ({
        folderCaptureFailures: {
          ...state.folderCaptureFailures,
          [result.runId]: {
            sessionId: result.sessionId,
            folderPaths: [folderPath],
            message: formatError(error),
          },
        },
      }));
    }
  }
};

type DiscardParams = Readonly<{
  sessionId: SessionId;
  runId: ProviderRunId;
  folderPaths: ReadonlyArray<string>;
}>;

const discardAll = async ({ sessionId, runId, folderPaths }: DiscardParams): Promise<void> => {
  await Promise.allSettled(
    folderPaths.map((folderPath) => fileVersionsFolderDiscard({ folderPath, sessionId, runId })),
  );
};

type BeginParams = InPlaceSnapshotParams & Readonly<{ set: SetFn; get: GetFn }>;

const beginFolders = async ({ set, get, sessionId, runId, folders }: BeginParams) => {
  const begun: Array<string> = [];
  let pending: Project | null = null;
  try {
    for (const folder of folders) {
      const isBuilding = await markBuildingIfNeeded({ set, get, folder });
      pending = isBuilding ? folder : null;
      const result = await fileVersionsFolderBegin({
        folderPath: folder.rootPath,
        folderId: folder.id,
        sessionId,
        runId,
      });
      begun.push(folder.rootPath);
      await persistRecovered({ set, recovered: result.recovered, folderPath: folder.rootPath });
      if (get().folderVersionsStatus[folder.id]?.kind !== 'ready') {
        await markReady({ set, folder });
      }
      pending = null;
    }
  } catch (error) {
    const failedFolder = pending;
    if (failedFolder !== null) {
      set((state) => ({
        folderVersionsStatus: {
          ...state.folderVersionsStatus,
          [failedFolder.id]: { kind: 'failed', message: formatError(error) },
        },
      }));
    }
    await discardAll({ sessionId, runId, folderPaths: begun });
    throw error;
  }
  trackFolderCapture({ runId, sessionId, folderPaths: begun });
  return {
    finalize: () =>
      finalizeFolderCapture({ set, get, sessionId, runId, folderPaths: begun }).finally(() =>
        untrackFolderCapture({ runId }),
      ),
    discard: () =>
      discardAll({ sessionId, runId, folderPaths: begun }).finally(() =>
        untrackFolderCapture({ runId }),
      ),
  };
};

export const createFolderSnapshotPort = ({ set, get }: SliceDeps) => ({
  begin: async ({ sessionId, runId, folders }: InPlaceSnapshotParams) => {
    if (folders.length === 0) {
      return null;
    }
    return beginFolders({ set, get, sessionId, runId, folders });
  },
});
