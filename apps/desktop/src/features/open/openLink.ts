import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { openTarget } from './openTarget';
import { PLAIN_CLICK } from './plainClick';
import type { OpenClick, OpenForcedPlace } from './types';

type Params = {
  readonly url: string;
  readonly sessionId?: SessionId | null;
  readonly event?: OpenClick;
  readonly place?: OpenForcedPlace;
};

export const openLink = ({ url, sessionId, event = PLAIN_CLICK, place }: Params): void => {
  void openTarget({
    target: { kind: 'web', url },
    sessionId: sessionId === undefined ? useAppStore.getState().currentSessionId : sessionId,
    event,
    ...(place === undefined ? {} : { place }),
  });
};
