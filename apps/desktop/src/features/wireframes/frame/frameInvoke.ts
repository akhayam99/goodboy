import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { ArtifactFolderFile } from '../../artifacts/artifactFile';

export const stageFrame = async ({
  files,
}: {
  readonly files: ReadonlyArray<ArtifactFolderFile>;
}): Promise<string> => invokeCommand<string>('frame_stage', { files });

export const releaseFrame = async ({ stageId }: { readonly stageId: string }): Promise<boolean> =>
  invokeCommand<boolean>('frame_release', { stageId });
