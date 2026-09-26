import { invoke } from '@tauri-apps/api/core';
import type { ArtifactFolderFile } from '../../artifacts/artifactFile';

export const stageFrame = async ({
  files,
}: {
  readonly files: ReadonlyArray<ArtifactFolderFile>;
}): Promise<string> => invoke<string>('frame_stage', { files });

export const releaseFrame = async ({ stageId }: { readonly stageId: string }): Promise<boolean> =>
  invoke<boolean>('frame_release', { stageId });
