import type { SessionId } from '@goodboy/types';
import { dispatchWindowEvent } from './dispatchWindowEvent';

type Params = {
  readonly url: string;
  readonly sessionId?: SessionId | null;
  readonly event?: Pick<MouseEvent, 'metaKey' | 'ctrlKey'>;
  readonly place?: 'outside';
};

export const requestOpenLink = ({ url, sessionId, event, place }: Params): void => {
  dispatchWindowEvent({
    name: 'goodboy:open-link',
    detail: {
      url,
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(place === undefined ? {} : { place }),
      ...(event === undefined ? {} : { hasMetaKey: event.metaKey, hasCtrlKey: event.ctrlKey }),
    },
  });
};
