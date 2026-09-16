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
