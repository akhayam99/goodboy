import type { SessionId } from '@goodboy/types';
import { openTarget } from './openTarget';
import { PLAIN_CLICK } from './plainClick';
import type { OpenResult } from './types';

type Params = {
  readonly path: string;
  readonly root: string;
  readonly sessionId: SessionId | null;
  readonly line?: number | null;
};

export const openFile = ({ path, root, sessionId, line = null }: Params): Promise<OpenResult> =>
  openTarget({ target: { kind: 'file', path, root, line }, sessionId, event: PLAIN_CLICK });
