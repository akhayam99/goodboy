import { isBrowserLinkArea } from './isBrowserLinkArea';
import { openWebLink } from './openWebLink';
import { sessionOfElement } from './sessionOfElement';

type Params = {
  readonly href: string;
  readonly anchor: Element;
  readonly event: MouseEvent;
};

export const claimSessionLink = ({ href, anchor, event }: Params): boolean => {
  if (!isBrowserLinkArea({ anchor })) {
    return false;
  }
  const sessionId = sessionOfElement({ element: anchor });
  if (sessionId === null) {
    return false;
  }
  void openWebLink({ sessionId, url: href, event });
  return true;
};
