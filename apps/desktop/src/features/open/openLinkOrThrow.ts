import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { openTargetOrThrow } from './openTargetOrThrow';
import { PLAIN_CLICK } from './plainClick';
import type { OpenClick, OpenForcedPlace } from './types';

type Params = {
  readonly url: string;
  readonly sessionId?: SessionId | null;
  readonly event?: OpenClick;
  readonly place?: OpenForcedPlace;
};

export const openLinkOrThrow = ({
  url,
  sessionId,
  event = PLAIN_CLICK,
  place,
}: Params): Promise<void> =>
  openTargetOrThrow({
    target: { kind: 'web', url },
    sessionId: sessionId === undefined ? useAppStore.getState().currentSessionId : sessionId,
    event,
    ...(place === undefined ? {} : { place }),
  });
