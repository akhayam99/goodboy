import { listOrphanArtifacts, type OrphanArtifactRow } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { artifactFolderName } from '../../../features/artifacts/artifactFolderName';
import {
  measureArtifactMirrors,
  type ArtifactMirrorSize,
} from '../../../features/artifacts/artifactMirror/artifactMirrorInvoke';
import type { GetFn, SetFn, StorageArtifact } from './types';

type SizeKeyParams = {
  readonly workspaceSlug: string;
  readonly folder: string;
};

const sizeKey = ({ workspaceSlug, folder }: SizeKeyParams): string => `${workspaceSlug}/${folder}`;

const toStorageArtifact = (row: OrphanArtifactRow): StorageArtifact => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  sessionGoal: row.sessionGoal,
  deletedAt: row.deletedAt,
  updatedAt: row.updatedAt,
  openedAt: row.openedAt,
  keptAt: row.keptAt,
  keptUntil: row.keptUntil,
  sessionId: row.sessionId,
  workspaceId: row.workspaceId,
  workspaceName: row.workspaceName,
  workspaceSlug: row.workspaceSlug,
  folder: artifactFolderName({ artifact: row }),
  sizeBytes: null,
});

export const loadStorageArtifacts = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    const rows = await listOrphanArtifacts({ db: tauriDatabase });
    const artifacts = rows.map(toStorageArtifact);
    set({ storageArtifacts: artifacts });
    if (artifacts.length === 0) {
      return;
    }
    const sizes = await measureArtifactMirrors({
      entries: artifacts.map(({ workspaceSlug, folder }) => ({ workspaceSlug, folder })),
    }).catch((): ReadonlyArray<ArtifactMirrorSize> => []);
    const byKey = new Map(sizes.map((size) => [sizeKey(size), size.sizeBytes]));
    set((state) => ({
      storageArtifacts: state.storageArtifacts.map((artifact) => ({
        ...artifact,
        sizeBytes: byKey.get(sizeKey(artifact)) ?? artifact.sizeBytes,
      })),
    }));
  };
};
