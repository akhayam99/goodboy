import { openInBrowser } from './openInBrowser';
import { sessionOfElement } from './sessionOfElement';

type Params = {
  readonly href: string;
  readonly anchor: Element;
};

export const claimSessionLink = ({ href, anchor }: Params): boolean => {
  const sessionId = sessionOfElement({ element: anchor });
  if (sessionId === null) {
    return false;
  }
  void openInBrowser({ sessionId, url: href });
  return true;
};
