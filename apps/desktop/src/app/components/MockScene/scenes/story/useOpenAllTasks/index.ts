import { useEffect } from 'react';
import { dispatchWindowEvent } from '../../../../../../shared/lib/dispatchWindowEvent';

type Params = {
  readonly isActive: boolean;
};

const OPEN_INBOX = 'goodboy:open-inbox';

type EventParams = {
  readonly event: Event;
};

export const useOpenAllTasks = ({ isActive }: Params): void => {
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const widen = ({ event }: EventParams): void => {
      if (!(event instanceof CustomEvent)) {
        return;
      }
      const detail: unknown = event.detail;
      if (
        typeof detail !== 'object' ||
        detail === null ||
        Reflect.get(detail, 'provider') === undefined
      ) {
        return;
      }
      event.stopImmediatePropagation();
      dispatchWindowEvent({
        name: OPEN_INBOX,
        detail: { workspaceId: Reflect.get(detail, 'workspaceId') },
      });
    };
    const listening = new AbortController();
    window.addEventListener(OPEN_INBOX, (event) => widen({ event }), {
      capture: true,
      signal: listening.signal,
    });
    return () => listening.abort();
  }, [isActive]);
};
