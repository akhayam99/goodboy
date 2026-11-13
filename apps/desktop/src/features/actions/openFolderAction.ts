import type { SessionId } from '@goodboy/types';
import { openTargetOrThrow } from '../open/openTargetOrThrow';
import { PLAIN_CLICK } from '../open/plainClick';

type Params = {
  readonly path: string | null;
  readonly sessionId: SessionId | null;
  readonly editor?: string | null;
};

export const openFolderAction = ({
  path,
  sessionId,
  editor = null,
}: Params): Promise<void> | undefined =>
  path === null
    ? undefined
    : openTargetOrThrow({
        target: { kind: 'folder', path, editor },
        sessionId,
        event: PLAIN_CLICK,
      });
