import { invoke } from '@tauri-apps/api/core';
import type { ArtifactFolderFile } from '../artifactFile';

export type ArtifactMirrorEntry = Readonly<{
  workspaceSlug: string;
  folder: string;
  revision: number;
  updatedAt: string;
}>;

export type ArtifactMirrorLocation = Readonly<{
  path: string;
  exists: boolean;
}>;

type FolderParams = {
  readonly workspaceSlug: string;
  readonly folder: string;
};

export const writeArtifactMirror = async ({
  workspaceSlug,
  folder,
  files,
}: FolderParams & { readonly files: ReadonlyArray<ArtifactFolderFile> }): Promise<string> =>
  invoke<string>('artifact_mirror_write', { workspaceSlug, folder, files });

export const pendingArtifactMirrors = async ({
  entries,
}: {
  readonly entries: ReadonlyArray<ArtifactMirrorEntry>;
}): Promise<ReadonlyArray<string>> =>
  invoke<ReadonlyArray<string>>('artifact_mirror_pending', { entries });

export const locateArtifactMirror = async ({
  workspaceSlug,
  folder,
}: FolderParams): Promise<ArtifactMirrorLocation> =>
  invoke<ArtifactMirrorLocation>('artifact_mirror_locate', { workspaceSlug, folder });

export type ArtifactMirrorRef = Readonly<{
  workspaceSlug: string;
  folder: string;
}>;

export type ArtifactMirrorSize = ArtifactMirrorRef &
  Readonly<{
    sizeBytes: number | null;
  }>;

export const measureArtifactMirrors = async ({
  entries,
}: {
  readonly entries: ReadonlyArray<ArtifactMirrorRef>;
}): Promise<ReadonlyArray<ArtifactMirrorSize>> =>
  invoke<ReadonlyArray<ArtifactMirrorSize>>('artifact_mirror_measure', { entries });

export const removeArtifactMirror = async ({
  workspaceSlug,
  folder,
}: FolderParams): Promise<boolean> =>
  invoke<boolean>('artifact_mirror_remove', { workspaceSlug, folder });

export const revealArtifactMirror = async ({
  workspaceSlug,
  folder,
}: FolderParams): Promise<void> =>
  invoke<void>('artifact_mirror_reveal', { workspaceSlug, folder });
