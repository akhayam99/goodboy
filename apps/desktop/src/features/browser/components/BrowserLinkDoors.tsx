import { useEffect, useMemo, useRef } from 'react';
import { useEscapeLayer, useRestHover } from '@goodboy/ui';
import { useOwnBrowserLinkClicks } from '../hooks/useOwnBrowserLinkClicks';
import { isLoopbackHost } from '../isLoopbackHost';
import { sessionLinkOf, type SessionLink } from '../sessionLinkOf';
import { BROWSER_SESSION_ATTRIBUTE } from '../browserSessionAttribute';
import { WebLinkPeek, type PeekTarget } from '../WebLinkPeek';

type TargetParams = {
  readonly target: EventTarget | null;
};

type LinkParams = {
  readonly link: SessionLink;
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

const peekTargetOf = ({ link }: LinkParams): PeekTarget => ({
  url: link.url,
  sessionId: link.sessionId,
  anchorOf: () => link.anchor.getBoundingClientRect(),
  roomOf: () => {
    const box = link.anchor.closest(`[${BROWSER_SESSION_ATTRIBUTE}]`)?.getBoundingClientRect();
    return box === undefined || box.width === 0 ? null : box;
  },
});

export const BrowserLinkDoors = () => {
  const { target, enter, openNow, leave, close } = useRestHover<SessionLink>({
    hasWarmWindow: true,
  });
  const peek = useMemo(() => (target === null ? null : peekTargetOf({ link: target })), [target]);
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

  return peek === null ? null : <WebLinkPeek target={peek} />;
};
