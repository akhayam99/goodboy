import { isBrowserLinkArea } from './isBrowserLinkArea';
import { openInBrowser } from './openInBrowser';
import { sessionOfElement } from './sessionOfElement';

type Params = {
  readonly href: string;
  readonly anchor: Element;
};

export const claimSessionLink = ({ href, anchor }: Params): boolean => {
  if (!isBrowserLinkArea({ anchor })) {
    return false;
  }
  const sessionId = sessionOfElement({ element: anchor });
  if (sessionId === null) {
    return false;
  }
  void openInBrowser({ sessionId, url: href });
  return true;
};
