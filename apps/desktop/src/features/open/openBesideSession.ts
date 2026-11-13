import type { SessionId } from '@goodboy/types';
import { artifactMirrorPath } from '../artifacts/artifactMirror/artifactMirrorInvoke';
import { openBeside } from '../browser/openBeside';
import type { LaunchTarget } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly target: LaunchTarget;
};

export const openBesideSession = async ({ sessionId, target }: Params): Promise<void> => {
  if (target.kind === 'web') {
    await openBeside({
      sessionId,
      target: { kind: 'web', url: target.url },
      shouldReport: false,
    });
    return;
  }
  const path = await artifactMirrorPath({
    workspaceSlug: target.workspaceSlug,
    folder: target.folder,
    file: target.file,
  });
  await openBeside({ sessionId, target: { kind: 'local', path }, shouldReport: false });
};
