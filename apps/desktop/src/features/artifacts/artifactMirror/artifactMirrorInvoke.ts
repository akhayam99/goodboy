import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { ArtifactFolderFile } from '../artifactFile';

export type ArtifactMirrorEntry = Readonly<{
  workspaceSlug: string;
  folder: string;
  revision: number;
  updatedAt: string;
  rendererVersion: string;
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
  invokeCommand<string>('artifact_mirror_write', { workspaceSlug, folder, files });

export const pendingArtifactMirrors = async ({
  entries,
}: {
  readonly entries: ReadonlyArray<ArtifactMirrorEntry>;
}): Promise<ReadonlyArray<string>> =>
  invokeCommand<ReadonlyArray<string>>('artifact_mirror_pending', { entries });

export const locateArtifactMirror = async ({
  workspaceSlug,
  folder,
}: FolderParams): Promise<ArtifactMirrorLocation> =>
  invokeCommand<ArtifactMirrorLocation>('artifact_mirror_locate', { workspaceSlug, folder });

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
  invokeCommand<ReadonlyArray<ArtifactMirrorSize>>('artifact_mirror_measure', { entries });

export const removeArtifactMirror = async ({
  workspaceSlug,
  folder,
}: FolderParams): Promise<boolean> =>
  invokeCommand<boolean>('artifact_mirror_remove', { workspaceSlug, folder });

export const revealArtifactMirror = async ({
  workspaceSlug,
  folder,
}: FolderParams): Promise<void> =>
  invokeCommand<void>('artifact_mirror_reveal', { workspaceSlug, folder });

export const openArtifactMirror = async ({
  workspaceSlug,
  folder,
  file,
}: FolderParams & { readonly file: string }): Promise<void> =>
  invokeCommand<void>('artifact_mirror_open', { workspaceSlug, folder, file });

export const openArtifactsFolder = async ({
  workspaceSlug,
}: {
  readonly workspaceSlug: string;
}): Promise<void> => invokeCommand<void>('artifact_mirror_open_root', { workspaceSlug });
