import { useEffect, useRef } from 'react';
import { useEscapeLayer, useRestHover } from '@goodboy/ui';
import { useOwnBrowserLinkClicks } from '../../hooks/useOwnBrowserLinkClicks';
import { isLoopbackHost } from '../../isLoopbackHost';
import { sessionLinkOf, type SessionLink } from '../../sessionLinkOf';
import { BrowserLinkPeek } from './BrowserLinkPeek';

type TargetParams = {
  readonly target: EventTarget | null;
};

type UrlParams = {
  readonly url: string;
};

const isLoopbackUrl = ({ url }: UrlParams): boolean => {
  try {
    return isLoopbackHost({ host: new URL(url).hostname });
  } catch {
    return false;
  }
};

const peekLinkOf = ({ target }: TargetParams): SessionLink | null => {
  const link = sessionLinkOf({ target });
  return link !== null && isLoopbackUrl({ url: link.url }) ? link : null;
};

export const BrowserLinkDoors = () => {
  const { target, enter, openNow, leave, close } = useRestHover<SessionLink>({
    hasWarmWindow: true,
  });
  const isPointerFocus = useRef(false);
  useOwnBrowserLinkClicks();
  useEscapeLayer(close, target !== null);

  useEffect(() => {
    const listening = new AbortController();
    const options = { signal: listening.signal };
    document.addEventListener(
      'pointerover',
      (event) => {
        const link = peekLinkOf({ target: event.target });
        if (event.pointerType !== 'touch' && link !== null) {
          enter(link);
        }
      },
      options,
    );
    document.addEventListener(
      'pointerout',
      (event) => {
        const link = peekLinkOf({ target: event.target });
        const next = event.relatedTarget;
        if (link === null || (next instanceof Node && link.anchor.contains(next))) {
          return;
        }
        leave();
      },
      options,
    );
    document.addEventListener(
      'focusin',
      (event) => {
        const link = peekLinkOf({ target: event.target });
        const isFromPointer = isPointerFocus.current;
        isPointerFocus.current = false;
        if (link !== null && !isFromPointer) {
          openNow(link);
        }
      },
      options,
    );
    document.addEventListener(
      'focusout',
      (event) => {
        if (peekLinkOf({ target: event.target }) !== null) {
          close();
        }
      },
      options,
    );
    document.addEventListener(
      'pointerdown',
      (event) => {
        isPointerFocus.current = peekLinkOf({ target: event.target }) !== null;
        close();
      },
      { ...options, capture: true },
    );
    return () => listening.abort();
  }, [enter, leave, openNow, close]);

  return target === null ? null : <BrowserLinkPeek link={target} />;
};
