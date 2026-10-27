import type { SessionId } from '@goodboy/types';
import {
  fileVersionsFolderListTurns,
  type FolderTurnManifest,
} from '../../../features/file-versions/fileVersions';
import { restoredChanges } from '../../../features/file-versions/restoredChanges';
import { turnChanges } from '../../../features/file-versions/turnChanges';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { historyCandidatesOf } from '../project-mounts/inPlaceFoldersOf';
import type { SliceDeps } from '../../slice-types';

type Params = Readonly<{
  sessionId: SessionId;
  isForced?: boolean;
}>;

const latest = createLatestOnly();

export const loadSessionFolderTurns = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, isForced = false }: Params): Promise<void> => {
    if (!isForced && get().sessionFolderTurns[sessionId] !== undefined) {
      return;
    }
    const folders = historyCandidatesOf({ state: get(), sessionId });
    await latest.run({
      key: sessionId,
      request: async () => {
        const lists = await Promise.all(
          folders.map((folder) =>
            fileVersionsFolderListTurns({ folderPath: folder.rootPath, sessionId }),
          ),
        );
        return lists
          .flat()
          .sort((left: FolderTurnManifest, right: FolderTurnManifest) =>
            right.finishedAtMs !== left.finishedAtMs
              ? right.finishedAtMs - left.finishedAtMs
              : right.runId.localeCompare(left.runId),
          );
      },
      apply: (turns) => {
        set((state) => ({
          sessionFolderTurns: { ...state.sessionFolderTurns, [sessionId]: turns },
          sessionFolderSummary: {
            ...state.sessionFolderSummary,
            [sessionId]: { counts: turnChanges({ turns }), restored: restoredChanges({ turns }) },
          },
        }));
      },
    });
  };
};
