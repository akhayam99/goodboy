import { openUrl } from '../../shared/lib/editor';
import { openArtifactMirror } from '../artifacts/artifactMirror/artifactMirrorInvoke';
import type { LaunchTarget } from './types';

type Params = {
  readonly target: LaunchTarget;
};

export const openOutside = async ({ target }: Params): Promise<void> => {
  if (target.kind === 'web') {
    await openUrl(target.url);
    return;
  }
  await openArtifactMirror({
    workspaceSlug: target.workspaceSlug,
    folder: target.folder,
    file: target.file,
  });
};
