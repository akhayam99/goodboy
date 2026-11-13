import { useEffect } from 'react';
import { isOwnBrowserClick } from '../../isOwnBrowserClick';
import { claimSessionLink } from '../../claimSessionLink';

export const useOwnBrowserLinkClicks = (): void => {
  useEffect(() => {
    const listening = new AbortController();
    document.addEventListener(
      'click',
      (event) => {
        if (event.defaultPrevented || event.button !== 0 || !isOwnBrowserClick({ event })) {
          return;
        }
        const target = event.target;
        const anchor = target instanceof Element ? target.closest('a[href]') : null;
        const href = anchor?.getAttribute('href') ?? '';
        if (anchor === null || href === '' || !claimSessionLink({ href, anchor, event })) {
          return;
        }
        event.preventDefault();
      },
      { signal: listening.signal },
    );
    return () => listening.abort();
  }, []);
};
