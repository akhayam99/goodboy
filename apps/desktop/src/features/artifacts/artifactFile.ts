import { invoke } from '@tauri-apps/api/core';

export type ExportArtifactParams = {
  readonly path: string;
  readonly contents: string;
};

export const exportArtifactToFile = async ({
  path,
  contents,
}: ExportArtifactParams): Promise<string> =>
  invoke<string>('export_artifact_to_file', { path, contents });

export type ArtifactFolderFile = Readonly<{
  path: string;
  contents: string;
}>;

export type ExportArtifactFolderParams = {
  readonly parent: string;
  readonly folder: string;
  readonly files: ReadonlyArray<ArtifactFolderFile>;
};

export const exportArtifactFolder = async ({
  parent,
  folder,
  files,
}: ExportArtifactFolderParams): Promise<string> =>
  invoke<string>('export_artifact_folder', { parent, folder, files });
