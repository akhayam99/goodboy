import { listFileVersionsForSession } from '@goodboy/db';
import type { FileVersionId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { deleteOneFileVersion } from './persistFinalizedFileVersions';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  versionId: FileVersionId;
}>;

export const deleteSessionFileVersion = (_set: SetFn, get: GetFn) => {
  return async ({ sessionId, versionId }: Params): Promise<void> => {
    const fromState = get().sessionFileVersions[sessionId] ?? [];
    const versions =
      fromState.length > 0
        ? fromState
        : await listFileVersionsForSession({ db: tauriDatabase, sessionId });
    const target = versions.find((version) => version.id === versionId);
    if (target == null) {
      return;
    }
    await deleteOneFileVersion({
      sessionId,
      id: versionId,
      storedName: target.storedName,
    });
    await get().loadSessionFileVersions({ sessionId, force: true });
  };
};
