import type { SessionId } from '@goodboy/types';
import { openTarget } from './openTarget';
import type { OpenClick, OpenForcedPlace, OpenTarget } from './types';

type Params = {
  readonly target: OpenTarget;
  readonly sessionId: SessionId | null;
  readonly event: OpenClick;
  readonly place?: OpenForcedPlace;
};

export const openTargetOrThrow = async ({
  target,
  sessionId,
  event,
  place,
}: Params): Promise<void> => {
  const result = await openTarget({
    target,
    sessionId,
    event,
    shouldReport: false,
    ...(place === undefined ? {} : { place }),
  });
  if (result.status === 'failed') {
    throw new Error(result.reason);
  }
};
