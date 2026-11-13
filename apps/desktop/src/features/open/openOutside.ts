import { openUrl } from '../../shared/lib/editor';
import { openArtifactMirror } from '../artifacts/artifactMirror/artifactMirrorInvoke';
import type { OpenTarget } from './types';

type Params = {
  readonly target: OpenTarget;
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
