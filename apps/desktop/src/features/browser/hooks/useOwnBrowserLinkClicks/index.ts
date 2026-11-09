import { useEffect } from 'react';
import { isOwnBrowserClick } from '../../isOwnBrowserClick';
import { openInYourBrowser } from '../../openInYourBrowser';
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
        void openInYourBrowser({ url: link.url });
      },
      { signal: listening.signal },
    );
    return () => listening.abort();
  }, []);
};
