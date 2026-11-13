import { useEffect } from 'react';
import { isOwnBrowserClick } from '../../isOwnBrowserClick';
import { openWebLink } from '../../openWebLink';
import { sessionLinkOf } from '../../sessionLinkOf';

export const useOwnBrowserLinkClicks = (): void => {
  useEffect(() => {
    const listening = new AbortController();
    document.addEventListener(
      'click',
      (event) => {
        if (event.defaultPrevented || event.button !== 0 || !isOwnBrowserClick({ event })) {
          return;
        }
        const link = sessionLinkOf({ target: event.target });
        if (link === null) {
          return;
        }
        event.preventDefault();
        void openWebLink({ sessionId: link.sessionId, url: link.url, event });
      },
      { signal: listening.signal },
    );
    return () => listening.abort();
  }, []);
};
