import type { SessionId } from '@goodboy/types';
import { openTarget } from './openTarget';
import type { OpenClick, OpenTarget } from './types';

type Params = {
  readonly target: OpenTarget;
  readonly sessionId: SessionId | null;
  readonly event: OpenClick;
};

export const openTargetOrThrow = async ({ target, sessionId, event }: Params): Promise<void> => {
  const result = await openTarget({ target, sessionId, event, shouldReport: false });
  if (result.status === 'failed') {
    throw new Error(result.reason);
  }
};
