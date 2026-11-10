import { openWebLink } from './openWebLink';
import { sessionOfElement } from './sessionOfElement';

type Params = {
  readonly element: Element;
  readonly url: string;
  readonly event: Pick<MouseEvent, 'metaKey' | 'ctrlKey'>;
};

export const openFromElement = ({ element, url, event }: Params): Promise<void> =>
  openWebLink({ sessionId: sessionOfElement({ element }), url, event });
