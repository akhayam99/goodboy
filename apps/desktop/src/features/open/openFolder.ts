import type { SessionId } from '@goodboy/types';
import { openTarget } from './openTarget';
import { PLAIN_CLICK } from './plainClick';
import type { OpenResult } from './types';

type Params = {
  readonly path: string;
  readonly sessionId?: SessionId | null;
  readonly editor?: string | null;
  readonly shouldReport?: boolean;
};

export const openFolder = ({
  path,
  sessionId = null,
  editor = null,
  shouldReport = true,
}: Params): Promise<OpenResult> =>
  openTarget({
    target: { kind: 'folder', path, editor },
    sessionId,
    event: PLAIN_CLICK,
    shouldReport,
  });
