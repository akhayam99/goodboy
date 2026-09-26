import { purgeOrphanArtifact } from '@goodboy/db';
import type { ArtifactId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { removeArtifactMirror } from '../../../features/artifacts/artifactMirror/artifactMirrorInvoke';
import type {
  DeleteStorageArtifactsParams,
  GetFn,
  SetFn,
  StorageArtifact,
  StorageArtifactDeletion,
} from './types';

type BusyParams = {
  readonly ids: ReadonlyArray<ArtifactId>;
  readonly isBusy: boolean;
};

const deleteOne = async (artifact: StorageArtifact): Promise<void> => {
  await removeArtifactMirror({ workspaceSlug: artifact.workspaceSlug, folder: artifact.folder });
  await purgeOrphanArtifact({ db: tauriDatabase, artifactId: artifact.id });
};

export const deleteStorageArtifacts = (set: SetFn, get: GetFn) => {
  const markBusy = ({ ids, isBusy }: BusyParams) =>
    set((state) => {
      const next: Record<string, true> = { ...state.storageDeletingArtifacts };
      for (const id of ids) {
        if (isBusy) {
          next[id] = true;
          continue;
        }
        delete next[id];
      }
      return { storageDeletingArtifacts: next };
    });

  return async ({ ids }: DeleteStorageArtifactsParams): Promise<StorageArtifactDeletion> => {
    const targets = get().storageArtifacts.filter((artifact) => ids.includes(artifact.id));
    markBusy({ ids: targets.map((artifact) => artifact.id), isBusy: true });
    let deleted = 0;
    const failed: Array<StorageArtifactDeletion['failed'][number]> = [];
    for (const artifact of targets) {
      try {
        await deleteOne(artifact);
        deleted += 1;
        set((state) => ({
          storageArtifacts: state.storageArtifacts.filter((entry) => entry.id !== artifact.id),
        }));
      } catch (error) {
        failed.push({ id: artifact.id, message: formatError(error) });
      } finally {
        markBusy({ ids: [artifact.id], isBusy: false });
      }
    }
    return { deleted, failed };
  };
};
