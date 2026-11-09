import { openInBrowser } from './openInBrowser';
import { openInYourBrowser } from './openInYourBrowser';
import { sessionOfElement } from './sessionOfElement';

type Params = {
  readonly element: Element;
  readonly url: string;
  readonly isOwnBrowser: boolean;
};

export const openFromElement = ({ element, url, isOwnBrowser }: Params): Promise<void> =>
  isOwnBrowser
    ? openInYourBrowser({ url })
    : openInBrowser({ sessionId: sessionOfElement({ element }), url });
